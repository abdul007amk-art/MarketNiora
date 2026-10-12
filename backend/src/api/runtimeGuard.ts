/**
 * Runtime launch gate.
 *
 * The current production-auth/KMS and durable market-data integrations have
 * not passed runtime validation. Refuse a production-labelled process rather
 * than quietly starting with in-memory auth and an unconfigured data provider.
 * This gate can only be removed after the explicit production readiness review.
 */
export function productionRuntimeBlockReason(
  env: Record<string, string | undefined> = process.env,
): string | null {
  if (env.NODE_ENV !== 'production') return null;
  return 'Production startup blocked: persistent production auth/KMS, durable market-data ingestion and production runtime validation are not yet approved and verified.';
}
