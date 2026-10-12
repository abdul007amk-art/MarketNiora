/** CHUNK 7 — STM-1.0 Sub-Theme Mapping & Classification Engine. */
import {validateProvenance,type Provenance} from '../contracts/provenance.ts';
export const STM_METHODOLOGY_VERSION='STM-1.0';
export type SubThemeRelationship='PRIMARY'|'SECONDARY'|'OVERLAPPING'|'ENABLING'|'BENEFICIARY'|'UNKNOWN';
export interface SubThemeMapping{mappingId:string;themeNodeId:string;subThemeId:string;relationship:SubThemeRelationship;evidenceIds:string[];provenance:Provenance[];methodologyVersion:string;}
export function validateSubThemeMapping(m:SubThemeMapping):string[]{const e:string[]=[];if(!m.mappingId.trim())e.push('mappingId is required');if(!m.themeNodeId.trim())e.push('Theme parent context is required');if(!m.subThemeId.trim())e.push('subThemeId is required');if(!m.evidenceIds.length)e.push('Sub-Theme mapping requires evidence');if(!m.provenance.length)e.push('Sub-Theme mapping requires provenance');if(m.methodologyVersion!==STM_METHODOLOGY_VERSION)e.push('STM methodologyVersion mismatch');if(m.themeNodeId===m.subThemeId)e.push('Sub-Theme cannot self-map to its Theme parent');for(const p of m.provenance){const r=validateProvenance(p);if(!r.valid)e.push(...r.errors);}return[...new Set(e)];}
export function supportsMultipleSubThemes(m:readonly SubThemeMapping[]):boolean{return new Set(m.map(x=>x.subThemeId)).size>1;}
export function supportsOverlap(m:readonly SubThemeMapping[]):boolean{return m.some(x=>x.relationship==='OVERLAPPING');}
export function canDiscoverStocksFromSubTheme(id:string):boolean{return id.trim().length>0;}
export function isRotationSectorOrSubSectorLabel(label:string):boolean{return ['SECTOR','SUB-SECTOR','SUB_SECTOR'].includes(label.trim().toUpperCase());}
export function validateSubThemeDiscovery(id:string,industryId:string|null):string[]{const e:string[]=[];if(!canDiscoverStocksFromSubTheme(id))e.push('Sub-Theme context is required');if(industryId!==null&&!industryId.trim())e.push('industryId must be null or non-empty');return e;}
