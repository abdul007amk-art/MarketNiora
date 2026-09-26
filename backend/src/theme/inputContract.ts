/** CHUNK 7 — THEME-INPUT-1.1 input and parent-context validation. */
import { validateProvenance } from '../contracts/provenance.ts';
import { THEME_HIERARCHY, THEME_INPUT_METHODOLOGY_VERSION, type ThemeExposure, type ThemeLevel, type ThemeNode } from './types.ts';
const parentLevel = new Map<ThemeLevel, ThemeLevel|null>([
 ['THEME',null],['SUB_THEME','THEME'],['INDUSTRY','SUB_THEME'],['VALUE_CHAIN','INDUSTRY'],['COMPANY','VALUE_CHAIN'],['STOCK','COMPANY'],
]);
export function validateThemeNode(node:ThemeNode):string[] {
 const errors:string[]=[];
 if(!node.nodeId.trim()) errors.push('nodeId is required');
 if(!node.name.trim()) errors.push('node name is required');
 if(!THEME_HIERARCHY.includes(node.level)) errors.push('invalid theme hierarchy level');
 if(node.methodologyVersion!==THEME_INPUT_METHODOLOGY_VERSION) errors.push('theme input methodologyVersion mismatch');
 const requiredParent=parentLevel.get(node.level);
 if(requiredParent===null && node.parentNodeId!==null) errors.push('THEME cannot have a fabricated parent');
 if(requiredParent!==null && !node.parentNodeId?.trim()) errors.push(`${node.level} requires valid parent context: ${requiredParent}`);
 return [...new Set(errors)];
}
export function validateThemeParentContext(childLevel:ThemeLevel,parentLevelProvided:ThemeLevel|null,parentNodeId:string|null):string[] {
 const errors:string[]=[]; const required=parentLevel.get(childLevel);
 if(required===null){ if(parentLevelProvided!==null||parentNodeId!==null) errors.push('THEME does not accept parent context'); return errors; }
 if(parentLevelProvided!==required) errors.push(`${childLevel} requires ${required} parent context`);
 if(!parentNodeId?.trim()) errors.push(`${childLevel} requires a non-empty parentNodeId`);
 return [...new Set(errors)];
}
export function validateThemeExposure(exposure:ThemeExposure):string[] {
 const errors:string[]=[];
 if(!exposure.exposureId.trim()) errors.push('exposureId is required');
 if(!exposure.themeNodeId.trim()) errors.push('themeNodeId is required');
 if(!exposure.stockId.trim()) errors.push('stockId is required');
 if(exposure.companyId!==null&&!exposure.companyId.trim()) errors.push('companyId must be null or non-empty');
 if(exposure.evidenceIds.length===0) errors.push('theme exposure requires evidence');
 if(exposure.provenance.length===0) errors.push('theme exposure requires provenance');
 if(exposure.methodologyVersion!==THEME_INPUT_METHODOLOGY_VERSION) errors.push('theme exposure methodologyVersion mismatch');
 for(const provenance of exposure.provenance){ const result=validateProvenance(provenance); if(!result.valid) errors.push(...result.errors); }
 return [...new Set(errors)];
}
