/** CHUNK 7 — THEME-INPUT-1.1 progressive navigation contract. */
import { THEME_HIERARCHY, type ThemeLevel } from './types.ts';
export const STOCK_RETRIEVAL_SCOPE_LEVELS:readonly ThemeLevel[]=['THEME','SUB_THEME','INDUSTRY','VALUE_CHAIN','COMPANY'];
export function canRetrieveStocksAtLevel(level:ThemeLevel):boolean{return STOCK_RETRIEVAL_SCOPE_LEVELS.includes(level);}
export function validateNavigationScope(level:ThemeLevel,nodeId:string):string[]{
 const errors:string[]=[]; if(!THEME_HIERARCHY.includes(level)) errors.push('invalid theme navigation level');
 if(!nodeId.trim()) errors.push('resolved navigation nodeId is required');
 if(!canRetrieveStocksAtLevel(level)) errors.push('STOCK is an instrument leaf, not a stock-retrieval parent scope');
 return [...new Set(errors)];
}
export function assertNoFabricatedParentContext(requestedLevel:ThemeLevel,resolvedParentIds:readonly string[]):string[]{
 const expectedDepth=THEME_HIERARCHY.indexOf(requestedLevel); if(expectedDepth<=0) return [];
 return resolvedParentIds.length>=expectedDepth?[]:[`${requestedLevel} navigation requires resolved parent context`];
}
