import type { MarketDataProvider } from '../providers/marketDataProvider.ts';
import { Dars12Engine, type Dars12RunResult } from './dars12Engine.ts';
import { fetchDarsEvents } from './providerDarsBoundary.ts';
import { PrismaDarsEvidenceStore } from './prismaDarsEvidenceStore.ts';
import { PrismaDarsRunStore } from './prismaDarsRunStore.ts';

export interface Dars12OrchestrationInput {
  provider: MarketDataProvider;
  symbols: readonly string[];
  runKnowledgeTime: number;
  expectedCoverage?: number;
  formulaVersion: string;
  formula: (evidence: readonly import('./dars12Engine.ts').DarsEvidence[]) => string;
  evidenceRefreshSucceeded?: boolean;
  fwhyDiagnostics?: (evidence: readonly import('./dars12Engine.ts').DarsEvidence[]) => Promise<Record<string, unknown>> | Record<string, unknown>;
  provenanceAudit?: (evidence: readonly import('./dars12Engine.ts').DarsEvidence[]) => Promise<Record<string, unknown>> | Record<string, unknown>;
  healthReport?: (result: Dars12RunResult, diagnostics: Record<string, unknown>) => Promise<Record<string, unknown>> | Record<string, unknown>;
}

export interface Dars12OrchestrationResult {
  result: Dars12RunResult;
  persistedEvidence: number;
}

export async function runDars12Production(
  prisma: ConstructorParameters<typeof PrismaDarsRunStore>[0],
  input: Dars12OrchestrationInput,
  engine: Dars12Engine = new Dars12Engine(),
): Promise<Dars12OrchestrationResult> {
  const startedAt = Date.now();
  const fetch = await fetchDarsEvents(input.provider, input.symbols, input.runKnowledgeTime);
  const runStore = new PrismaDarsRunStore(prisma);
  const evidenceStore = new PrismaDarsEvidenceStore(prisma);

  await runStore.start({
    runId: `DARS12-${input.runKnowledgeTime}`,
    knowledgeTime: input.runKnowledgeTime,
    providerHealthy: fetch.providerHealthy,
    startedAt,
  });

  let result: Dars12RunResult;
  try {
    if (!input.fwhyDiagnostics || !input.provenanceAudit || !input.healthReport) {
      throw new Error('DARS production integrations are not fully configured: FWHY diagnostics, provenance audit, and health report are required');
    }

    result = engine.run({
      runKnowledgeTime: input.runKnowledgeTime,
      providerHealthy: fetch.providerHealthy,
      rawEvents: fetch.events,
      evidenceRefreshSucceeded: input.evidenceRefreshSucceeded ?? true,
      expectedCoverage: input.expectedCoverage,
      formulaVersion: input.formulaVersion,
      formula: input.formula,
    });

    const fwhy = await input.fwhyDiagnostics(result.evidence);
    const provenance = await input.provenanceAudit(result.evidence);
    const health = await input.healthReport(result, fwhy);
    const enrichedResult = { ...result, stageEvents: result.stageEvents.map((event) => ({ ...event })), errors: result.errors };
    const persistedEvidence = result.healthy && result.ready ? result.evidence.length : 0;
    await prisma.$transaction(async (tx) => {
      if (result.healthy && result.ready) {
        for (const evidence of result.evidence) {
          await evidenceStore.upsertEvidenceWithClient(tx, evidence);
        }
      }
      await runStore.completeWithClient(tx, { ...enrichedResult, errors: [...enrichedResult.errors, `FWHY_DIAGNOSTICS:${JSON.stringify(fwhy)}`, `PROVENANCE_AUDIT:${JSON.stringify(provenance)}`, `HEALTH_REPORT:${JSON.stringify(health)}`] }, Date.now());
    });
    return { result, persistedEvidence };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown orchestration failure';
    const failed: Dars12RunResult = {
      runId: `DARS12-${input.runKnowledgeTime}`,
      stageEvents: [],
      evidence: [],
      formulaOutput: null,
      formulaExecuted: false,
      duplicateSourceEventIds: [],
      truthState: 'BLOCKED',
      ready: false,
      healthy: false,
      errors: [...fetch.errors, message],
    };
    await runStore.complete(failed, Date.now());
    throw error;
  }
}
