/**
 * CHUNK 5 — OEP-1.0
 * Output/evidence presentation contract. No ranking or score is generated.
 */
export interface OepOutput {
  title:string;
  primaryOutput:string|null;
  keyEvidence:string[];
  trendDirection:string|null;
  confidence:string|null;
  truthState:string;
  dataCoverage:number|null;
  source:string|null;
  lastUpdated:string|null;
}

export function validateOepOutput(o:OepOutput):string[]{
  const errors:string[]=[];
  if(!o.title.trim()) errors.push('title is required');
  if(!o.truthState.trim()) errors.push('truthState is required');
  if(o.dataCoverage!==null && (!Number.isFinite(o.dataCoverage)||o.dataCoverage<0))
    errors.push('dataCoverage must be null or a non-negative finite value');
  return errors;
}
