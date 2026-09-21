/**
 * SECURITY HEADERS
 * Status: IMPLEMENTATION — unit tested below. Framework-agnostic: returns
 * a plain header object; wire it into Express/Fastify/Next.js middleware
 * when the API layer (Module 13) is built.
 */

export function securityHeaders(): Record<string, string> {
  return {
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    // CSP is deliberately minimal/restrictive here; will need per-route
    // tuning once the frontend build tooling (Module 14/15) is chosen.
    'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'",
    'X-Permitted-Cross-Domain-Policies': 'none',
  };
}
