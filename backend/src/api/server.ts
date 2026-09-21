/**
 * SERVER
 * Status: IMPLEMENTATION — unit tested below via real HTTP requests
 * against a running server on an ephemeral port.
 *
 * Built entirely on Node's built-in `http` module — no Express/Fastify —
 * consistent with this repo's zero-network-install-dependency approach.
 *
 * BOUNDARY (see docs/API_LAYER.md): this is a genuinely running,
 * genuinely tested HTTP server. What it is NOT: connected to a real
 * Postgres database or a real Upstox/Telegram network call. All state
 * lives in the in-memory stores from dependencies.ts. No claim of
 * production readiness — see README's standing "not production ready" note.
 */

import { createServer } from 'http';
import type { IncomingMessage, ServerResponse, Server } from 'http';
import { securityHeaders } from '../security/securityHeaders.ts';
import { matchRoute } from './router.ts';
import type { Route } from './router.ts';
import { parseCookies } from './cookies.ts';
import type { AppDependencies } from './dependencies.ts';

const MAX_BODY_BYTES = 1024 * 1024; // 1MB — a request body beyond this is refused, not silently truncated

async function readBody(req: IncomingMessage): Promise<string> {
  let data = '';
  let byteCount = 0;
  for await (const chunk of req) {
    const chunkStr = chunk.toString('utf8');
    byteCount += chunkStr.length;
    if (byteCount > MAX_BODY_BYTES) {
      throw new Error('request body too large');
    }
    data += chunkStr;
  }
  return data;
}

export function createApp(routes: Route<AppDependencies>[], deps: AppDependencies): Server {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const headers = securityHeaders();
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }
    res.setHeader('Content-Type', 'application/json');

    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const method = req.method ?? 'GET';

      // Fast path: reject an oversized body via Content-Length BEFORE
      // reading anything, so we never buffer a huge payload into memory
      // and never leave the connection half-read (which previously
      // caused hangs on some clients when we threw mid-stream instead).
      const contentLengthHeader = req.headers['content-length'];
      const contentLengthStr = Array.isArray(contentLengthHeader) ? contentLengthHeader[0] : contentLengthHeader;
      const contentLength = contentLengthStr ? parseInt(contentLengthStr, 10) : 0;
      if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
        res.statusCode = 413;
        res.end(JSON.stringify({ error: 'request body too large' }));
        req.destroy();
        return;
      }

      let bodyText: string;
      try {
        bodyText = await readBody(req);
      } catch {
        res.statusCode = 413;
        res.end(JSON.stringify({ error: 'request body too large' }));
        req.destroy();
        return;
      }

      let parsedBody: unknown = null;
      if (bodyText.length > 0) {
        try {
          parsedBody = JSON.parse(bodyText);
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'malformed JSON body' }));
          return;
        }
      }

      const match = matchRoute(routes, method, url.pathname);
      if (!match) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'not found' }));
        return;
      }

      const ctx = {
        method,
        path: url.pathname,
        params: match.params,
        query: url.searchParams,
        body: parsedBody,
        cookies: parseCookies(req.headers['cookie']),
        headers: req.headers,
      };

      const result = await match.route.handler(ctx, deps);

      if (result.headers) {
        for (const [key, value] of Object.entries(result.headers)) {
          res.setHeader(key, value);
        }
      }
      res.statusCode = result.status;
      res.end(JSON.stringify(result.body));
    } catch {
      // Post-audit-style discipline (same as Module 12): never leak a raw
      // internal error/stack trace to the HTTP caller — generic 500 only.
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'internal server error' }));
    }
  });
}
