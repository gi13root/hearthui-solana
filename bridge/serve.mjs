// Tiny static server for local bridge preview: http://localhost:3434/bridge/  (node built-ins only)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SERVE = ['bridge', 'mock', 'program' + sep + 'client'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const port = Number(process.env.PORT) || 3434;
createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') { res.writeHead(302, { Location: '/bridge/' }); return res.end(); }
  if (p.endsWith('/')) p += 'index.html';
  const rel = normalize(p).replace(/^[/\\]+/, '');
  const catalogAsset=rel==='addon'+sep+'store-date-concepts.js' || rel==='addon/store-date-concepts.js';
  if (rel.includes('..') || (!catalogAsset && !SERVE.some((d) => rel.startsWith(d + sep) || rel.startsWith(d + '/')))) { res.writeHead(404); return res.end('not found'); }
  try {
    const file = join(ROOT, rel); if (!(await stat(file)).isFile()) throw 0;
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(port, () => console.log(`bridge preview: http://localhost:${port}/bridge/#action=signin`));
