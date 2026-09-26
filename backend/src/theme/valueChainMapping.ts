/** CHUNK 7 — VCM-1.0 Value Chain Mapping & Classification Engine. */
import {validateProvenance,type Provenance} from '../contracts/provenance.ts';
export const VCM_METHODOLOGY_VERSION='VCM-1.0';
export interface ValueChainStage{stageId:string;name:string;sequence:number|null;}
export type ValueChainRelationship='PRIMARY'|'SECONDARY'|'OVERLAPPING'|'ENABLING'|'BENEFICIARY'|'UNKNOWN';
export interface ValueChainMapping{mappingId:string;industryId:string;stage:ValueChainStage;relationship:ValueChainRelationship;evidenceIds:string[];provenance:Provenance[];methodologyVersion:string;}
export function validateValueChainStage(s:ValueChainStage):string[]{const e:string[]=[];if(!s.stageId.trim())e.push('stageId is required');if(!s.name.trim())e.push('Value Chain stage name is required');if(s.sequence!==null&&(!Number.isInteger(s.sequence)||s.sequence<0))e.push('stage sequence must be null or a non-negative integer');return e;}
export function validateValueChainMapping(m:ValueChainMapping):string[]{const e=[...validateValueChainStage(m.stage)];if(!m.mappingId.trim())e.push('mappingId is required');if(!m.industryId.trim())e.push('Industry parent context is required');if(!m.evidenceIds.length)e.push('Value Chain mapping requires evidence');if(!m.provenance.length)e.push('Value Chain mapping requires provenance');if(m.methodologyVersion!==VCM_METHODOLOGY_VERSION)e.push('VCM methodologyVersion mismatch');for(const p of m.provenance){const r=validateProvenance(p);if(!r.valid)e.push(...r.errors);}return[...new Set(e)];}
export function supportsMultipleStages(stages:readonly ValueChainStage[]):boolean{return new Set(stages.map(x=>x.stageId)).size>1;}
export function canDiscoverStocksFromValueChainStage(id:string):boolean{return id.trim().length>0;}
