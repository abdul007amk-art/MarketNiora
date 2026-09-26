/**
 * CHUNK 6 — OLA-1.0
 * Enforces only lifecycle constraints explicitly stated in the source package.
 * The source does not provide a complete transition matrix, so none is invented here.
 */
import type { OpportunityLifecycle } from './types.ts';

const TERMINAL = new Set<OpportunityLifecycle>(['COMPLETED', 'INVALIDATED', 'CANCELLED']);

export function validateLifecycleTransition(from: OpportunityLifecycle, to: OpportunityLifecycle): string[] {
  const errors: string[] = [];
  if (from === 'INVALIDATED' && to !== 'INVALIDATED') {
    errors.push('INVALIDATED opportunities cannot be silently reactivated');
  }
  if (from === 'CANCELLED' && to !== 'CANCELLED') {
    errors.push('CANCELLED opportunities cannot be silently reactivated');
  }
  if (from === 'COMPLETED' && to !== 'COMPLETED') {
    errors.push('COMPLETED opportunities cannot be silently reopened');
  }
  return errors;
}

export function isTerminalLifecycle(state: OpportunityLifecycle): boolean {
  return TERMINAL.has(state);
}
