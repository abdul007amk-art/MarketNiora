/**
 * PORTFOLIO STORE
 * Status: IMPLEMENTATION — unit tested below. In-memory foundation
 * (productionReady = false), same convention as every other *Store.
 * True immutable snapshots (structuredClone) on the way in and out —
 * same fix pattern as Module 7's provenance stores.
 */

export interface NormalizedHolding {
  symbol: string;
  isin: string | null;
  quantity: number;
  averagePrice: number;
}

export interface PortfolioStore {
  setHoldings(userId: string, holdings: NormalizedHolding[]): void;
  getHoldings(userId: string): NormalizedHolding[];
}

export class InMemoryPortfolioStore implements PortfolioStore {
  public readonly productionReady = false;
  private holdingsByUser: Map<string, NormalizedHolding[]>;

  constructor() {
    this.holdingsByUser = new Map();
  }

  setHoldings(userId: string, holdings: NormalizedHolding[]): void {
    this.holdingsByUser.set(userId, structuredClone(holdings));
  }

  getHoldings(userId: string): NormalizedHolding[] {
    const holdings = this.holdingsByUser.get(userId);
    return holdings ? structuredClone(holdings) : [];
  }
}
