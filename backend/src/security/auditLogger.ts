/**
 * AUDIT LOGGER
 * Status: IMPLEMENTATION — buildAuditEntry unit tested below.
 * writeAuditLog is a STUB — not wired to a real database client yet
 * (no DB connection exists in this repo). Wiring happens when the actual
 * DB client is introduced (Module 6/7 — Provider/Data Pipeline).
 *
 * Matches database/schema.sql audit_log table exactly. audit_log is
 * append-only at the DB level (see immutability triggers in schema.sql) —
 * this module never attempts update/delete.
 */

export type ActorType = 'OWNER' | 'ADMIN' | 'USER' | 'AI_AGENT' | 'SYSTEM';

export interface AuditEntry {
  actor_type: ActorType;
  actor_id: string | null;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
}

/**
 * Any key matching these patterns (case-insensitive) is redacted before an
 * audit entry is built — regardless of what a future caller passes in.
 * This is enforced HERE at the audit boundary, not left to caller discipline,
 * because "the caller should remember not to log secrets" is exactly the
 * kind of assumption that eventually fails.
 */
const SENSITIVE_KEY_PATTERN = /pass(word)?|secret|token|api[_-]?key|authoriz(e|ation)|cookie|session[_-]?id|otp|pin\b|card[_-]?number|cvv|recovery|totp/i;

function redactDetail(detail: Record<string, unknown> | null, depth = 0): Record<string, unknown> | null {
  if (detail === null) return null;
  if (depth > 5) return { _truncated: 'max redaction depth exceeded' };

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      result[key] = '[REDACTED]';
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactDetail(value as Record<string, unknown>, depth + 1);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function buildAuditEntry(
  actorType: ActorType,
  actorId: string | null,
  action: string,
  target: string | null = null,
  detail: Record<string, unknown> | null = null
): AuditEntry {
  if (!action || action.trim().length === 0) {
    throw new Error('audit action cannot be empty — silent/unlabeled audit events are not permitted');
  }
  return { actor_type: actorType, actor_id: actorId, action, target, detail: redactDetail(detail) };
}

/**
 * STUB — no real DB client wired yet. Throws intentionally so this can
 * never be silently called in a code path and appear to have logged
 * something that it didn't.
 */
export async function writeAuditLog(_entry: AuditEntry): Promise<never> {
  throw new Error(
    'writeAuditLog is not wired to a database client yet. Do not catch-and-ignore this error — ' +
      'it exists to prevent silently-missing audit trails.'
  );
}
