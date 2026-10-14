import type { Prisma, PrismaClient } from '@prisma/client';
import { isRotationAggregationLevel, meetsRotationConfidenceGate } from '../rotation/aggregationGate.ts';

export interface WorkspaceSummary {
  canonicalStocks: number;
  sectors: number;
  subSectors: number;
  stockGroups: number;
  themes: number;
  verifiedThemeMemberships: number;
  verifiedValueChainEvidence: number;
  verifiedObservations: number;
}

export interface StockSearchOptions {
  query?: string;
  sector?: string;
  limit: number;
}

export interface WorkspaceReadStore {
  getSummary(): Promise<WorkspaceSummary>;
  searchStocks(options: StockSearchOptions): Promise<{ total: number; items: Array<Record<string, unknown>> }>;
  getRotation(horizon: string, limit: number): Promise<{ items: Array<Record<string, unknown>> }>;
  getThemes(query: string, limit: number): Promise<{ items: Array<Record<string, unknown>> }>;
  getCompany(symbol: string, exchange?: string): Promise<Record<string, unknown>>;
  getValueChain(symbol: string, exchange?: string): Promise<Record<string, unknown>>;
  getFundamentals(symbol: string, exchange?: string, limit?: number): Promise<Record<string, unknown>>;
  getResearchEvidence(symbol: string, exchange?: string, limit?: number): Promise<Record<string, unknown>>;
}

type CanonicalIdentity =
  | { truthState: 'FOUND'; stock: { stockId: string; name: string; symbol: string; exchange: string } }
  | { truthState: 'NOT_FOUND' }
  | { truthState: 'AMBIGUOUS'; candidates: Array<{ name: string; symbol: string; exchange: string }> };

function isApprovedStockScoreFormula(formula: { formulaKey: string; version: string; lockedAt: Date | null; ownerApprovedAt: Date | null }): boolean {
  const key = formula.formulaKey.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return formula.version === 'SS-1.0-R3' &&
    (key.includes('STOCKSCORE') || key.includes('SS10R3')) &&
    formula.lockedAt !== null && formula.ownerApprovedAt !== null;
}

function isApprovedRotationFormula(formula: { formulaKey: string; version: string; lockedAt: Date | null; ownerApprovedAt: Date | null }): boolean {
  const key = formula.formulaKey.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const version = formula.version.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return key.includes('ROTATION') &&
    (version === 'V12' || version.endsWith('V12')) &&
    formula.lockedAt !== null && formula.ownerApprovedAt !== null;
}

/**
 * Read-only queries for the public research UI. This store is only selected
 * when the existing database target guard accepts the approved NON_PROD DB.
 * It never imports staged rows or manufactures scores/mappings.
 */
export class PrismaWorkspaceReadStore implements WorkspaceReadStore {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  private async resolveCanonicalStock(symbol: string, exchange?: string): Promise<CanonicalIdentity> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const where: Prisma.CanonicalStockWhereInput = {
      symbol: { equals: normalizedSymbol, mode: 'insensitive' },
    };
    if (exchange) where.exchange = exchange;

