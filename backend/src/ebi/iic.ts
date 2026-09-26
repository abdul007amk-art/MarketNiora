/**
 * CHUNK 5 — IIC-1.0
 * Independence/integration guard. Data may be shared; decision authority may not.
 */
export type EbiDependency =
  | 'ROTATION'|'THEME'|'OCE'|'SHARIAH'|'STOCK_SCORE'|'TIE'|'RSE_DCS';

export interface IntegrationRef {
  consumer:EbiDependency;
  methodologyVersion:string;
  authority:'DATA_ONLY';
}

export function validateIntegrationRef(ref:IntegrationRef):string[]{
  const errors:string[]=[];
  if(!ref.methodologyVersion.trim()) errors.push('methodologyVersion is required');
  if(ref.authority!=='DATA_ONLY') errors.push('EBI integration authority must be DATA_ONLY');
  return errors;
}

export function rejectCircularDependency(path:EbiDependency[]):boolean {
  return new Set(path).size!==path.length;
}
