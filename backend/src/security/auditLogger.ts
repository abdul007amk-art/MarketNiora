import type { PrismaClient } from '@prisma/client';

export type ActorType = 'OWNER' | 'ADMIN' | 'USER' | 'AI_AGENT' | 'SYSTEM';

export interface AuditEntry {
  actor_type: ActorType;
  actor_id: string | null;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
}

const SENSITIVE_KEY_PATTERN = /pass(word)?|secret|token|api[_-]?key|authoriz(e|ation)|cookie|session[_-]?id|otp|pin\b|card[_-]?number|cvv|recovery|totp/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function redactDetail(detail: Record<string, unknown> | null, depth = 0): Record<string, unknown> | null {
  if (detail === null) return null;
  if (depth > 5) return { _truncated: 'max redaction depth exceeded' };
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) result[key] = '[REDACTED]';
    else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactDetail(value as Record<string, unknown>, depth + 1);
    } else result[key] = value;
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
  if (!action || action.trim().length === 0) throw new Error('audit action cannot be empty — silent/unlabeled audit events are not permitted');
  if (actorId !== null && !UUID_PATTERN.test(actorId)) throw new Error('audit actor_id must be a UUID when supplied');
  return { actor_type: actorType, actor_id: actorId, action: action.trim(), target, detail: redactDetail(detail) };
}

export interface AuditLogStore { append(entry: AuditEntry): Promise<void>; }

export class PrismaAuditLogStore implements AuditLogStore {
  constructor(private readonly prisma: PrismaClient) {}
  async append(entry: AuditEntry): Promise<void> {
    const persisted = buildAuditEntry(entry.actor_type, entry.actor_id, entry.action, entry.target, entry.detail);
    await this.prisma.appAuditLog.create({
      data: {
        actorType: persisted.actor_type,
        actorId: persisted.actor_id,
        action: persisted.action,
        targetType: null,
        targetId: persisted.target,
        metadata: persisted.detail ?? undefined,
      },
    });
  }
}

export async function writeAuditLog(entry: AuditEntry, prisma: PrismaClient): Promise<void> {
  await new PrismaAuditLogStore(prisma).append(entry);
}
