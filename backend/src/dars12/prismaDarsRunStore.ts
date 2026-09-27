import type { Prisma, PrismaClient } from '@prisma/client';
import type { Dars12RunResult } from './dars12Engine.ts';

export interface DarsRunStart {
  runId: string;
  knowledgeTime: number;
  providerHealthy: boolean;
  startedAt: number;
}

function dateFromEpoch(ms: number): Date {
  const d = new Date(ms);
  if (!Number.isFinite(ms) || Number.isNaN(d.getTime())) throw new Error('invalid DARS run timestamp');
  return d;
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

/**
 * Durable run ledger for DARS-1.2 orchestration.
 * The engine remains pure/in-memory; this store persists the run boundary and
 * final stage/result state without changing any protected DARS-1.1 engine.
 */
export class PrismaDarsRunStore {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async start(input: DarsRunStart): Promise<void> {
    if (!input.runId.trim()) throw new Error('runId is required');
    await this.prisma.darsRun.create({
      data: {
        runId: input.runId,
        knowledgeTime: dateFromEpoch(input.knowledgeTime),
        status: 'RUNNING',
        providerHealthy: input.providerHealthy,
        ready: false,
        healthy: false,
        truthState: 'BLOCKED',
        formulaExecuted: false,
        startedAt: dateFromEpoch(input.startedAt),
        stageEvents: json([]),
        errors: json([]),
        duplicateSourceEventIds: json([]),
      },
    });
  }

  async complete(result: Dars12RunResult, completedAt: number): Promise<void> {
    await this.prisma.darsRun.update({
      where: { runId: result.runId },
      data: {
        status: result.healthy ? 'SUCCESS' : (result.ready ? 'PARTIAL' : 'FAILURE'),
        ready: result.ready,
        healthy: result.healthy,
        truthState: result.truthState,
        formulaExecuted: result.formulaExecuted,
        completedAt: dateFromEpoch(completedAt),
        stageEvents: json(result.stageEvents),
        errors: json(result.errors),
        duplicateSourceEventIds: json(result.duplicateSourceEventIds),
      },
    });
  }
}
