/** CHUNK 7 — TIE-ID-1.0 Theme Identification Engine. */
import type { Provenance } from '../contracts/provenance.ts';

export const TIE_METHODOLOGY_VERSION = 'TIE-ID-1.0';

export type ThemeCandidateState =
  | 'CANDIDATE'
  | 'UNDER_REVIEW'
  | 'SUPPORTED'
  | 'VALIDATED'
  | 'REJECTED'
  | 'UNKNOWN';

export interface ThemeSignal {
  signalId: string;
  statement: string;
  evidenceIds: string[];
  provenance: Provenance[];
}

export interface ThemeCandidate {
  candidateId: string;
  themeName: string;
  state: ThemeCandidateState;
  evidenceIds: string[];
  provenance: Provenance[];
  methodologyVersion: string;
}

const VALID_STATES = new Set<ThemeCandidateState>([
  'CANDIDATE','UNDER_REVIEW','SUPPORTED','VALIDATED','REJECTED','UNKNOWN',
]);

export function validateThemeSignal(signal: ThemeSignal): string[] {
  const errors: string[] = [];
  if (!signal.signalId.trim()) errors.push('signalId is required');
  if (!signal.statement.trim()) errors.push('signal statement is required');
  if (signal.evidenceIds.length === 0) errors.push('theme signal requires evidence');
  if (signal.provenance.length === 0) errors.push('theme signal requires provenance');
  return [...new Set(errors)];
}

/**
 * Identification creates an evidence-backed candidate without prematurely
 * confirming that the Theme is validated.
 */
export function identifyThemeCandidate(
  candidateId: string,
  themeName: string,
  evidenceIds: string[],
  provenance: Provenance[],
): ThemeCandidate {
  if (!candidateId.trim()) throw new Error('candidateId is required');
  if (!themeName.trim()) throw new Error('themeName is required');
  if (evidenceIds.length === 0) throw new Error('Theme candidate requires evidence');
  if (provenance.length === 0) throw new Error('Theme candidate requires provenance');

  return {
    candidateId,
    themeName,
    state: 'CANDIDATE',
    evidenceIds: [...new Set(evidenceIds)],
    provenance,
    methodologyVersion: TIE_METHODOLOGY_VERSION,
  };
}

export function validateThemeCandidate(candidate: ThemeCandidate): string[] {
  const errors: string[] = [];
  if (!candidate.candidateId.trim()) errors.push('candidateId is required');
  if (!candidate.themeName.trim()) errors.push('themeName is required');
  if (!VALID_STATES.has(candidate.state)) errors.push('invalid Theme candidate state');
  if (candidate.evidenceIds.length === 0) errors.push('Theme candidate requires evidence');
  if (candidate.provenance.length === 0) errors.push('Theme candidate requires provenance');
  if (candidate.methodologyVersion !== TIE_METHODOLOGY_VERSION) {
    errors.push('TIE methodologyVersion mismatch');
  }
  return [...new Set(errors)];
}

/**
 * Validation is intentionally separate from identification: the engine does
 * not promote a candidate merely because a signal exists.
 */
export function isValidatedTheme(candidate: ThemeCandidate): boolean {
  return candidate.state === 'VALIDATED';
}
