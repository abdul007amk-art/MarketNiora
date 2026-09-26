/**
 * CHUNK 5 — BSQ-1.0
 * Explicit computational primitives. Qualitative balance-sheet states remain evidence-based.
 */
export type BsqState='COMPUTABLE'|'NOT_COMPUTABLE'|'NOT_COMPARABLE';

export function debtToEquity(debt:number|null,equity:number|null){
  if(debt===null||equity===null||!Number.isFinite(debt)||!Number.isFinite(equity))
    return {state:'NOT_COMPUTABLE' as const,value:null};
  if(equity===0) return {state:'NOT_COMPUTABLE' as const,value:null};
  return {state:'COMPUTABLE' as const,value:debt/equity};
}

export function netDebt(debt:number|null,cash:number|null){
  if(debt===null||cash===null||!Number.isFinite(debt)||!Number.isFinite(cash))
    return {state:'NOT_COMPUTABLE' as const,value:null};
  return {state:'COMPUTABLE' as const,value:debt-cash};
}
