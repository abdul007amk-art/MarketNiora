/**
 * REVIEW GATE — "Optional Owner/Admin Review" step
 * Status: IMPLEMENTATION — unit tested below.
 *
 * GOVERNANCE: AI cannot: hold Owner/Admin authority, modify protected
 * formulas, access secrets, access another user's portfolio, or bypass
 * payment. This gate specifically enforces the first of those for
 * research events — reviewing/approving is a REVIEW_AI_RESEARCH
 * permission (Module 3 RBAC), and AI_AGENT structurally holds zero
 * permissions, so it can never satisfy this gate under any input.
 */

import type { Role } from '../security/rbac.ts';
import { hasPermission } from '../security/rbac.ts';
import type { ResearchEvent } from './researchEvent.ts';

export type ReviewDecision = 'APPROVE' | 'REJECT';

export interface ReviewResult {
  allowed: boolean;
  reason: string;
  event: ResearchEvent | null;
}

/**
 * Post-audit fix (Finding 11-A, BLOCKER): this is the ONLY place the
 * UNVERIFIED -> VERIFIED transition exists in the entire codebase.
 * Deliberately NOT exported — no other file can import it, so there is
 * no path from AI or any arbitrary caller to this transition except
 * through reviewResearchEvent() below, which gates on REVIEW_AI_RESEARCH.
 */
function promoteToVerified(event: ResearchEvent): ResearchEvent {
  return { ...event, provenance: { ...event.provenance, verificationStatus: 'VERIFIED' } };
}

/**
 * Fail-closed: missing/unknown role, a role lacking REVIEW_AI_RESEARCH
 * (AI_AGENT and USER always lack it — see rbac.ts), or an unrecognized
 * decision value (post-audit fix, Finding 11-B — previously anything
 * other than 'APPROVE' silently fell through to the REJECT branch
 * instead of being rejected as an invalid input) are all denied. Only on
 * APPROVE does the event's verificationStatus get promoted; REJECT leaves
 * provenance untouched and just flips reviewStatus.
 */
export function reviewResearchEvent(event: ResearchEvent, reviewerRole: Role | null | undefined, decision: ReviewDecision): ReviewResult {
  if (!reviewerRole) {
    return { allowed: false, reason: 'DENY: no reviewer role provided', event: null };
  }
  if (!hasPermission(reviewerRole, 'REVIEW_AI_RESEARCH')) {
    return { allowed: false, reason: `DENY: role ${reviewerRole} lacks REVIEW_AI_RESEARCH permission`, event: null };
  }
  if (decision !== 'APPROVE' && decision !== 'REJECT') {
    return { allowed: false, reason: `DENY: unrecognized decision value: ${decision}`, event: null };
  }

  if (decision === 'APPROVE') {
    const verified = promoteToVerified(event);
    return { allowed: true, reason: 'APPROVED', event: { ...verified, reviewStatus: 'APPROVED' } };
  }

  // decision === 'REJECT' (the only other value that can reach here)
  return { allowed: true, reason: 'REJECTED', event: { ...event, reviewStatus: 'REJECTED' } };
}
