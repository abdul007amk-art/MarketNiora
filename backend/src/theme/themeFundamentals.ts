/** CHUNK 7 — TFI-1.0 Theme Fundamental Intelligence. */
import { validateProvenance,type Provenance } from '../contracts/provenance.ts';
export const TFI_METHODOLOGY_VERSION='TFI-1.0';
export type ThemeFundamentalDimension='DEMAND'|'REVENUE_POOL'|'MARGIN_ECONOMICS'|'CAPITAL_INTENSITY'|'RETURN_ECONOMICS'|'CASH_FLOW_ECONOMICS'|'PRICING_POWER'|'THEME_NATURE'|'CYCLE_INTELLIGENCE';
export interface ThemeFundamentalObservation{observationId:string;themeId:string;dimension:ThemeFundamentalDimension;value:string;unit:string|null;evidenceIds:string[];provenance:Provenance[];methodologyVersion:string;}
export function validateThemeFundamentalObservation(o:ThemeFundamentalObservation):string[]{const e:string[]=[];if(!o.observationId.trim())e.push('observationId is required');if(!o.themeId.trim())e.push('themeId is required');if(!o.value.trim())e.push('fundamental value is required');if(o.unit!==null&&!o.unit.trim())e.push('unit must be null or non-empty');if(o.evidenceIds.length===0)e.push('Theme fundamental observation requires evidence');if(o.provenance.length===0)e.push('Theme fundamental observation requires provenance');if(o.methodologyVersion!==TFI_METHODOLOGY_VERSION)e.push('TFI methodologyVersion mismatch');for(const p of o.provenance){const r=validateProvenance(p);if(!r.valid)e.push(...r.errors);}return[...new Set(e)];}
export function isCompanyMetricAutomaticallyThemeLevel(metricName:string):boolean{return !['ROE','ROCE'].includes(metricName.trim().toUpperCase());}
export function createsUniversalThemeScore():boolean{return false;}
