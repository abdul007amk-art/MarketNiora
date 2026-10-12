/** CHUNK 7 — IME-1.0 Industry Mapping & Classification Engine. */
import {validateProvenance,type Provenance} from '../contracts/provenance.ts';
export const IME_METHODOLOGY_VERSION='IME-1.0';
export type IndustryRelationship='PRIMARY'|'SECONDARY'|'OVERLAPPING'|'ENABLING'|'BENEFICIARY'|'UNKNOWN';
export interface IndustryMapping{mappingId:string;subThemeId:string;industryId:string;relationship:IndustryRelationship;evidenceIds:string[];provenance:Provenance[];methodologyVersion:string;}
export function validateIndustryMapping(m:IndustryMapping):string[]{const e:string[]=[];if(!m.mappingId.trim())e.push('mappingId is required');if(!m.subThemeId.trim())e.push('Sub-Theme parent context is required');if(!m.industryId.trim())e.push('industryId is required');if(m.subThemeId===m.industryId)e.push('Industry cannot self-map to its Sub-Theme parent');if(!m.evidenceIds.length)e.push('Industry mapping requires evidence');if(!m.provenance.length)e.push('Industry mapping requires provenance');if(m.methodologyVersion!==IME_METHODOLOGY_VERSION)e.push('IME methodologyVersion mismatch');for(const p of m.provenance){const r=validateProvenance(p);if(!r.valid)e.push(...r.errors);}return[...new Set(e)];}
export function supportsMultipleIndustryRelationships(m:readonly IndustryMapping[]):boolean{return new Set(m.map(x=>x.industryId)).size>1;}
export function canDiscoverStocksFromIndustry(id:string):boolean{return id.trim().length>0;}
export function isMarketRotationSectorLabel(label:string):boolean{return ['SECTOR','SUB-SECTOR','SUB_SECTOR'].includes(label.trim().toUpperCase());}
export function validateIndustryEvidence(ids:readonly string[]):string[]{return ids.length>0?[]:['Industry mapping requires evidence; no forced mapping'];}
