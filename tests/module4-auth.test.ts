const test = require('node:test');
const assert = require('node:assert/strict');
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
test('auth route exposes no password signup/login endpoints', () => {
  const fs=require('fs'),route=fs.readFileSync(require.resolve('../backend/src/api/routes/auth.ts'),'utf8');
  assert.equal(route.includes('/auth/signup'),false); assert.equal(route.includes('/auth/login'),false); assert.equal(route.includes('password'),false);
});
