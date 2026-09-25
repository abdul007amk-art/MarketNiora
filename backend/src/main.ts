import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRoutes } from './api/routes/index.ts';
import { createDependencies } from './api/dependencies.ts';
import { createApp } from './api/server.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '../../frontend');
const apiServer = createApp(buildRoutes(), createDependencies());
const API_PREFIXES = ['/health','/architecture/','/auth/','/rotation/','/stock-score/','/theme/','/fundamental/','/value-chain/','/portfolio/','/research/'];

function isApiRequest(pathname: string): boolean {
  return API_PREFIXES.some(function(prefix){ return prefix.endsWith('/') ? pathname.startsWith(prefix) : pathname === prefix; });
}
function contentType(filePath: string): string {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  return 'application/octet-stream';
}
async function serveStatic(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if ((req.method || 'GET') !== 'GET') { res.statusCode=405; res.setHeader('Allow','GET'); res.end('Method Not Allowed'); return; }
  const url = new URL(req.url || '/', 'http://localhost');
  let relative = decodeURIComponent(url.pathname);
  if (relative === '/') relative = '/index.html';
  const candidate = path.resolve(frontendRoot, '.' + relative);
  if (!candidate.startsWith(frontendRoot + path.sep)) { res.statusCode=400; res.end('Bad Request'); return; }
  let filePath = candidate;
  try { const stat = await fs.stat(filePath); if (!stat.isFile()) throw new Error('not file'); } catch { filePath = path.join(frontendRoot,'index.html'); }
  try { const body = await fs.readFile(filePath); res.statusCode=200; res.setHeader('Content-Type',contentType(filePath)); res.setHeader('Cache-Control','no-store'); res.end(body); }
  catch { res.statusCode=500; res.end('Frontend unavailable'); }
}
const server = createServer(function(req,res){
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;
  if (isApiRequest(pathname)) { apiServer.emit('request', req, res); return; }
  void serveStatic(req,res);
});
const port = Number(process.env.PORT || 3000);
server.listen(port,'0.0.0.0',function(){ console.log('MarketNiora web server listening on port ' + port); });
function shutdown(){ server.close(function(){ process.exit(0); }); }
process.on('SIGINT',shutdown); process.on('SIGTERM',shutdown);
