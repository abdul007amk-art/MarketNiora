/**
 * SIGNUP FLOW
 * Status: IMPLEMENTATION — unit tested below.
 *
 * buildNewUserRecord does NOT write to a database — no DB client exists in
 * this repo yet (see writeAuditLog stub in security/auditLogger.ts for the
 * same pattern). Caller is responsible for persisting the returned record
 * and for checking email-uniqueness BEFORE calling this (that check needs
 * a real DB query this module deliberately does not perform).
 */

import { validateEmail, validatePasswordStrength } from './signupValidation.ts';
import { hashPassword } from './passwordHashing.ts';

export interface NewUserRecord {
  email: string;
  password_hash: string;
  role: 'USER';
  email_verified: false;
}

export interface SignupResult {
  success: boolean;
  record: NewUserRecord | null;
  errors: string[];
}

export function buildNewUserRecord(email: string, password: string): SignupResult {
  const errors: string[] = [];

  const emailCheck = validateEmail(email);
  if (!emailCheck.valid) errors.push(emailCheck.reason);

  const passwordCheck = validatePasswordStrength(password);
  if (!passwordCheck.valid) errors.push(passwordCheck.reason);

  if (errors.length > 0) {
    return { success: false, record: null, errors };
  }

  return {
    success: true,
    record: {
      email,
      password_hash: hashPassword(password),
      role: 'USER',
      email_verified: false,
    },
    errors: [],
  };
}
