import type { DarsEvidence } from './dars12Engine.ts';

export interface FwhyDiagnosticCase {
  evidenceKey: string;
  symbol: string;
  status: 'SUPPORTED' | 'INCOMPLETE';
  questions: string[];
  evidenceCount: number;
}

export interface FwhyDiagnosticsResult {
  engine: 'FWHY-DIAGNOSTICS-1.0';
  truthState: 'CURRENT' | 'BLOCKED';
  cases: FwhyDiagnosticCase[];
  supportedCases: number;
  incompleteCases: number;
}

/**
 * FWHY diagnostic boundary. It reasons only from supplied DARS evidence.
 * It never invents company facts, assigns a fundamental score, or changes
 * Rotation/Stock Score/OCE state.
 */
export function runFwhyDiagnostics(evidence: readonly DarsEvidence[]): FwhyDiagnosticsResult {
  const grouped = new Map<string, DarsEvidence[]>();
  for (const row of evidence) {
    const bucket = grouped.get(row.evidenceKey) ?? [];
    bucket.push(row);
    grouped.set(row.evidenceKey, bucket);
  }

  const cases = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([evidenceKey, rows]) => {
    const questions: string[] = [];
    if (rows.length === 0) questions.push('What evidence supports this fundamental/business observation?');
    if (rows.some(row => row.verificationStatus !== 'VERIFIED')) questions.push('What primary or verified source is required before this observation can be treated as confirmed?');
    if (rows.some(row => row.dataNature === 'DERIVED' && !row.formulaVersion)) questions.push('Which approved formula version produced the derived observation?');
    if (rows.some(row => row.truthState !== 'CURRENT')) questions.push('What refresh is required before using this observation as current?');
    return {
      evidenceKey,
      symbol: rows[0]?.symbol ?? '',
      status: questions.length === 0 ? 'SUPPORTED' as const : 'INCOMPLETE' as const,
      questions,
      evidenceCount: rows.length,
    };
  });

  return {
    engine: 'FWHY-DIAGNOSTICS-1.0',
    truthState: cases.some(c => c.status === 'INCOMPLETE') ? 'BLOCKED' : 'CURRENT',
    cases,
    supportedCases: cases.filter(c => c.status === 'SUPPORTED').length,
    incompleteCases: cases.filter(c => c.status === 'INCOMPLETE').length,
  };
}
