import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';

let release = 'a', failInstall = false;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1:4180');
  if (url.pathname === '/__test__/release' && request.method === 'POST') {
    release = url.searchParams.get('value') === 'b' ? 'b' : 'a'; failInstall = url.searchParams.has('fail'); response.end('ok'); return;
  }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { response.writeHead(400).end(); return; }
  const root = resolve(`.qa/pwa-${release}`);
  if (pathname.startsWith('/nested/tier-atelier/')) pathname = pathname.slice('/nested/tier-atelier'.length);
  if (pathname === '/') pathname = '/index.html';
  const file = resolve(root, `.${pathname}`);
  if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
  if (failInstall && pathname === '/index.html') { response.writeHead(503).end(); return; }
  try {
    const data = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }); response.end(data);
  } catch { response.writeHead(404).end(); }
}).listen(4180, '127.0.0.1');
