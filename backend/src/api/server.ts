/**
 * SERVER
 * Status: IMPLEMENTATION — unit tested below via real HTTP requests
 * against a running server on an ephemeral port.
 *
 * Built entirely on Node's built-in `http` module — no Express/Fastify —
 * consistent with this repo's zero-network-install-dependency approach.
 *
 * BOUNDARY: serves the same-origin static frontend and HTTP API. This
 * does NOT prove production database connectivity or a configured market-data
 * provider. Runtime readiness is reported separately by the provider endpoints.
 */

import { createServer } from 'http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse, Server } from 'http';
import { securityHeaders } from '../security/securityHeaders.ts';
import { matchRoute } from './router.ts';
import type { Route } from './router.ts';
import { parseCookies } from './cookies.ts';
import type { AppDependencies } from './dependencies.ts';

const MAX_BODY_BYTES = 1024 * 1024; // 1MB — a request body beyond this is refused, not silently truncated

// Exact whitelist only: do not map arbitrary URL paths to filesystem paths.
const STATIC_FILES: Record<string, { path: string; contentType: string }> = {
  '/': { path: 'frontend/index.html', contentType: 'text/html; charset=utf-8' },
  '/assets/app.js': { path: 'frontend/assets/app.js', contentType: 'text/javascript; charset=utf-8' },
  '/assets/styles.css': { path: 'frontend/assets/styles.css', contentType: 'text/css; charset=utf-8' },
};

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

      // Serve only the three whitelisted same-origin frontend paths. Static
      // files use explicit MIME types and can never be selected by user path input.
      const staticFile = method === 'GET' ? STATIC_FILES[url.pathname] : undefined;
      if (staticFile) {
        try {
          const bytes = await readFile(resolve(process.cwd(), staticFile.path));
          res.statusCode = 200;
          res.setHeader('Content-Type', staticFile.contentType);
          res.setHeader('Cache-Control', 'no-cache');
          res.end(bytes);
        } catch {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'frontend asset unavailable' }));
        }
        return;
      }

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
        // Use the socket peer only. X-Forwarded-For is client-controlled unless
        // a separately approved trusted-proxy configuration exists.
        clientIp: req.socket.remoteAddress ?? 'unknown',
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
