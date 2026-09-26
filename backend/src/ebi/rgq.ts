/**
 * CHUNK 5 — RGQ-1.0
 * Evidence/metric primitives only; no final score.
 */
export interface RgqEvidence {
  organicQuality: 'ORGANIC'|'INORGANIC'|'UNKNOWN';
  volumeSupport: 'SUPPORTED'|'NOT_AVAILABLE'|'UNKNOWN';
  realisationSupport: 'SUPPORTED'|'NOT_AVAILABLE'|'UNKNOWN';
  concentration: 'LOW'|'MEDIUM'|'HIGH'|'UNKNOWN';
  recurringQuality: 'RECURRING'|'NON_RECURRING'|'MIXED'|'UNKNOWN';
  persistence: 'PERSISTENT'|'TEMPORARY'|'UNKNOWN';
  evidenceSource: string;
}

export function revenueGrowth(current:number|null, previous:number|null) {
  if (current===null || previous===null || !Number.isFinite(current) || !Number.isFinite(previous))
    return {state:'NOT_COMPUTABLE' as const,value:null};
  if (previous===0) return {state:'NOT_COMPUTABLE' as const,value:null};
  if (previous<0) return {state:'NOT_COMPARABLE' as const,value:null};
  return {state:'COMPUTABLE' as const,value:(current-previous)/previous*100};
}
