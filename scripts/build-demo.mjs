#!/usr/bin/env node
/* build-demo.mjs — HearthUI production build + Solana addon → unpacked demo + zip.
   Node built-ins only. Usage: npm run build:demo   (env: HEARTH_BASE_REF, HEARTH_V3_REPO,
   HEARTH_PRICE_HOST, HEARTH_DEMO_MOCK=1 to also inject mock/*.js). See docs/HANDOFF.md. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const DEFAULT_BASE_REF = 'fix/search-api-1.3.1';
export const DEFAULT_V3_REPO = path.join(path.dirname(ROOT), 'home-screen-launcher-v3');
export const EXTERNALLY_CONNECTABLE = ['https://heartui.ipfps.org/*', 'http://localhost:3434/*'];
export const PRICE_HOST = process.env.HEARTH_PRICE_HOST || 'https://api.coingecko.com/*';
export const DEMO_HOSTS = ['https://api.devnet.solana.com/*', 'https://heartui.ipfps.org/*', PRICE_HOST];
export const FIRST_SCRIPTS = ['config.js', 'solana-session.js'];

/** Chrome extension id = first 16 bytes of sha256(DER public key), hex digits mapped 0-f → a-p. */
export function extensionIdFromKey(b64) {
  const der = Buffer.from(String(b64).replace(/\s+/g, ''), 'base64');
  const hex = crypto.createHash('sha256').update(der).digest('hex').slice(0, 32);
  return [...hex].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
}

/** Pure: returns a patched copy of the manifest. Idempotent. */
export function patchManifest(manifest, { key, nameSuffix = ' (Solana demo)', baseName = 'HearthUI', hosts = DEMO_HOSTS } = {}) {
  if (!key || !String(key).trim()) throw new Error('patchManifest: manifest key is required');
  const m = JSON.parse(JSON.stringify(manifest));
  m.key = String(key).trim();
  m.externally_connectable = { ...(m.externally_connectable || {}), matches: [...EXTERNALLY_CONNECTABLE] };
  m.host_permissions = [...new Set([...(m.host_permissions || []), ...hosts])];
  let name = String(m.name || baseName);
  if (name.startsWith('__MSG_')) name = baseName;
  if (!name.endsWith(nameSuffix)) name += nameSuffix;
  m.name = name;
  const vn = String(m.version_name || m.version || '');
  m.version_name = /solana demo/i.test(vn) ? vn : (vn + ' Solana demo').trim();
  return m;
}

/** First-listed names first (in given order), then the rest alphabetically. */
export function orderAddonScripts(files, first = FIRST_SCRIPTS) {
  const head = first.filter((f) => files.includes(f));
  const rest = files.filter((f) => !head.includes(f)).sort();
  return [...head, ...rest];
}

/** Adds <script defer src> tags before </body>; skips tags already present. */
export function injectScripts(html, srcs) {
  const i = html.lastIndexOf('</body>');
  if (i === -1) throw new Error('injectScripts: no </body> in newtab.html');
  const tags = srcs.filter((s) => !html.includes(`src="${s}"`))
    .map((s) => `  <script defer src="${s}"></script>\n`).join('');
  if (!tags) return html;
  return html.slice(0, i) + '  <!-- hearthui-solana addon (demo build only) -->\n' + tags + html.slice(i);
}

/** Minimal deflate zip writer. entries: [{name, data: Buffer}] */
export function makeZip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  const dosTime = 0, dosDate = (1 << 5) | 1; // 1980-01-01, deterministic
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const comp = zlib.deflateRawSync(data, { level: 9 });
    const crc = zlib.crc32(data) >>> 0;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(8, 8); lh.writeUInt16LE(dosTime, 10); lh.writeUInt16LE(dosDate, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10); ch.writeUInt16LE(dosTime, 12);
    ch.writeUInt16LE(dosDate, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt32LE(offset, 42);
    locals.push(lh, nameBuf, comp);
    centrals.push(ch, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const abs = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(abs, base) : [path.relative(base, abs).split(path.sep).join('/')];
  }).sort();
}

