/** CHUNK 7 — TIE-GOV-1.0 governance, audit and lock gate. */
export const TIE_GOV_METHODOLOGY_VERSION='TIE-GOV-1.0';
export type AuditSeverity='CRITICAL'|'HIGH'|'MEDIUM'|'LOW';
export interface ThemeAuditFinding{findingId:string;severity:AuditSeverity;part:string;rule:string;rationale:string;patchRequired:string;}
export interface ThemeAuditResult{findings:ThemeAuditFinding[];counts:Record<AuditSeverity,number>;verdict:'LOCK READY'|'PATCH REQUIRED';}
export function evaluateThemeAudit(findings:ThemeAuditFinding[]):ThemeAuditResult{
 const counts:Record<AuditSeverity,number>={CRITICAL:0,HIGH:0,MEDIUM:0,LOW:0};for(const f of findings)counts[f.severity]++;
 return {findings:[...findings],counts,verdict:Object.values(counts).every(v=>v===0)?'LOCK READY':'PATCH REQUIRED'};
}
export function isLockReadyAfterIndependentAudit(findings:ThemeAuditFinding[],independentAuditCompleted:boolean):boolean{const r=evaluateThemeAudit(findings);return independentAuditCompleted&&r.counts.CRITICAL===0&&r.counts.HIGH===0&&r.counts.MEDIUM===0&&r.counts.LOW===0;}
export function individualPartCanBeLockedBeforeIntegratedAudit():boolean{return false;}
export function methodologyChangeRequiresNewVersion():boolean{return true;}
export function governanceRequiresNoSilentOverwriteAndNoFabrication():boolean{return true;}
