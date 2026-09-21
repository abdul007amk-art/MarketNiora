/**
 * PERMITTED SOURCES
 * Status: IMPLEMENTATION — unit tested below.
 *
 * GOVERNANCE: Master Guide's AI Research flow starts with "PERMITTED
 * SOURCE / FILING" — AI discovery is only ever valid from an explicit
 * allow-list, never from an arbitrary URL/source the AI (or a caller)
 * decides to trust. Default-deny, same convention as RBAC.
 */

export type SourceType = 'EXCHANGE_FILING' | 'COMPANY_FILING' | 'REGULATORY_NOTICE' | 'LICENSED_NEWS_FEED';

export interface PermittedSource {
  sourceId: string;
  name: string;
  sourceType: SourceType;
  active: boolean;
}

export interface SourceRegistry {
  isPermitted(sourceId: string): boolean;
  get(sourceId: string): PermittedSource | undefined;
}

export class InMemorySourceRegistry implements SourceRegistry {
  public readonly productionReady = false;
  private sources: Map<string, PermittedSource>;

  constructor() {
    this.sources = new Map();
  }

  register(source: PermittedSource): void {
    if (this.sources.has(source.sourceId)) {
      throw new Error(`a source is already registered with id "${source.sourceId}" — refusing silent overwrite`);
    }
    this.sources.set(source.sourceId, source);
  }

  /** Fail-closed: unknown source, or a known-but-inactive (revoked) source, is NOT permitted. */
  isPermitted(sourceId: string): boolean {
    const source = this.sources.get(sourceId);
    return source !== undefined && source.active === true;
  }

  get(sourceId: string): PermittedSource | undefined {
    return this.sources.get(sourceId);
  }

  deactivate(sourceId: string): void {
    const source = this.sources.get(sourceId);
    if (source) {
      this.sources.set(sourceId, { ...source, active: false });
    }
  }
}
