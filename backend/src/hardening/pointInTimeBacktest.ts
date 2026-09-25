/**
 * MARKETNIORA POINT-IN-TIME BACKTEST HARNESS
 *
 * This is a validation harness, not a historical-performance claim.
 * It enforces knowledge-time discipline and computes outcome statistics
 * from supplied point-in-time decision snapshots.
 */
export interface PITObservation {
  stockId: string;
  effectiveTime: number;
  knowledgeTime: number;
  value: number;
}

export interface PITDecision {
  stockId: string;
  decisionTime: number;
  state: 'WATCH' | 'WAIT' | 'READY' | 'INVALIDATED';
  evidence: PITObservation[];
}

export interface BacktestOutcome {
  stockId: string;
  decisionTime: number;
  horizonDays: number;
  entryPrice: number;
  exitPrice: number;
  returnPct: number;
}

export interface BacktestSummary {
  observations: number;
  winners: number;
  hitRate: number;
  averageReturnPct: number;
  medianReturnPct: number;
  maxAdverseReturnPct: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a,b)=>a-b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m-1]+s[m])/2;
}

export function validatePointInTimeDecision(decision: PITDecision): string[] {
  const errors: string[] = [];
  if (!decision.stockId) errors.push('stockId required');
  if (!Number.isFinite(decision.decisionTime)) errors.push('decisionTime must be finite');
  for (const e of decision.evidence) {
    if (e.knowledgeTime > decision.decisionTime) {
      errors.push(`future knowledge leakage: ${e.stockId}`);
    }
  }
  return errors;
}

export function buildOutcomes(
  decisions: readonly PITDecision[],
  prices: readonly PITObservation[],
  horizonDays: number,
): BacktestOutcome[] {
  if (!Number.isInteger(horizonDays) || horizonDays <= 0) throw new Error('horizonDays must be a positive integer');
  const outcomes: BacktestOutcome[] = [];

  for (const d of decisions) {
    if (d.state !== 'READY') continue;
    const errors = validatePointInTimeDecision(d);
    if (errors.length) throw new Error(errors.join('; '));

    const candidates = prices
      .filter(p => p.stockId === d.stockId && p.knowledgeTime <= d.decisionTime)
      .sort((a,b)=>a.effectiveTime-b.effectiveTime);

    const entry = candidates.find(p => p.effectiveTime >= d.decisionTime);
    if (!entry) continue;

    const targetTime = entry.effectiveTime + horizonDays * 86_400_000;
    const exit = prices
      .filter(p => p.stockId === d.stockId && p.effectiveTime >= targetTime)
      .sort((a,b)=>a.effectiveTime-b.effectiveTime)[0];

    if (!exit || entry.value <= 0) continue;
    outcomes.push({
      stockId:d.stockId,
      decisionTime:d.decisionTime,
      horizonDays,
      entryPrice:entry.value,
      exitPrice:exit.value,
      returnPct:(exit.value/entry.value-1)*100,
    });
  }
  return outcomes;
}

export function summarizeOutcomes(outcomes: readonly BacktestOutcome[]): BacktestSummary {
  const returns = outcomes.map(x=>x.returnPct);
  if (!returns.length) {
    return { observations:0, winners:0, hitRate:0, averageReturnPct:0, medianReturnPct:0, maxAdverseReturnPct:0 };
  }
  return {
    observations:returns.length,
    winners:returns.filter(x=>x>0).length,
    hitRate:returns.filter(x=>x>0).length/returns.length,
    averageReturnPct:returns.reduce((s,x)=>s+x,0)/returns.length,
    medianReturnPct:median(returns),
    maxAdverseReturnPct:Math.min(...returns),
  };
}
