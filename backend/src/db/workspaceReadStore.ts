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
}

/**
 * Read-only queries for the public research UI. This store is only selected
 * when the existing database target guard accepts the approved NON_PROD DB.
 * It never imports staged rows or manufactures scores/mappings.
 */
export class PrismaWorkspaceReadStore implements WorkspaceReadStore {
  constructor(private readonly prisma: PrismaClient) {}

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
        score.finalScore !== null &&
        score.formulaVersion.version === 'SS-1.0-R3' &&
        score.formulaVersion.lockedAt !== null &&
        score.formulaVersion.ownerApprovedAt !== null
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
      row.formulaVersion.lockedAt !== null &&
      row.formulaVersion.ownerApprovedAt !== null &&
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
}
