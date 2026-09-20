/**
 * THEME CONTRACT
 * Status: IMPLEMENTATION — unit tested below.
 *
 * Structural classification only: THEME -> SUB-THEME -> INDUSTRY -> STOCK,
 * many-to-many stock<->industry membership. NO Theme Score formula here —
 * deliberately deferred (see docs/PEERS_THEME_FUNDAMENTAL_VALUECHAIN.md
 * and Module 10 scope lock). Theme Intelligence stays independent from
 * Rotation — this module has zero imports from rotationEngine.ts or
 * stockScoreEngine.ts, structurally enforced and tested.
 *
 * Post-audit (Finding 10-B): StockThemeMembership now embeds the shared
 * Provenance contract — a classification claim ("this stock belongs to
 * this industry") is itself an observation that needs a source.
 */

import type { Provenance, ValidationResult } from './provenance.ts';
import { validateProvenance } from './provenance.ts';

export interface ThemeNode {
  themeId: string;
  name: string;
}

export interface SubThemeNode {
  subThemeId: string;
  themeId: string;
  name: string;
}

export interface IndustryNode {
  industryId: string;
  subThemeId: string;
  name: string;
}

export interface StockThemeMembership {
  stockId: string;
  industryId: string;
  provenance: Provenance;
}

export function validateStockThemeMembership(membership: StockThemeMembership): ValidationResult {
  const errors: string[] = [];
  if (!membership.stockId) errors.push('stockId is required');
  if (!membership.industryId) errors.push('industryId is required');
  const provenanceResult = validateProvenance(membership.provenance);
  if (!provenanceResult.valid) errors.push(...provenanceResult.errors.map((e) => `provenance: ${e}`));
  return { valid: errors.length === 0, errors };
}

export function validateSubTheme(sub: SubThemeNode, themes: ThemeNode[]): ValidationResult {
  const errors: string[] = [];
  if (!sub.name || sub.name.trim().length === 0) errors.push('name is required');
  if (!themes.some((t) => t.themeId === sub.themeId)) errors.push('themeId does not reference a known theme');
  return { valid: errors.length === 0, errors };
}

export function validateIndustry(industry: IndustryNode, subThemes: SubThemeNode[]): ValidationResult {
  const errors: string[] = [];
  if (!industry.name || industry.name.trim().length === 0) errors.push('name is required');
  if (!subThemes.some((s) => s.subThemeId === industry.subThemeId)) errors.push('subThemeId does not reference a known sub-theme');
  return { valid: errors.length === 0, errors };
}

/** Many-to-many: every theme a stock belongs to, resolved through its industry memberships. */
export function getThemesForStock(
  stockId: string,
  memberships: StockThemeMembership[],
  industries: IndustryNode[],
  subThemes: SubThemeNode[]
): string[] {
  const industryIds = new Set(memberships.filter((m) => m.stockId === stockId).map((m) => m.industryId));
  const subThemeIds = new Set(industries.filter((i) => industryIds.has(i.industryId)).map((i) => i.subThemeId));
  const themeIds = new Set(subThemes.filter((s) => subThemeIds.has(s.subThemeId)).map((s) => s.themeId));
  return [...themeIds];
}

export function getStocksForIndustry(industryId: string, memberships: StockThemeMembership[]): string[] {
  return [...new Set(memberships.filter((m) => m.industryId === industryId).map((m) => m.stockId))];
}
