/** CHUNK 7 — TIE-TEST-1.0 deterministic integration/independence checks. */
import { validateProvenance, type Provenance } from '../contracts/provenance.ts';
import { validateThemeAggregationItem } from './themeAggregation.ts';
import { validateStockThemeRelationship } from './stockThemeRelationship.ts';

export const TIE_TEST_METHODOLOGY_VERSION='TIE-TEST-1.0';
export interface ThemeTestFixture{fixtureId:string;hierarchy:string[];valueChainStages:string[];currentExposureIds:string[];futureExposureIds:string[];companyIds:string[];stockIds:string[];relationshipIds:string[];evidenceIds:string[];provenance:Provenance[];methodologyVersions:string[];}
export function validateThemeTestFixture(f:ThemeTestFixture):string[]{const e:string[]=[];if(!f.fixtureId.trim())e.push('fixtureId is required');if(f.hierarchy.join('→')!=='THEME→SUB_THEME→INDUSTRY→VALUE_CHAIN→COMPANY→STOCK')e.push('canonical hierarchy mismatch');if(f.valueChainStages.length===0)e.push('value chain stages are required');if(f.currentExposureIds.length===0)e.push('current exposure is required');if(f.futureExposureIds.length===0)e.push('future exposure is required');if(f.companyIds.length===0)e.push('company resolution is required');if(f.stockIds.length===0)e.push('stock resolution is required');if(f.relationshipIds.length===0)e.push('relationship is required');if(f.evidenceIds.length===0)e.push('evidence is required');if(f.provenance.length===0)e.push('provenance is required');for(const p of f.provenance){const r=validateProvenance(p);if(!r.valid)e.push(...r.errors);}return[...new Set(e)];}

export function runIndependenceCheck<T>(base:T,changed:T):boolean{return JSON.stringify(base)===JSON.stringify(changed);}

/** Execute the real Theme builder twice while changing one external engine input. */
export function rotationChangeMustNotChangeThemeIntelligence<TTheme,TRotation>(buildTheme:(inputs:{rotation:TRotation})=>TTheme,baseRotation:TRotation,changedRotation:TRotation):boolean{return runIndependenceCheck(buildTheme({rotation:baseRotation}),buildTheme({rotation:changedRotation}));}
export function stockScoreChangeMustNotChangeThemeIntelligence<TTheme,TScore>(buildTheme:(inputs:{stockScore:TScore})=>TTheme,baseScore:TScore,changedScore:TScore):boolean{return runIndependenceCheck(buildTheme({stockScore:baseScore}),buildTheme({stockScore:changedScore}));}
export function oceChangeMustNotChangeThemeIntelligence<TTheme,TOCE>(buildTheme:(inputs:{oce:TOCE})=>TTheme,baseOCE:TOCE,changedOCE:TOCE):boolean{return runIndependenceCheck(buildTheme({oce:baseOCE}),buildTheme({oce:changedOCE}));}
export function shariahChangeMustNotChangeThemeIntelligence<TTheme,TShariah>(buildTheme:(inputs:{shariah:TShariah})=>TTheme,baseShariah:TShariah,changedShariah:TShariah):boolean{return runIndependenceCheck(buildTheme({shariah:baseShariah}),buildTheme({shariah:changedShariah}));}

/** Execute the real downstream builder twice while changing Theme output. */
export function themeChangeMustNotChangeStockScoreOrRotation<TExternal,TTheme>(buildExternal:(inputs:{theme:TTheme})=>TExternal,baseTheme:TTheme,changedTheme:TTheme):boolean{return runIndependenceCheck(buildExternal({theme:baseTheme}),buildExternal({theme:changedTheme}));}

export function isPOCLRepresentativeFixture(fixture:ThemeTestFixture|string):boolean{return typeof fixture==='string'?fixture==='POCL':fixture.fixtureId==='POCL'&&validateThemeTestFixture(fixture).length===0;}
export {validateThemeAggregationItem,validateStockThemeRelationship};
