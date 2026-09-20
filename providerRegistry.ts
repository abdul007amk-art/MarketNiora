/**
 * PROVIDER REGISTRY
 * Status: IMPLEMENTATION — unit tested below.
 *
 * Generic registry so the API layer (Module 13) can register whichever
 * providers are actually configured and look them up by name — with a
 * fail-closed getOrThrow() rather than silently falling through to
 * undefined behavior when a provider isn't registered.
 */

export interface NamedProvider {
  name: string;
}

export class ProviderRegistry<T extends NamedProvider> {
  private providers: Map<string, T>;

  constructor() {
    this.providers = new Map();
  }

  /**
   * Fails closed on a duplicate name (post-audit fix) — silently replacing
   * an already-registered provider is exactly the kind of "configuration
   * mutated without anyone noticing" bug this registry exists to prevent.
   * Use replace() if you genuinely intend to swap a provider.
   */
  register(provider: T): void {
    if (this.providers.has(provider.name)) {
      throw new Error(`a provider is already registered with name "${provider.name}" — refusing silent overwrite; use replace() if this is intentional`);
    }
    this.providers.set(provider.name, provider);
  }

  /** Explicit, intentional replacement — the only sanctioned way to overwrite an existing registration. */
  replace(provider: T): void {
    this.providers.set(provider.name, provider);
  }

  get(name: string): T | undefined {
    return this.providers.get(name);
  }

  getOrThrow(name: string): T {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`no provider registered with name: ${name}`);
    }
    return provider;
  }

  list(): string[] {
    return [...this.providers.keys()];
  }
}
