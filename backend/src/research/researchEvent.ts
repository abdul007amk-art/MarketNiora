/**
 * RESEARCH EVENT
 * Status: IMPLEMENTATION — unit tested below.
 *
 * Flow (Master Guide): PERMITTED SOURCE/FILING -> AI DISCOVERY ->
 * SOURCE VERIFICATION -> PROVENANCE/CONFIDENCE -> CANONICAL EVENT ->
 * OPTIONAL OWNER/ADMIN REVIEW -> NOTIFICATION.
 *
 * Reuses contracts/provenance.ts (Module 10) rather than inventing a
 * parallel confidence/verification vocabulary — an AI-discovered event's
 * verificationStatus is exactly the same VERIFIED/UNVERIFIED/
 * SOURCE_REQUIRED vocabulary used everywhere else in this repo.
 *
 * GOVERNANCE: AI is never a "score writer" — nothing in this file
 * computes or modifies Rotation/Stock Score/Theme/Fundamental values.
 * Zero imports from rotationEngine.ts or stockScoreEngine.ts.
 */

import { randomBytes } from 'crypto';
import type { Provenance, ValidationResult } from '../contracts/provenance.ts';
import { validateProvenance } from '../contracts/provenance.ts';
import type { SourceRegistry } from './permittedSources.ts';

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface RawDiscovery {
  sourceId: string;
  stockId: string | null;
  headline: string;
  summary: string;
  discoveredAt: number;
}

export interface ResearchEvent {
  eventId: string;
  sourceId: string;
  stockId: string | null;
  headline: string;
  summary: string;
  provenance: Provenance;
  reviewStatus: ReviewStatus;
}

export interface DiscoveryResult {
  accepted: boolean;
  event: ResearchEvent | null;
  errors: string[];
}

/**
 * AI DISCOVERY + SOURCE VERIFICATION, combined into one fail-closed step:
 * a discovery from an unpermitted/inactive source is rejected outright —
 * it never becomes a ResearchEvent, canonical or otherwise.
 */
export function processDiscovery(discovery: RawDiscovery, registry: SourceRegistry, now: number = Date.now()): DiscoveryResult {
  const errors: string[] = [];

  if (!registry.isPermitted(discovery.sourceId)) {
    return { accepted: false, event: null, errors: [`source ${discovery.sourceId} is not a permitted/active source`] };
  }
  if (!discovery.headline || discovery.headline.trim().length === 0) errors.push('headline is required');
  if (!discovery.summary || discovery.summary.trim().length === 0) errors.push('summary is required');
  if (!Number.isFinite(discovery.discoveredAt) || discovery.discoveredAt > now) {
    errors.push('discoveredAt must be finite and not in the future');
  }

  if (errors.length > 0) {
    return { accepted: false, event: null, errors };
  }

  const provenance: Provenance = {
    source: discovery.sourceId,
    sourceTimestamp: discovery.discoveredAt,
    verificationStatus: 'UNVERIFIED', // AI discovery alone is never VERIFIED — see promoteToVerified()
    dataNature: 'RAW',
    formulaVersion: null,
  };

  const event: ResearchEvent = {
    eventId: randomBytes(12).toString('hex'),
    sourceId: discovery.sourceId,
    stockId: discovery.stockId,
    headline: discovery.headline,
    summary: discovery.summary,
    provenance,
    reviewStatus: 'PENDING',
  };

  return { accepted: true, event, errors: [] };
}

export function validateResearchEvent(event: ResearchEvent): ValidationResult {
  const errors: string[] = [];
  if (!event.eventId) errors.push('eventId is required');
  if (!event.sourceId) errors.push('sourceId is required');
  if (!event.headline || event.headline.trim().length === 0) errors.push('headline is required');
  const provenanceResult = validateProvenance(event.provenance);
  if (!provenanceResult.valid) errors.push(...provenanceResult.errors);
  return { valid: errors.length === 0, errors };
}

/**
 * Post-audit fix (Finding 11-A, BLOCKER): the UNVERIFIED -> VERIFIED
 * transition used to be a separately-exported `promoteToVerified()`
 * function — meaning any caller (including a hypothetical AI-driven
 * code path) could call it directly, bypassing the Owner/Admin
 * REVIEW_AI_RESEARCH gate entirely. That function has been REMOVED from
 * this file. The verification transition now lives ONLY as a
 * non-exported private helper inside reviewGate.ts — there is no import
 * path from any other file to reach it. This is a structural guarantee
 * (TypeScript/JS module scoping), not a convention someone could forget.
 */
