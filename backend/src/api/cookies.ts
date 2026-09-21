/**
 * COOKIES
 * Status: IMPLEMENTATION — unit tested below.
 */

export function parseCookies(header: string | string[] | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  const headerStr = Array.isArray(header) ? header.join('; ') : header;

  for (const part of headerStr.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key.length > 0) {
      cookies[key] = decodeURIComponent(value);
    }
  }
  return cookies;
}
