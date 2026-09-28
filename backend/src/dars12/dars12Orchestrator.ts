import type { MarketDataProvider } from '../providers/marketDataProvider.ts';
import { Dars12Engine, type Dars12RunResult } from './dars12Engine.ts';
import { fetchDarsEvents } from './providerDarsBoundary.ts';
import { PrismaDarsEvidenceStore } from './prismaDarsEvidenceStore.ts';
import { PrismaDarsRunStore } from './prismaDarsRunStore.ts';
import { PrismaDarsHealthReportStore } from './prismaDarsHealthReportStore.ts';
import { buildAuditEntry, PrismaAuditLogStore } from '../security/auditLogger.ts';
import { runFwhyDiagnostics } from './fwhyDiagnostics.ts';

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
  const healthStore = new PrismaDarsHealthReportStore(prisma);

  await runStore.start({
    runId: `DARS12-${input.runKnowledgeTime}`,
    knowledgeTime: input.runKnowledgeTime,
    providerHealthy: fetch.providerHealthy,
    startedAt,
  });

  let result: Dars12RunResult;
  try {
    result = engine.run({
      runKnowledgeTime: input.runKnowledgeTime,
      providerHealthy: fetch.providerHealthy,
      rawEvents: fetch.events,
      evidenceRefreshSucceeded: input.evidenceRefreshSucceeded ?? true,
      expectedCoverage: input.expectedCoverage,
      formulaVersion: input.formulaVersion,
      formula: input.formula,
    });

    const fwhy = await (input.fwhyDiagnostics ?? ((evidence) => runFwhyDiagnostics(evidence) as unknown as Record<string, unknown>))(result.evidence);
    const provenance = await (input.provenanceAudit ?? ((evidence) => ({
      engine: 'DARS12-PROVENANCE-1.0',
      evidenceCount: evidence.length,
      evidenceKeys: evidence.map(e => e.evidenceKey).sort(),
    })))(result.evidence);
    const health = await (input.healthReport ?? ((run, diagnostics) => ({
      engine: 'DARS12-HEALTH-1.0',
      runId: run.runId,
      truthState: run.truthState,
      ready: run.ready,
      healthy: run.healthy,
      formulaExecuted: run.formulaExecuted,
      diagnostics,
    })))(result, fwhy);
    const persistedEvidence = result.healthy && result.ready ? result.evidence.length : 0;
    await prisma.$transaction(async (tx) => {
      if (result.healthy && result.ready) {
        for (const evidence of result.evidence) {
          await evidenceStore.upsertEvidenceWithClient(tx, evidence);
        }
      }
      await new PrismaAuditLogStore(tx).append(buildAuditEntry('SYSTEM', null, 'DARS12_PROVENANCE_AUDIT', result.runId, provenance));
      await healthStore.writeWithClient(tx, {
        reportId: `HEALTH-${result.runId}`,
        runId: result.runId,
        knowledgeTime: input.runKnowledgeTime,
        status: result.healthy ? 'HEALTHY' : 'BLOCKED',
        report: { ...health, fwhyDiagnostics: fwhy },
      });
      await runStore.completeWithClient(tx, result, Date.now());
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
