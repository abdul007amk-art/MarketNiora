/**
 * CHUNK 5 — EBI-INPUT-1.0
 * Canonical input envelope. This is a contract, not a calculation engine.
 */
import { validateProvenance, type Provenance } from '../contracts/provenance.ts';

export type EbiPeriodType = 'QUARTER'|'YEAR'|'TTM'|'CAGR_3Y'|'CAGR_5Y'|'POINT_IN_TIME';

export type EbiInputClassification = 'REPORTED'|'DERIVED'|'ESTIMATED'|'INFERRED';

export interface EbiInputMetric {
  metric: string;
  value: number | null;
  periodType: EbiPeriodType;
  periodStart: string | null;
  periodEnd: string | null;
  reportedDate: string | null;
  classification: EbiInputClassification;
  provenance: Provenance;
  restatementId: string | null;
  supersedesRestatementId: string | null;
}

export function validateEbiInputMetric(input:EbiInputMetric): string[] {
  const errors:string[]=[];
  if(!input.metric.trim()) errors.push('metric is required');
  if(input.value!==null && !Number.isFinite(input.value)) errors.push('value must be finite or null');
  if(!input.periodType) errors.push('periodType is required');
  errors.push(...validateProvenance(input.provenance).errors);
  if(input.classification==='REPORTED' && input.provenance.dataNature==='DERIVED')
    errors.push('REPORTED input cannot use DERIVED dataNature');
  if(input.classification==='DERIVED' && input.provenance.dataNature!=='DERIVED')
    errors.push('DERIVED input must use DERIVED dataNature');
  if(input.supersedesRestatementId!==null && input.restatementId===null)
    errors.push('supersedesRestatementId requires restatementId');
  return errors;
}
