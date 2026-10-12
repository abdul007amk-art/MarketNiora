/**
 * PostgreSQL append-only raw quote writer.
 *
 * This is a non-production implementation candidate. The deployed SQL
 * contract requires every raw observation to reference one canonical stock
 * row, so this writer refuses to write if an injected resolver cannot prove
 * exactly one canonical identity with documentary mapping evidence.
 *
 * This writer is intentionally not wired into the default API runtime:
 * the canonical stock master is not imported and provider selection remains
 * governed by D-001. Never bypass the canonical identity requirement.
 */
import { Prisma, type PrismaClient } from '@prisma/client';
import type { Quote } from '../providers/marketDataProvider.ts';
import type { DataStatus } from '../providers/sourceHealth.ts';

export interface VerifiedCanonicalIdentity {
  /** Existing production_layer.canonical_stock.stock_id UUID. */
  stockId: string;
  symbol: string;
  exchange: 'NSE' | 'BSE';
  /** Existing canonical_stock.identity_key; the resolver must not invent it. */
  identityKey: string;
  mappingSource: string;
  mappingEvidenceUrl: string;
  mappingVerifiedAt: number;
}

export interface CanonicalIdentityResolver {
  /**
   * Return one verified mapping only. Return null when missing, ambiguous or
   * conflicting; do not select the first matching row.
   */
  resolve(quote: Quote): Promise<VerifiedCanonicalIdentity | null>;
}

export interface PersistedRawObservationRef {
  observationId: string;
  stockId: string;
  retrievedAt: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SYMBOL_PATTERN = /^[A-Z0-9&.-]{1,25}$/;

function freshnessFor(status: DataStatus): 'LIVE' | 'DELAYED' | 'STALE' | 'UNAVAILABLE' {
  if (status === 'LIVE' || status === 'DELAYED' || status === 'STALE') return status;
  return 'UNAVAILABLE';
}

function workflowFor(status: DataStatus): 'SOURCE_REQUIRED' | 'PENDING' | 'MISSING' {
  if (status === 'SOURCE_REQUIRED') return 'SOURCE_REQUIRED';
  if (status === 'MISSING' || status === 'NOT_INTERPRETABLE') return 'MISSING';
  return 'PENDING';
}

function interpretationFor(quote: Quote): 'INTERPRETABLE' | 'NOT_INTERPRETABLE' {
  if (quote.price === null) return 'NOT_INTERPRETABLE';
  if (quote.status === 'MISSING' || quote.status === 'NOT_INTERPRETABLE' ||
      quote.status === 'SOURCE_REQUIRED' || quote.status === 'UNKNOWN') {
    return 'NOT_INTERPRETABLE';
  }
  return 'INTERPRETABLE';
}

function validateQuote(quote: Quote, now: number): void {
  if (!quote || typeof quote !== 'object') throw new Error('raw quote must be an object');
  if (typeof quote.symbol !== 'string' || !SYMBOL_PATTERN.test(quote.symbol.trim().toUpperCase())) {
    throw new Error('raw quote has an invalid symbol');
  }
  if (typeof quote.source !== 'string' || !quote.source.trim()) {
    throw new Error('raw quote source is required');
  }
  if (quote.price !== null && (typeof quote.price !== 'number' || !Number.isFinite(quote.price))) {
    throw new Error('raw quote price must be a finite number or null');
  }
  if (quote.asOf !== null && (typeof quote.asOf !== 'number' || !Number.isFinite(quote.asOf) ||
      Number.isNaN(new Date(quote.asOf).getTime()))) {
    throw new Error('raw quote timestamp must be a valid epoch-millisecond value or null');
  }
  if (!Number.isFinite(now) || Number.isNaN(new Date(now).getTime())) {
    throw new Error('retrievedAt must be a valid epoch-millisecond value');
  }
}

function validateIdentity(
  identity: VerifiedCanonicalIdentity | null,
  quote: Quote,
  now: number,
): VerifiedCanonicalIdentity {
  if (!identity) {
    throw new Error('canonical identity is unresolved or ambiguous; raw quote was not persisted');
  }
  if (!UUID_PATTERN.test(identity.stockId)) throw new Error('canonical identity has an invalid stock UUID');
  if (identity.symbol.trim().toUpperCase() !== quote.symbol.trim().toUpperCase()) {
    throw new Error('canonical identity symbol does not match the quote symbol');
  }
  if (identity.exchange !== 'NSE' && identity.exchange !== 'BSE') {
    throw new Error('canonical identity exchange must be NSE or BSE');
  }
  if (typeof identity.identityKey !== 'string' || !identity.identityKey.trim()) {
    throw new Error('canonical identity key is required');
  }
  if (typeof identity.mappingSource !== 'string' || !identity.mappingSource.trim()) {
    throw new Error('canonical mapping source is required');
  }
  let evidenceUrl: URL;
  try {
    evidenceUrl = new URL(identity.mappingEvidenceUrl);
  } catch {
    throw new Error('canonical mapping evidence URL is invalid');
  }
  if (evidenceUrl.protocol !== 'https:') throw new Error('canonical mapping evidence URL must use HTTPS');
  if (!Number.isFinite(identity.mappingVerifiedAt) ||
      Number.isNaN(new Date(identity.mappingVerifiedAt).getTime()) ||
      identity.mappingVerifiedAt > now) {
    throw new Error('canonical mapping verification timestamp is invalid or in the future');
  }
  return identity;
}

export class PrismaRawObservationWriter {
  /** Not production-ready until provider, mapping resolver and release gates are approved. */
  public readonly productionReady = false;
  private readonly prisma: Pick<PrismaClient, 'rawStockObservation'>;
  private readonly resolver: CanonicalIdentityResolver;

