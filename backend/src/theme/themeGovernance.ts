/** CHUNK 7 — TIE-GOV-1.0 governance, audit and lock gate. */
export const TIE_GOV_METHODOLOGY_VERSION = 'TIE-GOV-1.0';

export type AuditSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ThemeAuditFinding {
  findingId: string;
  severity: AuditSeverity;
  part: string;
  rule: string;
  rationale: string;
  patchRequired: string;
}

export interface ThemeAuditResult {
  findings: ThemeAuditFinding[];
  verdict: 'LOCK READY' | 'PATCH REQUIRED';
}

export function evaluateThemeAudit(findings: ThemeAuditFinding[]): ThemeAuditResult {
  return {
    findings: [...findings],
    verdict: findings.length === 0 ? 'LOCK READY' : 'PATCH REQUIRED',
  };
}

/** Locking requires an independent audit with zero findings at every severity. */
export function isLockReadyAfterIndependentAudit(
  findings: ThemeAuditFinding[],
  independentAuditCompleted: boolean,
): boolean {
  return independentAuditCompleted && findings.length === 0;
}

/** Individual Parts must not be treated as locked before the integrated audit. */
export function individualPartCanBeLockedBeforeIntegratedAudit(): boolean {
  return false;
}

/** Locked methodology changes require a new methodology version. */
export function methodologyChangeRequiresNewVersion(): boolean {
  return true;
}

/** Governance preserves no-silent-overwrite and no-fabrication requirements. */
export function governanceRequiresNoSilentOverwriteAndNoFabrication(): boolean {
  return true;
}
