/**
 * PEERS CONTRACT
 * Status: IMPLEMENTATION — unit tested below.
 *
 * GOVERNANCE: "Peer calculations raw observations par based honge —
 * dusre scores ko peer input nahi banana." This module has ZERO imports
 * from rotationEngine.ts or stockScoreEngine.ts — structurally enforced
 * and tested, same isolation convention as Module 8/9.
 *
 * Post-audit (Finding 10-B): UniversePeerLink now embeds the shared
 * Provenance contract instead of a bare `source` string.
 */

import type { Provenance, ValidationResult } from './provenance.ts';
import { validateProvenance } from './provenance.ts';

export interface StockGroupMembership {
  stockId: string;
  groupId: string;
}

/**
 * MarketNiora Special Peers: other stocks in the SAME Master Stock
 * Group(s) as the target, self-excluded. A stock can belong to multiple
 * groups (many-to-many); a peer via ANY shared group counts.
 */
export function getSpecialPeers(targetStockId: string, memberships: StockGroupMembership[]): string[] {
  const targetGroups = new Set(memberships.filter((m) => m.stockId === targetStockId).map((m) => m.groupId));
  if (targetGroups.size === 0) return [];

  const peerIds = new Set<string>();
  for (const m of memberships) {
    if (m.stockId !== targetStockId && targetGroups.has(m.groupId)) {
      peerIds.add(m.stockId);
    }
  }
  return [...peerIds];
}

/**
 * Universe Peers: broader business competitors. Unlike Special Peers,
 * this is NOT derivable purely from Stock Group membership — the Master
 * Guide doesn't specify a derivation algorithm, so this module validates
 * and queries an explicitly-provided relationship list rather than
 * inventing a similarity/competitor-detection rule.
 */
export interface UniversePeerLink {
  stockId: string;
  peerStockId: string;
  provenance: Provenance;
}

export function validateUniversePeerLink(link: UniversePeerLink): ValidationResult {
  const errors: string[] = [];
  if (!link.stockId) errors.push('stockId is required');
  if (!link.peerStockId) errors.push('peerStockId is required');
  if (link.stockId && link.peerStockId && link.stockId === link.peerStockId) {
    errors.push('a stock cannot be its own universe peer (self-exclusion)');
  }
  const provenanceResult = validateProvenance(link.provenance);
  if (!provenanceResult.valid) errors.push(...provenanceResult.errors.map((e) => `provenance: ${e}`));
  return { valid: errors.length === 0, errors };
}

export function getUniversePeers(targetStockId: string, links: UniversePeerLink[]): string[] {
  const peerIds = new Set<string>();
  for (const link of links) {
    if (link.stockId === targetStockId && link.peerStockId !== targetStockId) {
      peerIds.add(link.peerStockId);
    }
  }
  return [...peerIds];
}