  constructor(
    prisma: Pick<PrismaClient, 'rawStockObservation'>,
    resolver: CanonicalIdentityResolver,
  ) {
    if (!prisma?.rawStockObservation?.create) throw new Error('Prisma raw-observation delegate is required');
    if (!resolver || typeof resolver.resolve !== 'function') throw new Error('canonical identity resolver is required');
    this.prisma = prisma;
    this.resolver = resolver;
  }

  /**
   * Append the Quote returned by the provider before normalization. Raw rows
   * are never updated or deleted. The database trigger independently enforces
   * append-only behavior.
   */
  async append(quote: Quote, now: number = Date.now()): Promise<PersistedRawObservationRef> {
    validateQuote(quote, now);
    const identity = validateIdentity(await this.resolver.resolve(quote), quote, now);

    const created = await this.prisma.rawStockObservation.create({
      data: {
        stockId: identity.stockId,
        source: quote.source,
        sourceTimestamp: quote.asOf === null ? null : new Date(quote.asOf),
        reportedDate: null,
        dataNature: 'RAW',
        formulaVersion: null,
        payload: structuredClone(quote) as unknown as Prisma.InputJsonValue,
        freshnessStatus: freshnessFor(quote.status),
        // Raw capture does not itself confer verification, even if the source
        // reports the quote as LIVE or DELAYED.
        verificationStatus: 'UNKNOWN',
        interpretationStatus: interpretationFor(quote),
        workflowStatus: workflowFor(quote.status),
        retrievedAt: new Date(now),
        validationStatus: 'RAW_CAPTURED',
        configurationSnapshot: {
          writerVersion: 'MN_RAW_OBSERVATION_WRITER_1.0',
          identityMapping: {
            stockId: identity.stockId,
            symbol: identity.symbol.trim().toUpperCase(),
            exchange: identity.exchange,
            identityKey: identity.identityKey,
            mappingSource: identity.mappingSource,
            mappingEvidenceUrl: identity.mappingEvidenceUrl,
            mappingVerifiedAt: new Date(identity.mappingVerifiedAt).toISOString(),
          },
        } as Prisma.InputJsonValue,
      },
      select: { observationId: true, stockId: true, retrievedAt: true },
    });

    if (!created.retrievedAt) {
      throw new Error('persisted raw observation is missing its retrieval timestamp');
    }

    return {
      observationId: created.observationId,
      stockId: created.stockId,
      retrievedAt: created.retrievedAt.getTime(),
    };
  }
}
