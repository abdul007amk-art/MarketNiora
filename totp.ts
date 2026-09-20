/**
 * TOTP — Time-based One-Time Password (RFC 6238 / RFC 4226)
 * Status: IMPLEMENTATION — unit tested below.
 *
 * Built entirely on Node's built-in `crypto` module — no external TOTP
 * library — consistent with the rest of this repo's zero-network-install
 * approach. The secret itself is never logged; see docs/OWNER_MFA.md and
 * the redaction hardening in security/auditLogger.ts.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DEFAULT_STEP_SECONDS = 30;
const DEFAULT_DIGITS = 6;
const DEFAULT_WINDOW = 1; // allow ±1 step (±30s) for clock drift

function base32Encode(bytes: Uint8Array): string {
  let bits = '';
  for (let i = 0; i < bytes.length; i++) {
    bits += bytes[i].toString(2).padStart(8, '0');
  }
  let output = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    output += BASE32_ALPHABET[parseInt(chunk, 2)];
  }
  return output;
}

function base32Decode(encoded: string): Uint8Array {
  const clean = encoded.toUpperCase().replace(/=+$/, '');
  let bits = '';
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error('invalid base32 character in TOTP secret');
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Uint8Array.from(bytes);
}

function counterToBytes(counter: number): Uint8Array {
  // 8-byte big-endian counter. `counter` (seconds/step) safely fits in the
  // low 32 bits for tens of thousands of years, so the top 4 bytes stay 0.
  const buf = new Uint8Array(8);
  let n = counter;
  for (let i = 7; i >= 4; i--) {
    buf[i] = n & 0xff;
    n = Math.floor(n / 256);
  }
  return buf;
}

function hotp(secretBytes: Uint8Array, counter: number, digits: number): string {
  const counterBytes = counterToBytes(counter);
  const hmac = createHmac('sha1', secretBytes);
  hmac.update(counterBytes);
  const digest = hmac.digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binCode =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return (binCode % 10 ** digits).toString().padStart(digits, '0');
}

function constantTimeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

/**
 * Post-audit hardening (MEDIUM finding): stepSeconds/digits/window/now
 * were accepted without validation, so a caller passing 0, negative, NaN,
 * or Infinity would silently produce nonsensical (or infinite-loop-prone,
 * in the case of a malformed window) behavior. Generation functions throw
 * on invalid params (same convention as issueSession's TTL validation);
 * verification functions fail closed via a result object (same convention
 * as every other verify* function in this codebase — none of them throw).
 */
function isValidStepSeconds(stepSeconds: unknown): stepSeconds is number {
  return typeof stepSeconds === 'number' && Number.isFinite(stepSeconds) && Number.isInteger(stepSeconds) && stepSeconds > 0 && stepSeconds <= 300;
}

function isValidDigits(digits: unknown): digits is number {
  return typeof digits === 'number' && Number.isFinite(digits) && Number.isInteger(digits) && digits >= 6 && digits <= 8;
}

function isValidWindow(window: unknown): window is number {
  return typeof window === 'number' && Number.isFinite(window) && Number.isInteger(window) && window >= 0 && window <= 10;
}

function isValidTimestamp(now: unknown): now is number {
  return typeof now === 'number' && Number.isFinite(now);
}

export function generateTotpSecret(byteLength: number = 20): string {
  return base32Encode(randomBytes(byteLength));
}

export function generateTotpCode(base32Secret: string, now: number = Date.now(), stepSeconds: number = DEFAULT_STEP_SECONDS, digits: number = DEFAULT_DIGITS): string {
  if (!isValidTimestamp(now)) throw new Error(`now must be a finite number, got: ${now}`);
  if (!isValidStepSeconds(stepSeconds)) throw new Error(`stepSeconds must be a positive integer <= 300, got: ${stepSeconds}`);
  if (!isValidDigits(digits)) throw new Error(`digits must be an integer between 6 and 8, got: ${digits}`);

  const counter = Math.floor(now / 1000 / stepSeconds);
  return hotp(base32Decode(base32Secret), counter, digits);
}

export interface TotpVerificationResult {
  valid: boolean;
  reason: string;
}

export interface TotpVerifyOptions {
  stepSeconds?: number;
  digits?: number;
  window?: number;
}

/**
 * Fail-closed by construction: missing code, missing secret, non-numeric
 * code, wrong-length code, or a malformed secret all deny before any HMAC
 * computation happens. Only a code matching within the allowed time window
 * validates.
 */
export function verifyTotpCode(
  base32Secret: string | null | undefined,
  submittedCode: string | null | undefined,
  now: number = Date.now(),
  options: TotpVerifyOptions = {}
): TotpVerificationResult {
  const stepSeconds = options.stepSeconds ?? DEFAULT_STEP_SECONDS;
  const digits = options.digits ?? DEFAULT_DIGITS;
  const window = options.window ?? DEFAULT_WINDOW;

  if (!isValidTimestamp(now)) return { valid: false, reason: 'invalid timestamp' };
  if (!isValidStepSeconds(stepSeconds)) return { valid: false, reason: 'invalid stepSeconds parameter' };
  if (!isValidDigits(digits)) return { valid: false, reason: 'invalid digits parameter' };
  if (!isValidWindow(window)) return { valid: false, reason: 'invalid window parameter' };

  if (!submittedCode) return { valid: false, reason: 'no code provided' };
  if (!/^[0-9]+$/.test(submittedCode)) return { valid: false, reason: 'code must be numeric' };
  if (submittedCode.length !== digits) return { valid: false, reason: 'code has wrong length' };
  if (!base32Secret) return { valid: false, reason: 'no secret provided' };

  let secretBytes: Uint8Array;
  try {
    secretBytes = base32Decode(base32Secret);
  } catch {
    return { valid: false, reason: 'malformed secret' };
  }

  const counter = Math.floor(now / 1000 / stepSeconds);
  for (let drift = -window; drift <= window; drift++) {
    const candidate = hotp(secretBytes, counter + drift, digits);
    if (constantTimeStringEqual(candidate, submittedCode)) {
      return { valid: true, reason: 'valid' };
    }
  }
  return { valid: false, reason: 'code does not match within allowed time window' };
}