function readHandoffOrder() {
  // Optional override: a line in docs/HANDOFF.md like `ADDON_ORDER: config.js, solana-session.js, wallet.js`
  try {
    const m = fs.readFileSync(path.join(ROOT, 'docs/HANDOFF.md'), 'utf8').match(/^ADDON_ORDER:\s*(.+)$/m);
    if (m) return m[1].split(',').map((s) => s.trim().replace(/^addon\//, '')).filter(Boolean);
  } catch { /* no handoff file */ }
  return FIRST_SCRIPTS;
}

function main() {
  const repo = process.env.HEARTH_V3_REPO || DEFAULT_V3_REPO;
  const ref = process.env.HEARTH_BASE_REF || DEFAULT_BASE_REF;
  const key = fs.readFileSync(path.join(ROOT, 'scripts/manifest-key.pub.txt'), 'utf8').trim();
  const wantId = fs.readFileSync(path.join(ROOT, 'scripts/ext-id.txt'), 'utf8').trim();
  const gotId = extensionIdFromKey(key);
  if (gotId !== wantId) throw new Error(`extension id mismatch: key gives ${gotId}, ext-id.txt says ${wantId}`);

  const cache = path.join(ROOT, 'dist/.cache');
  const src = path.join(cache, 'base-src');
  const built = path.join(cache, 'base-dist');
  const out = path.join(ROOT, 'dist/hearthui-solana-demo');
  const zipPath = path.join(ROOT, 'dist/hearthui-solana-demo.zip');
  for (const d of [src, built, out]) fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(src, { recursive: true });

  const commit = execFileSync('git', ['-C', repo, 'rev-parse', '--short', ref + '^{commit}'], { encoding: 'utf8' }).trim();
  console.log(`base: ${repo} @ ${ref} (${commit}) via git archive (working tree untouched)`);
  const tar = path.join(cache, 'base.tar');
  execFileSync('git', ['-C', repo, 'archive', '--format=tar', '-o', tar, commit]);
  execFileSync('tar', ['-xf', tar, '-C', src]);
  fs.rmSync(tar);

  execFileSync(process.execPath, ['scripts/make-dist.js'], { cwd: src, env: { ...process.env, DIST_OUT: built }, stdio: 'inherit' });
  fs.cpSync(built, out, { recursive: true });

  // addon (+ optional mock) scripts
  const addonDir = path.join(ROOT, 'addon');
  const addonFiles = fs.existsSync(addonDir) ? fs.readdirSync(addonDir).filter((f) => f.endsWith('.js')) : [];
  const srcs = [];
  if (process.env.HEARTH_DEMO_MOCK === '1' && fs.existsSync(path.join(ROOT, 'mock'))) {
    for (const f of fs.readdirSync(path.join(ROOT, 'mock')).filter((f) => f.endsWith('.js')).sort()) srcs.push('mock/' + f);
  }
  for (const f of orderAddonScripts(addonFiles, readHandoffOrder())) srcs.push('addon/' + f);
  if (fs.existsSync(path.join(ROOT, 'program/client/hearth-pass-client.js'))) {
    // program client must exist before addon code that calls it: right after session/config
    const at = Math.max(srcs.indexOf('addon/solana-session.js'), srcs.indexOf('addon/config.js'));
    srcs.splice(at + 1, 0, 'program/client/hearth-pass-client.js');
  }
  for (const rel of new Set(['addon', ...srcs.map((s) => s.split('/').slice(0, -1).join('/'))])) {
    const from = path.join(ROOT, rel);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(out, rel), { recursive: true, filter: (p) => !p.includes(`${path.sep}test`) });
  }
  if (!addonFiles.length) console.warn('  ! addon/ has no .js files yet — demo is the plain base build');
  const htmlPath = path.join(out, 'newtab.html');
  fs.writeFileSync(htmlPath, injectScripts(fs.readFileSync(htmlPath, 'utf8'), srcs));

  const manPath = path.join(out, 'manifest.json');
  const patched = patchManifest(JSON.parse(fs.readFileSync(manPath, 'utf8')), { key });
  fs.writeFileSync(manPath, JSON.stringify(patched, null, 2) + '\n');
  if (extensionIdFromKey(patched.key) !== wantId) throw new Error('patched manifest key does not yield ext-id.txt');

  const entries = listFiles(out).map((name) => ({ name, data: fs.readFileSync(path.join(out, name)) }));
  fs.writeFileSync(zipPath, makeZip(entries));
  console.log(`  ✓ scripts injected: ${srcs.join(', ') || '(none)'}`);
  console.log(`  ✓ extension id ${wantId}`);
  console.log(`  ✓ ${path.relative(ROOT, out)}/ + ${path.relative(ROOT, zipPath)} (${entries.length} files)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (e) { console.error('build:demo failed:', e.message); process.exit(1); }
}
