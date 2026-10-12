import type { Prisma, PrismaClient } from '@prisma/client';
import type { DarsEvidence } from './dars12Engine.ts';

function dateFromEpoch(ms: number): Date {
  const d = new Date(ms);
  if (!Number.isFinite(ms) || Number.isNaN(d.getTime())) throw new Error('invalid DARS evidence timestamp');
  return d;
}

function epochFromDate(d: Date): number { return d.getTime(); }

type StoredDarsEvidence = {
  evidenceKey: string;
  sourceEventId: string;
  source: string;
  symbol: string;
  value: string;
  sourceTimestamp: Date;
  effectiveTime: Date;
  knowledgeTime: Date;
  verificationStatus: string;
  dataNature: string;
  formulaVersion: string | null;
  origin: string | null;
  refreshedAt: Date;
  truthState: string;
};

export class PrismaDarsEvidenceStore {
  private readonly prisma: PrismaClient;
  constructor(prisma: PrismaClient) { this.prisma = prisma; }

  async upsertEvidence(e: DarsEvidence): Promise<boolean> {
    return this.upsertEvidenceWithClient(this.prisma, e);
  }

  async upsertEvidenceWithClient(client: PrismaClient | Prisma.TransactionClient, e: DarsEvidence): Promise<boolean> {
    const existing = await client.darsEvidence.findUnique({ where: { sourceEventId: e.sourceEventId } });
    if (existing) {
      const samePayload =
        existing.source === e.source &&
        existing.symbol === e.symbol &&
        existing.value === e.value &&
        epochFromDate(existing.sourceTimestamp) === e.sourceTimestamp &&
        epochFromDate(existing.effectiveTime) === e.effectiveTime &&
        epochFromDate(existing.knowledgeTime) === e.knowledgeTime &&
        existing.verificationStatus === e.verificationStatus &&
        existing.dataNature === e.dataNature &&
        existing.formulaVersion === e.formulaVersion &&
        existing.origin === (e.origin ?? null);
      if (!samePayload) throw new Error('conflicting source_event_id replay rejected');
      await client.darsEvidence.update({
        where: { sourceEventId: e.sourceEventId },
        data: { refreshedAt: dateFromEpoch(e.refreshedAt), truthState: 'CURRENT' },
      });
      return false;
    }

    await client.darsEvidence.create({
      data: {
        sourceEventId: e.sourceEventId,
        evidenceKey: e.evidenceKey,
        source: e.source,
        symbol: e.symbol,
        value: e.value,
        sourceTimestamp: dateFromEpoch(e.sourceTimestamp),
        effectiveTime: dateFromEpoch(e.effectiveTime),
        knowledgeTime: dateFromEpoch(e.knowledgeTime),
        verificationStatus: e.verificationStatus,
        dataNature: e.dataNature,
        formulaVersion: e.formulaVersion,
        origin: e.origin ?? null,
        refreshedAt: dateFromEpoch(e.refreshedAt),
        truthState: e.truthState,
      },
    });
    return true;
  }

  private fromRow(row: StoredDarsEvidence): DarsEvidence {
    return {
      evidenceKey: row.evidenceKey,
      sourceEventId: row.sourceEventId,
      source: row.source,
      symbol: row.symbol,
      value: row.value,
      sourceTimestamp: epochFromDate(row.sourceTimestamp),
      effectiveTime: epochFromDate(row.effectiveTime),
      knowledgeTime: epochFromDate(row.knowledgeTime),
      verificationStatus: row.verificationStatus as DarsEvidence['verificationStatus'],
      dataNature: row.dataNature as DarsEvidence['dataNature'],
      formulaVersion: row.formulaVersion,
      origin: row.origin as DarsEvidence['origin'],
      refreshedAt: epochFromDate(row.refreshedAt),
      truthState: row.truthState as DarsEvidence['truthState'],
    };
  }

  /** All durable rows are required to restore event identity and point-in-time history before each run. */
  async allEvidence(): Promise<DarsEvidence[]> {
    const rows = await this.prisma.darsEvidence.findMany({
      orderBy: [
        { evidenceKey: 'asc' },
        { knowledgeTime: 'asc' },
        { sourceEventId: 'asc' },
      ],
    });
    return rows.map((row) => this.fromRow(row as StoredDarsEvidence));
  }

  async currentEvidence(asOfKnowledgeTime: number): Promise<DarsEvidence[]> {
    const rows = await this.prisma.darsEvidence.findMany({
      where: { knowledgeTime: { lte: dateFromEpoch(asOfKnowledgeTime) } },
      orderBy: [{ evidenceKey: 'asc' }, { knowledgeTime: 'desc' }, { sourceEventId: 'desc' }],
    });
    const selected = new Map<string, DarsEvidence>();
    for (const row of rows) {
      const evidence = this.fromRow(row as StoredDarsEvidence);
      if (evidence.knowledgeTime > asOfKnowledgeTime) continue;
      if (selected.has(evidence.evidenceKey)) continue;
      selected.set(evidence.evidenceKey, evidence);
    }
    return [...selected.values()].sort((a, b) => a.evidenceKey.localeCompare(b.evidenceKey));
  }
}
