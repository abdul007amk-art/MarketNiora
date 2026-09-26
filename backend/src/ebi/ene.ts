/**
 * CHUNK 5 — ENE-1.0
 * Earnings trajectory primitives. No final score.
 */
export type EneState = 'COMPUTABLE' | 'NOT_COMPUTABLE' | 'NOT_COMPARABLE' | 'TURNAROUND_EVENT';

export interface EneMetric { state:EneState; value:number|null; reason:string|null; }

export function acceleration(currentGrowth:number|null, previousGrowth:number|null): EneMetric {
  if (currentGrowth===null || previousGrowth===null || !Number.isFinite(currentGrowth) || !Number.isFinite(previousGrowth))
    return {state:'NOT_COMPUTABLE',value:null,reason:'growth input missing'};
  return {state:'COMPUTABLE',value:currentGrowth-previousGrowth,reason:null};
}

export function normalGrowth(current:number|null, previous:number|null): EneMetric {
  if (current===null || previous===null || !Number.isFinite(current) || !Number.isFinite(previous))
    return {state:'NOT_COMPUTABLE',value:null,reason:'value missing'};
  if (previous===0) return {state:'NOT_COMPUTABLE',value:null,reason:'denominator is zero'};
  if (previous<0) {
    if (current>=0) return {state:'TURNAROUND_EVENT',value:null,reason:'negative-to-positive base'};
    return {state:'NOT_COMPARABLE',value:null,reason:'negative base'};
  }
  return {state:'COMPUTABLE',value:(current-previous)/previous*100,reason:null};
}
