/**
 * CHUNK 5 — deterministic restatement lifecycle.
 *
 * A restatement creates a new version for the same metric/period and may
 * supersede exactly one prior version. Selection is explicit: the terminal
 * non-superseded version is the current canonical version.
 */
export interface RestatementVersion {
  id: string;
  metric: string;
  periodStart: string | null;
  periodEnd: string | null;
  reportedDate: string | null;
  restatementId: string | null;
  supersedesRestatementId: string | null;
}

export function validateRestatementChain(
  versions: RestatementVersion[],
): string[] {
  const errors: string[] = [];
  const byId = new Map<string, RestatementVersion>();

  for (const version of versions) {
    if (!version.id.trim()) errors.push('restatement version id is required');
    if (byId.has(version.id)) errors.push(`duplicate restatement version: ${version.id}`);
    byId.set(version.id, version);
  }

  for (const version of versions) {
    if (version.supersedesRestatementId === null) continue;
    if (version.supersedesRestatementId === version.id) {
      errors.push(`restatement version cannot supersede itself: ${version.id}`);
      continue;
    }
    const prior = byId.get(version.supersedesRestatementId);
    if (!prior) {
      errors.push(
        `superseded restatement version not found: ${version.supersedesRestatementId}`,
      );
      continue;
    }
    if (prior.metric !== version.metric ||
        prior.periodStart !== version.periodStart ||
        prior.periodEnd !== version.periodEnd) {
      errors.push(
        `restatement version ${version.id} does not match the superseded metric/period`,
      );
    }
  }

  return errors;
}

export function selectCurrentRestatement(
  versions: RestatementVersion[],
): RestatementVersion | null {
  if (versions.length === 0) return null;

  const superseded = new Set(
    versions
      .map((version) => version.supersedesRestatementId)
      .filter((id): id is string => id !== null),
  );

  const candidates = versions.filter((version) => !superseded.has(version.id));
  if (candidates.length !== 1) return null;

  return candidates[0];
}
