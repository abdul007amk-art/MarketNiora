/**
 * Session cookie policy for MarketNiora.
 *
 * Production cookies must be Secure (HTTPS-only). Local HTTP development and
 * unit tests intentionally omit Secure. This helper centralizes that policy
 * so auth routes and regression tests share the same behavior.
 */
export function buildSessionCookieHeaders(
  sessionToken: string,
  csrfToken: string,
  environment: string | undefined = process.env.NODE_ENV,
): string[] {
  const secureAttribute = environment === 'production' ? '; Secure' : '';

  return [
    `session_token=${sessionToken}; HttpOnly; Path=/; SameSite=Strict${secureAttribute}`,
    `csrf_token=${csrfToken}; Path=/; SameSite=Strict${secureAttribute}`,
  ];
}
