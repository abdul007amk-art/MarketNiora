/**
 * CHUNK 6 — OLA-1.0 deterministic lifecycle/history contract.
 * Evidence-gated canonical progression with preserved history and no silent reactivation.
 */
import type { OpportunityLifecycle } from './types.ts';

export interface LifecycleEvent {
  opportunityId: string;
  from: OpportunityLifecycle | null;
  to: OpportunityLifecycle;
  evidenceIds: string[];
  timestamp: number;
  reason: string;
}

const FORWARD: Record<OpportunityLifecycle, readonly OpportunityLifecycle[]> = {
  IDENTIFIED: ['VALIDATED', 'DELAYED', 'INVALIDATED', 'CANCELLED'],
  VALIDATED: ['DEVELOPING', 'DELAYED', 'INVALIDATED', 'CANCELLED'],
  DEVELOPING: ['ACTIVE', 'DELAYED', 'INVALIDATED', 'CANCELLED'],
  ACTIVE: ['REALISING', 'DELAYED', 'INVALIDATED', 'CANCELLED'],
  REALISING: ['COMPLETED', 'DELAYED', 'INVALIDATED', 'CANCELLED'],
  COMPLETED: [],
  DELAYED: ['VALIDATED', 'DEVELOPING', 'ACTIVE', 'REALISING', 'COMPLETED', 'INVALIDATED', 'CANCELLED'],
  INVALIDATED: [],
  CANCELLED: [],
};

export function validateLifecycleTransition(
  from: OpportunityLifecycle,
  to: OpportunityLifecycle,
  evidenceIds: string[] = [],
): string[] {
  const errors: string[] = [];
  if (!(FORWARD[from] ?? []).includes(to)) errors.push(`invalid lifecycle transition: ${from} -> ${to}`);
  if (evidenceIds.length === 0) errors.push('lifecycle transition requires evidence');
  if (from === 'INVALIDATED' && to !== 'INVALIDATED') errors.push('INVALIDATED opportunities cannot be silently reactivated');
  if (from === 'CANCELLED' && to !== 'CANCELLED') errors.push('CANCELLED opportunities cannot be silently reactivated');
  if (from === 'COMPLETED' && to !== 'COMPLETED') errors.push('COMPLETED opportunities cannot be silently reopened');
  return [...new Set(errors)];
}

export function isTerminalLifecycle(state: OpportunityLifecycle): boolean {
  return state === 'COMPLETED' || state === 'INVALIDATED' || state === 'CANCELLED';
}

export function validateLifecycleHistory(history: LifecycleEvent[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const event of history) {
    if (!event.opportunityId.trim()) errors.push('lifecycle opportunityId is required');
    if (!Number.isFinite(event.timestamp)) errors.push('lifecycle timestamp must be finite');
    if (!event.reason.trim()) errors.push('lifecycle reason is required');
    if (event.evidenceIds.length === 0) errors.push('lifecycle event requires evidence');
    const key = `${event.opportunityId}|${event.timestamp}|${event.from ?? 'NULL'}|${event.to}`;
    if (seen.has(key)) errors.push(`duplicate lifecycle event: ${key}`);
    seen.add(key);
  }

  for (let i = 1; i < history.length; i += 1) {
    const previous = history[i - 1];
    const current = history[i];
    if (current.timestamp < previous.timestamp) errors.push('lifecycle history must be chronological');
    errors.push(...validateLifecycleTransition(previous.to, current.to, current.evidenceIds));
  }
  return [...new Set(errors)];
}

export function validateRevalidation(state: OpportunityLifecycle, evidenceIds: string[]): string[] {
  if (state !== 'DELAYED') return [];
  return evidenceIds.length > 0 ? [] : ['DELAYED revalidation requires fresh evidence'];
}
