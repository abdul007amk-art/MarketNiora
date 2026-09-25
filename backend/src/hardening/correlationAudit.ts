/**
 * MARKETNIORA SCORE CORRELATION AUDIT
 *
 * Diagnostic only. It NEVER changes SS-1.0-R3 weights.
 * The purpose is to detect information overlap such as
 * Momentum↔Trend, Earnings Momentum↔Growth/Visibility, etc.
 */
export interface FeatureObservation {
  id: string;
  values: Record<string, number>;
}

export interface CorrelationFinding {
  left: string;
  right: string;
  pearsonR: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

function pearson(a: number[], b: number[]): number | null {
  if (a.length !== b.length || a.length < 3) return null;
  const ma = a.reduce((s, x) => s + x, 0) / a.length;
  const mb = b.reduce((s, x) => s + x, 0) / b.length;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) {
    const xa = a[i] - ma;
    const xb = b[i] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  if (da === 0 || db === 0) return null;
  return num / Math.sqrt(da * db);
}

export function auditFeatureCorrelation(
  observations: readonly FeatureObservation[],
  mediumThreshold = 0.70,
  highThreshold = 0.85,
): CorrelationFinding[] {
  if (mediumThreshold <= 0 || highThreshold <= mediumThreshold || highThreshold > 1) {
    throw new Error('invalid correlation thresholds');
  }
  if (observations.length < 3) return [];

  const keys = [...new Set(observations.flatMap(o => Object.keys(o.values)))].sort();
  const findings: CorrelationFinding[] = [];

  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = observations.map(o => o.values[keys[i]]).filter(Number.isFinite);
      const b = observations.map(o => o.values[keys[j]]).filter(Number.isFinite);
      if (a.length !== observations.length || b.length !== observations.length) continue;
      const r = pearson(a, b);
      if (r === null || Math.abs(r) < mediumThreshold) continue;
      findings.push({
        left: keys[i],
        right: keys[j],
        pearsonR: r,
        severity: Math.abs(r) >= highThreshold ? 'HIGH' : 'MEDIUM',
      });
    }
  }
  return findings;
}
