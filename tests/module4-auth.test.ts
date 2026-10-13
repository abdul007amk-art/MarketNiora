const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { generateKeyPairSync, sign: signJwt } = require('node:crypto');
const { generateTotpCode, generateTotpSecret, verifyTotpCode } = require('../backend/src/auth/totp.ts');
const { provisionOwnerTotp, confirmOwnerTotp, beginOwnerMfa, verifyOwnerMfa, InMemoryOwnerTotpStore, InMemoryOwnerMfaChallengeStore } = require('../backend/src/auth/ownerMfa.ts');
const { GoogleOidcVerifier } = require('../backend/src/auth/oidcVerifier.ts');

test('TOTP verification succeeds for current code and rejects an expired code', () => {
  const secret='JBSWY3DPEHPK3PXP', now=1700000000000, code=generateTotpCode(secret,now);
  assert.match(code,/^\d{6}$/); assert.equal(verifyTotpCode(secret,code,now).valid,true); assert.equal(verifyTotpCode(secret,code,now+120000).valid,false);
});
test('owner TOTP provisioning remains unconfirmed until valid code confirmation', async () => {
  const store=new InMemoryOwnerTotpStore(), id='owner-1', p=await provisionOwnerTotp(store,id);
  assert.ok(p.secret); assert.match(p.otpauthUri,/^otpauth:\/\/totp\/MarketNiora/); assert.equal((await store.get(id)).confirmedAt,null);
  assert.equal(await confirmOwnerTotp(store,id,'000000'),false); assert.equal(await confirmOwnerTotp(store,id,generateTotpCode(p.secret)),true); assert.ok((await store.get(id)).confirmedAt);
});
test('owner MFA challenge is single-use and expires', async () => {
  const totp=new InMemoryOwnerTotpStore(), ch=new InMemoryOwnerMfaChallengeStore(), id='owner-2', secret=generateTotpSecret(), now=1700000000000;
  totp.set(id,{secret,confirmedAt:now}); const challenge=await beginOwnerMfa(totp,ch,id,now); assert.ok(challenge);
  assert.equal((await verifyOwnerMfa(totp,ch,challenge,'000000',now)).success,false); assert.equal((await verifyOwnerMfa(totp,ch,challenge,generateTotpCode(secret,now),now)).success,true); assert.equal((await verifyOwnerMfa(totp,ch,challenge,generateTotpCode(secret,now),now)).success,false);
  const expired=await beginOwnerMfa(totp,ch,id,now); assert.equal((await verifyOwnerMfa(totp,ch,expired,generateTotpCode(secret,now),now+300000)).success,false);
});
test('Google OIDC verifier rejects malformed and non-RS256 tokens before trusting identity', async () => {
  const verifier=new GoogleOidcVerifier({clientId:'test-client',jwksUri:'http://127.0.0.1:9/unreachable'});
  await assert.rejects(()=>verifier.verify('not.a.jwt'),/invalid ID token format/);
  const header=Buffer.from(JSON.stringify({alg:'HS256',kid:'x'})).toString('base64url'); const payload=Buffer.from(JSON.stringify({iss:'https://accounts.google.com',aud:'test-client',sub:'s',email:'a@b.com',email_verified:true,exp:Math.floor(Date.now()/1000)+300,iat:Math.floor(Date.now()/1000)})).toString('base64url');
  await assert.rejects(()=>verifier.verify(header+'.'+payload+'.AA'),/unsupported ID token algorithm/);
});
test('Google OIDC verifier rejects untrusted audiences and mismatched azp', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicJwk = publicKey.export({ format: 'jwk' });
  const jwks = {
    keys: [{
      ...publicJwk,
      kid: 'marketniora-test-key',
      kty: 'RSA',
      alg: 'RS256',
      use: 'sig',
    }],
  };
  const jwksServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' });
    res.end(JSON.stringify(jwks));
  });

  await new Promise((resolve, reject) => {
    jwksServer.once('error', reject);
    jwksServer.listen(0, '127.0.0.1', resolve);
  });

  try {
    const address = jwksServer.address();
    const verifier = new GoogleOidcVerifier({
      clientId: 'test-client',
      jwksUri: `http://127.0.0.1:${address.port}/jwks`,
    });
    const now = Math.floor(Date.now() / 1000);
    const baseClaims = {
      iss: 'https://accounts.google.com',
      aud: 'test-client',
      azp: 'test-client',
      sub: 'google-subject-1',
      email: 'researcher@example.com',
      email_verified: true,
      exp: now + 300,
      iat: now,
    };
    const makeToken = (claims) => {
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'marketniora-test-key' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
      const signingInput = `${header}.${payload}`;
      const signature = signJwt('RSA-SHA256', Buffer.from(signingInput), privateKey).toString('base64url');
      return `${signingInput}.${signature}`;
    };

    const validIdentity = await verifier.verify(makeToken(baseClaims));
    assert.equal(validIdentity.subject, 'google-subject-1');
    assert.equal(validIdentity.email, 'researcher@example.com');

    const validWithoutAzp = await verifier.verify(makeToken({ ...baseClaims, azp: undefined }));
    assert.equal(validWithoutAzp.subject, 'google-subject-1');

    const validSingletonAudience = await verifier.verify(makeToken({ ...baseClaims, aud: ['test-client'] }));
    assert.equal(validSingletonAudience.subject, 'google-subject-1');

    const validPastNotBefore = await verifier.verify(makeToken({ ...baseClaims, nbf: now - 30 }));
    assert.equal(validPastNotBefore.subject, 'google-subject-1');

    // Reuse the existing 60-second clock-skew tolerance used for iat.
    const withinClockSkew = await verifier.verify(makeToken({ ...baseClaims, nbf: now + 30 }));
    assert.equal(withinClockSkew.subject, 'google-subject-1');

    await assert.rejects(
      () => verifier.verify(makeToken({ ...baseClaims, nbf: now + 120 })),
      /ID token not yet valid/,
    );

    await assert.rejects(
      () => verifier.verify(makeToken({ ...baseClaims, nbf: 'later' })),
      /invalid nbf/,
    );

    await assert.rejects(
      () => verifier.verify(makeToken({ ...baseClaims, azp: 'another-client' })),
      /invalid ID token authorized party/,
    );

    await assert.rejects(
      () => verifier.verify(makeToken({ ...baseClaims, azp: 123 })),
      /invalid ID token authorized party/,
    );

    await assert.rejects(
      () => verifier.verify(makeToken({ ...baseClaims, aud: ['test-client', 'untrusted-audience'] })),
      /invalid ID token audience/,
    );

    await assert.rejects(
      () => verifier.verify(makeToken({ ...baseClaims, aud: ['test-client', 'untrusted-audience'], azp: 'test-client' })),
      /invalid ID token audience/,
    );
  } finally {
    await new Promise((resolve, reject) => jwksServer.close((error) => error ? reject(error) : resolve()));
  }
});

test('auth route exposes no password signup/login endpoints', () => {
  const fs=require('fs'),route=fs.readFileSync(require.resolve('../backend/src/api/routes/auth.ts'),'utf8');
  assert.equal(route.includes('/auth/signup'),false); assert.equal(route.includes('/auth/login'),false); assert.equal(route.includes('password'),false);
});


test('session cookies are Secure in production and retain existing local-development behavior', () => {
  const { buildSessionCookieHeaders } = require('../backend/src/api/sessionCookies.ts');

  const production = buildSessionCookieHeaders('session123', 'csrf456', 'production');
  assert.equal(production.length, 2);
  assert.match(production[0], /^session_token=session123; HttpOnly; Path=\/; SameSite=Strict; Secure$/);
  assert.match(production[1], /^csrf_token=csrf456; Path=\/; SameSite=Strict; Secure$/);
  assert.doesNotMatch(production[1], /HttpOnly/); // browser reads CSRF token for double-submit header

  const development = buildSessionCookieHeaders('session123', 'csrf456', 'development');
  assert.equal(development[0], 'session_token=session123; HttpOnly; Path=/; SameSite=Strict');
  assert.equal(development[1], 'csrf_token=csrf456; Path=/; SameSite=Strict');
});