    const rows = await this.prisma.canonicalStock.findMany({
      where,
      take: 2,
      select: { stockId: true, name: true, symbol: true, exchange: true },
    });
    if (rows.length === 0) return { truthState: 'NOT_FOUND' };
    if (rows.length > 1) {
      return {
        truthState: 'AMBIGUOUS',
        candidates: rows.map(({ name, symbol: rowSymbol, exchange: rowExchange }) => ({
          name, symbol: rowSymbol, exchange: rowExchange,
        })),
      };
    }
    return { truthState: 'FOUND', stock: rows[0] };
  }

  private observationSymbolWhere(symbol: string, exchange: string): Prisma.DarsEvidenceWhereInput {
    const values = new Set([
      symbol,
      exchange + ':' + symbol,
      exchange + '_' + symbol,
      exchange + '|' + symbol,
    ]);
    return {
      OR: [...values].map((value) => ({
        symbol: { equals: value, mode: 'insensitive' as const },
      })),
    };
  }

  async getSummary(): Promise<WorkspaceSummary> {
    const [
      canonicalStocks,
      sectors,
      subSectors,
      stockGroups,
      themes,
      verifiedThemeMemberships,
      verifiedValueChainEvidence,
      verifiedObservations,
    ] = await Promise.all([
      this.prisma.canonicalStock.count(),
      this.prisma.sector.count(),
      this.prisma.subSector.count(),
      this.prisma.stockGroup.count(),
      this.prisma.theme.count(),
      this.prisma.stockThemeMembership.count({ where: { verifiedAt: { not: null } } }),
      this.prisma.valueChainEvidence.count({ where: { verification: 'VERIFIED' } }),
      this.prisma.rawStockObservation.count({
        where: { verificationStatus: 'VERIFIED', interpretationStatus: 'INTERPRETABLE' },
      }),
    ]);

    return {
      canonicalStocks,
      sectors,
      subSectors,
      stockGroups,
      themes,
      verifiedThemeMemberships,
      verifiedValueChainEvidence,
      verifiedObservations,
    };
  }

  async searchStocks(options: StockSearchOptions): Promise<{ total: number; items: Array<Record<string, unknown>> }> {
    const where: Prisma.CanonicalStockWhereInput = {};
    if (options.query) {
      where.OR = [
        { name: { contains: options.query, mode: 'insensitive' } },
        { symbol: { contains: options.query, mode: 'insensitive' } },
      ];
    }
    if (options.sector) {
      where.sector = { contains: options.sector, mode: 'insensitive' };
    }

    const [total, rows] = await Promise.all([
      this.prisma.canonicalStock.count({ where }),
      this.prisma.canonicalStock.findMany({
        where,
        orderBy: [{ sector: 'asc' }, { subSector: 'asc' }, { name: 'asc' }],
        take: options.limit,
        select: {
          stockId: true,
          name: true,
          symbol: true,
          exchange: true,
          sector: true,
          subSector: true,
          classification: {
            select: {
              verifiedAt: true,
              source: true,
              subSector: { select: { name: true, sector: { select: { name: true } } } },
            },
          },
          stockScores: {
            orderBy: { calculatedAt: 'desc' },
            take: 10,
            select: {
              finalScore: true,
              confidence: true,
              calculatedAt: true,
              formulaVersion: {
                select: { formulaKey: true, version: true, lockedAt: true, ownerApprovedAt: true },
              },
            },
          },
          shariahStatus: { select: { status: true } },
        },
      }),
    ]);

    const items = rows.map((row) => {
      const officialScore = row.stockScores.find((score) =>
        score.finalScore !== null && isApprovedStockScoreFormula(score.formulaVersion)
      );
      const verifiedClassification = row.classification?.verifiedAt != null;
      const sectorName = row.sector ?? row.classification?.subSector.sector.name ?? null;
      const subSectorName = row.subSector ?? row.classification?.subSector.name ?? null;

      return {
        stockId: row.stockId,
        name: row.name,
        symbol: row.symbol,
        exchange: row.exchange,
        sector: sectorName,
        subSector: subSectorName,
        classificationStatus: verifiedClassification ? 'VERIFIED' : 'PENDING',
        classificationSource: verifiedClassification ? row.classification?.source ?? null : null,
        stockScore: officialScore ? {
          value: Number(officialScore.finalScore),
          confidence: Number(officialScore.confidence),
          calculatedAt: officialScore.calculatedAt.toISOString(),
          formulaVersion: officialScore.formulaVersion.version,
        } : null,
        stockScoreTruthState: officialScore ? 'VERIFIED' : 'NOT_CONFIGURED',
        // Per the locked display rule, expose only positive verification; do not
        // distinguish or label Non-Shariah and Pending statuses in public UI.
        ...(row.shariahStatus?.status === 'VERIFIED' ? { shariahVerified: true } : {}),
      };
    });

    return { total, items };
  }

  async getRotation(horizon: string, limit: number): Promise<{ items: Array<Record<string, unknown>> }> {
    const candidates = await this.prisma.rotationScore.findMany({
      where: { horizon, finalScore: { not: null } },
      orderBy: { calculatedAt: 'desc' },
      take: Math.min(1000, Math.max(100, limit * 20)),
      select: {
        level: true,
        horizon: true,
        confidence: true,
        state: true,
        finalScore: true,
        calculatedAt: true,
        sector: { select: { name: true } },
        subSector: { select: { name: true, sector: { select: { name: true } } } },
        stockGroup: { select: { name: true } },
        formulaVersion: {
          select: { formulaKey: true, version: true, lockedAt: true, ownerApprovedAt: true },
        },
      },
    });

    const eligible = candidates.filter((row) =>
      isRotationAggregationLevel(row.level) &&
      row.finalScore !== null &&
      isApprovedRotationFormula(row.formulaVersion) &&
      meetsRotationConfidenceGate(row.level, Number(row.confidence))
    );

    const newestPerLevelAndEntity = new Map<string, (typeof eligible)[number]>();
    for (const row of eligible) {
      const entity = row.level === 'SECTOR' ? row.sector?.name
        : row.level === 'SUB_SECTOR' ? row.subSector?.name
          : row.stockGroup?.name;
      if (!entity) continue;
      const key = row.level + ':' + row.horizon + ':' + entity;
      if (!newestPerLevelAndEntity.has(key)) newestPerLevelAndEntity.set(key, row);
    }

    return {
      items: [...newestPerLevelAndEntity.values()].slice(0, limit).map((row) => ({
        level: row.level,
        horizon: row.horizon,
        entity: row.level === 'SECTOR' ? row.sector?.name ?? null
          : row.level === 'SUB_SECTOR' ? row.subSector?.name ?? null
            : row.stockGroup?.name ?? null,
        sector: row.sector?.name ?? row.subSector?.sector.name ?? null,
        score: Number(row.finalScore),
        confidence: Number(row.confidence),
        state: row.state ?? 'UNKNOWN',
        calculatedAt: row.calculatedAt.toISOString(),
        formulaKey: row.formulaVersion.formulaKey,
        formulaVersion: row.formulaVersion.version,
      })),
    };
  }

  async getThemes(query: string, limit: number): Promise<{ items: Array<Record<string, unknown>> }> {
    const where: Prisma.ThemeWhereInput | undefined = query
      ? { name: { contains: query, mode: 'insensitive' } }
      : undefined;
    const themes = await this.prisma.theme.findMany({
      where,
      orderBy: { name: 'asc' },
      take: limit,
      select: {
        themeId: true,
        name: true,
        subThemes: {
          orderBy: { name: 'asc' },
          select: {
            subThemeId: true,
            name: true,
            industries: {
              orderBy: { name: 'asc' },
              select: {
                industryId: true,
                name: true,
                memberships: {
                  where: { verifiedAt: { not: null } },
                  take: 25,
                  select: {
                    stock: { select: { stockId: true, name: true, symbol: true, exchange: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    return {
      items: themes.map((theme) => ({
        themeId: theme.themeId,
        name: theme.name,
        subThemes: theme.subThemes.map((subTheme) => ({
          subThemeId: subTheme.subThemeId,
          name: subTheme.name,
          industries: subTheme.industries.map((industry) => ({
            industryId: industry.industryId,
            name: industry.name,
            verifiedStocks: industry.memberships.map(({ stock }) => stock),
            verifiedStockCountReturned: industry.memberships.length,
          })),
        })),
      })),
    };
  }

  async getCompany(symbol: string, exchange?: string): Promise<Record<string, unknown>> {
    const identity = await this.resolveCanonicalStock(symbol, exchange);
    if (identity.truthState !== 'FOUND') return identity;

    const row = await this.prisma.canonicalStock.findUnique({
      where: { stockId: identity.stock.stockId },
      select: {
        stockId: true,
        name: true,
        symbol: true,
        exchange: true,
        sector: true,
        subSector: true,
        createdAt: true,
        updatedAt: true,
        classification: {
          select: {
            verifiedAt: true,
            source: true,
            subSector: { select: { name: true, sector: { select: { name: true } } } },
          },
        },
        groupMemberships: {
          where: { verifiedAt: { not: null } },
          select: { verifiedAt: true, source: true, group: { select: { name: true } } },
        },
        themeMemberships: {
          where: { verifiedAt: { not: null } },
          select: {
            verifiedAt: true,
            source: true,
            industry: { select: { name: true, subTheme: { select: { name: true, theme: { select: { name: true } } } } } },
          },
        },
        stockScores: {
          orderBy: { calculatedAt: 'desc' },
          take: 10,
          select: {
            finalScore: true,
            confidence: true,
            calculatedAt: true,
            formulaVersion: { select: { formulaKey: true, version: true, lockedAt: true, ownerApprovedAt: true } },
          },
        },
        shariahStatus: { select: { status: true } },
      },
    });
    if (!row) return { truthState: 'NOT_FOUND' };

    const officialScore = row.stockScores.find((score) =>
      score.finalScore !== null && isApprovedStockScoreFormula(score.formulaVersion)
    );
    const classificationVerified = row.classification?.verifiedAt != null;
    return {
      truthState: 'CANONICAL_RECORD_FOUND',
      company: {
        stockId: row.stockId,
        name: row.name,
        symbol: row.symbol,
        exchange: row.exchange,
        sector: row.sector ?? row.classification?.subSector.sector.name ?? null,
        subSector: row.subSector ?? row.classification?.subSector.name ?? null,
        classificationStatus: classificationVerified ? 'VERIFIED' : 'PENDING',
        classificationSource: classificationVerified ? row.classification?.source ?? null : null,
        identityCreatedAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        stockScore: officialScore ? {
          value: Number(officialScore.finalScore),
          confidence: Number(officialScore.confidence),
          calculatedAt: officialScore.calculatedAt.toISOString(),
          formulaKey: officialScore.formulaVersion.formulaKey,
          formulaVersion: officialScore.formulaVersion.version,
        } : null,
        stockScoreTruthState: officialScore ? 'VERIFIED' : 'NOT_CONFIGURED',
        verifiedStockGroups: row.groupMemberships.map((entry) => ({
          name: entry.group.name, verifiedAt: entry.verifiedAt?.toISOString() ?? null,
        })),
        verifiedThemes: row.themeMemberships.map((entry) => ({
          theme: entry.industry.subTheme.theme.name,
          subTheme: entry.industry.subTheme.name,
          industry: entry.industry.name,
          verifiedAt: entry.verifiedAt?.toISOString() ?? null,
        })),
        // Only a positive verified mark can be surfaced; other status labels are omitted.
        ...(row.shariahStatus?.status === 'VERIFIED' ? { shariahVerified: true } : {}),
      },
    };
  }

  async getValueChain(symbol: string, exchange?: string): Promise<Record<string, unknown>> {
    const identity = await this.resolveCanonicalStock(symbol, exchange);
    if (identity.truthState !== 'FOUND') return identity;

    const stages = await this.prisma.valueChainStage.findMany({
      where: { stockId: identity.stock.stockId },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: {
        stageId: true,
        stageName: true,
        updatedAt: true,
        evidence: {
          where: { verification: 'VERIFIED' },
          orderBy: { observedAt: 'desc' },
          take: 50,
          select: {
            evidenceType: true,
            sourceName: true,
            sourceUrl: true,
            observedAt: true,
            claim: true,
            verification: true,
            createdAt: true,
          },
        },
      },
    });
    const verifiedStages = stages.filter((stage) => stage.evidence.length > 0).map((stage) => ({
      stageId: stage.stageId,
      stageName: stage.stageName,
      evidence: stage.evidence.map((item) => ({
        evidenceType: item.evidenceType,
        sourceName: item.sourceName,
        sourceUrl: item.sourceUrl,
        observedAt: item.observedAt?.toISOString() ?? null,
        claim: item.claim,
        verification: item.verification,
        recordedAt: item.createdAt.toISOString(),
      })),
    }));
    return {
      truthState: verifiedStages.length > 0 ? 'VERIFIED_EVIDENCE_AVAILABLE' : 'NO_VERIFIED_EVIDENCE',
      company: identity.stock,
      items: verifiedStages,
      hiddenUnverifiedStageCount: stages.length - verifiedStages.length,
    };
  }

  async getFundamentals(symbol: string, exchange?: string, limit = 50): Promise<Record<string, unknown>> {
    const identity = await this.resolveCanonicalStock(symbol, exchange);
    if (identity.truthState !== 'FOUND') return identity;

    const evidence = await this.prisma.darsEvidence.findMany({
      where: {
        verificationStatus: 'VERIFIED',
        dataNature: { contains: 'FUNDAMENT', mode: 'insensitive' },
        ...this.observationSymbolWhere(identity.stock.symbol.toUpperCase(), identity.stock.exchange.toUpperCase()),
      },
      orderBy: { sourceTimestamp: 'desc' },
      take: limit,
      select: {
        evidenceId: true,
        evidenceKey: true,
        source: true,
        symbol: true,
        value: true,
        sourceTimestamp: true,
        effectiveTime: true,
        knowledgeTime: true,
        verificationStatus: true,
        dataNature: true,
        formulaVersion: true,
        origin: true,
        refreshedAt: true,
        truthState: true,
      },
    });
    return {
      truthState: evidence.length > 0 ? 'VERIFIED_FUNDAMENTAL_EVIDENCE_AVAILABLE' : 'NO_VERIFIED_FUNDAMENTAL_EVIDENCE',
      company: identity.stock,
      items: evidence.map((item) => ({
        evidenceId: item.evidenceId,
        evidenceKey: item.evidenceKey,
        source: item.source,
        symbol: item.symbol,
        value: item.value,
        sourceTimestamp: item.sourceTimestamp.toISOString(),
        effectiveTime: item.effectiveTime.toISOString(),
        knowledgeTime: item.knowledgeTime.toISOString(),
        verificationStatus: item.verificationStatus,
        dataNature: item.dataNature,
        formulaVersion: item.formulaVersion,
        origin: item.origin,
        refreshedAt: item.refreshedAt.toISOString(),
        truthState: item.truthState,
      })),
    };
  }

  async getResearchEvidence(symbol: string, exchange?: string, limit = 50): Promise<Record<string, unknown>> {
    const identity = await this.resolveCanonicalStock(symbol, exchange);
    if (identity.truthState !== 'FOUND') return identity;

    const evidence = await this.prisma.darsEvidence.findMany({
      where: {
        verificationStatus: 'VERIFIED',
        ...this.observationSymbolWhere(identity.stock.symbol.toUpperCase(), identity.stock.exchange.toUpperCase()),
      },
      orderBy: [{ sourceTimestamp: 'desc' }, { knowledgeTime: 'desc' }],
      take: limit,
      select: {
        evidenceId: true,
        evidenceKey: true,
        source: true,
        symbol: true,
        value: true,
        sourceTimestamp: true,
        effectiveTime: true,
        knowledgeTime: true,
        verificationStatus: true,
        dataNature: true,
        formulaVersion: true,
        origin: true,
        truthState: true,
      },
    });
    return {
      truthState: evidence.length > 0 ? 'VERIFIED_EVIDENCE_AVAILABLE' : 'NO_VERIFIED_EVIDENCE',
      company: identity.stock,
      items: evidence.map((item) => ({
        evidenceId: item.evidenceId,
        evidenceKey: item.evidenceKey,
        source: item.source,
        symbol: item.symbol,
        value: item.value,
        sourceTimestamp: item.sourceTimestamp.toISOString(),
        effectiveTime: item.effectiveTime.toISOString(),
        knowledgeTime: item.knowledgeTime.toISOString(),
        verificationStatus: item.verificationStatus,
        dataNature: item.dataNature,
        formulaVersion: item.formulaVersion,
        origin: item.origin,
        truthState: item.truthState,
      })),
    };
  }

}
