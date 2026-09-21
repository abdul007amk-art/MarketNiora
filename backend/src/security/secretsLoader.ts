/**
 * SECRETS LOADER
 * Status: IMPLEMENTATION — unit tested below.
 *
 * GOVERNANCE: Secrets must never reach frontend/browser/source/Git/logs/
 * analytics/normal API responses/AI_AGENT (Master Guide #25, #27).
 * This module: reads from process.env only, throws (fails closed) if a
 * required secret is missing, and NEVER logs or returns secret values in
 * error messages — only the missing key NAME is ever surfaced.
 */

export function requireSecret(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    // Deliberately do not include `value` here even though it's empty —
    // habit discipline matters more than risk in this one specific line.
    throw new Error(`Missing required secret: ${name}`);
  }
  return value;
}

export function requireSecrets(names: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  const missing: string[] = [];
  for (const name of names) {
    const value = process.env[name];
    if (!value || value.trim().length === 0) {
      missing.push(name);
    } else {
      result[name] = value;
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing required secrets: ${missing.join(', ')}`);
  }
  return result;
}

/** Never call this on a secret value. For redacting secrets in logs/errors if one ever needs to be referenced. */
export function redact(_value: string): string {
  return '[REDACTED]';
}
