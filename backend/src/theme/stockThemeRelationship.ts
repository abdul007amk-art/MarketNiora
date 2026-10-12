/** CHUNK 7 — STRIE-1.0 Stock–Theme Relationship Intelligence Engine. */
import { validateProvenance,type Provenance } from '../contracts/provenance.ts';
export const STRIE_METHODOLOGY_VERSION='STRIE-1.0';
export type StockThemeRelationshipType='DIRECT'|'INDIRECT'|'ENABLER'|'BENEFICIARY'|'SUPPLIER'|'CUSTOMER'|'INFRASTRUCTURE_PROVIDER'|'TECHNOLOGY_PROVIDER'|'VALUE_CHAIN_PARTICIPANT'|'MIXED'|'UNKNOWN';
export type ExposureStage='CURRENT'|'PLANNED';
export interface StockThemeRelationship {
 relationshipId:string; stockId:string; themeId:string; relationshipType:StockThemeRelationshipType; exposureStage:ExposureStage;
 effectiveFrom:string|null; effectiveTo:string|null;
 strength:string; materiality:string; confidence:string; evidenceIds:string[]; provenance:Provenance[]; methodologyVersion:string;
}
const VALID_RELATIONSHIPS=new Set<StockThemeRelationshipType>(['DIRECT','INDIRECT','ENABLER','BENEFICIARY','SUPPLIER','CUSTOMER','INFRASTRUCTURE_PROVIDER','TECHNOLOGY_PROVIDER','VALUE_CHAIN_PARTICIPANT','MIXED','UNKNOWN']);
export function validateStockThemeRelationship(r:StockThemeRelationship):string[] {
 const errors:string[]=[];
 if(!r.relationshipId.trim())errors.push('relationshipId is required'); if(!r.stockId.trim())errors.push('stockId is required'); if(!r.themeId.trim())errors.push('themeId is required');
 if(!VALID_RELATIONSHIPS.has(r.relationshipType))errors.push('invalid Stock–Theme relationship type');
 if(r.strength.trim()==='')errors.push('relationship strength is required'); if(r.materiality.trim()==='')errors.push('relationship materiality is required'); if(r.confidence.trim()==='')errors.push('relationship confidence is required');
 if(r.exposureStage!=='CURRENT'&&r.exposureStage!=='PLANNED')errors.push('invalid exposure stage');
 if(r.effectiveFrom!==null&&Number.isNaN(Date.parse(r.effectiveFrom)))errors.push('effectiveFrom must be null or a valid date');
 if(r.effectiveTo!==null&&Number.isNaN(Date.parse(r.effectiveTo)))errors.push('effectiveTo must be null or a valid date');
 if(r.effectiveFrom&&r.effectiveTo&&Date.parse(r.effectiveTo)<Date.parse(r.effectiveFrom))errors.push('effectiveTo cannot precede effectiveFrom');
 if(r.evidenceIds.length===0)errors.push('relationship requires evidence'); if(r.provenance.length===0)errors.push('relationship requires provenance');
 if(r.methodologyVersion!==STRIE_METHODOLOGY_VERSION)errors.push('STRIE methodologyVersion mismatch');
 for(const p of r.provenance){const result=validateProvenance(p);if(!result.valid)errors.push(...result.errors);}
 return [...new Set(errors)];
}
export function preservesCurrentPlannedExposureSeparation(r:StockThemeRelationship):boolean{return r.exposureStage==='CURRENT'||r.exposureStage==='PLANNED';}
export function relationshipAttributesAreInvestmentAttractiveness():boolean{return false;}
