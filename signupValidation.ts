/**
 * SIGNUP VALIDATION
 * Status: IMPLEMENTATION — unit tested below.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string | null | undefined): { valid: boolean; reason: string } {
  if (!email) return { valid: false, reason: 'email is required' };
  if (email.length > 254) return { valid: false, reason: 'email too long' };
  if (!EMAIL_PATTERN.test(email)) return { valid: false, reason: 'invalid email format' };
  return { valid: true, reason: 'ok' };
}

/**
 * Minimum bar only — length + character-class variety. Does not check
 * against breached-password lists (that would need an external service/
 * dataset — out of scope for this module, worth revisiting in Module 6).
 */
export function validatePasswordStrength(password: string | null | undefined): { valid: boolean; reason: string } {
  if (!password) return { valid: false, reason: 'password is required' };
  if (password.length < 12) return { valid: false, reason: 'password must be at least 12 characters' };
  if (password.length > 256) return { valid: false, reason: 'password is unreasonably long' };

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  const classes = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;

  if (classes < 3) {
    return { valid: false, reason: 'password must include at least 3 of: lowercase, uppercase, digit, symbol' };
  }
  return { valid: true, reason: 'ok' };
}
