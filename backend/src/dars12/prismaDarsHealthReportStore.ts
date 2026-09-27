import type { Prisma, PrismaClient } from '@prisma/client';

export interface DarsHealthReportInput {
  reportId: string;
  runId: string;
  knowledgeTime: number;
  status: string;
  report: Record<string, unknown>;
}

function dateFromEpoch(ms: number): Date {
  const d = new Date(ms);
  if (!Number.isFinite(ms) || Number.isNaN(d.getTime())) throw new Error('invalid DARS health report timestamp');
  return d;
}

export class PrismaDarsHealthReportStore {
  private readonly prisma: PrismaClient;
  constructor(prisma: PrismaClient) { this.prisma = prisma; }

  async write(input: DarsHealthReportInput): Promise<void> {
    if (!input.reportId.trim() || !input.runId.trim()) throw new Error('health report identity is required');
    await this.prisma.darsHealthReport.create({
      data: {
        reportId: input.reportId,
        runId: input.runId,
        knowledgeTime: dateFromEpoch(input.knowledgeTime),
        status: input.status,
        report: input.report as Prisma.InputJsonValue,
      },
    });
  }

  async writeWithClient(client: PrismaClient | Prisma.TransactionClient, input: DarsHealthReportInput): Promise<void> {
    if (!input.reportId.trim() || !input.runId.trim()) throw new Error('health report identity is required');
    await client.darsHealthReport.create({
      data: {
        reportId: input.reportId,
        runId: input.runId,
        knowledgeTime: dateFromEpoch(input.knowledgeTime),
        status: input.status,
        report: input.report as Prisma.InputJsonValue,
      },
    });
  }
}
