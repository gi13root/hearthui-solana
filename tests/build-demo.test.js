'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');
const load = () => import(path.join(ROOT, 'scripts/build-demo.mjs'));
const KEY = fs.readFileSync(path.join(ROOT, 'scripts/manifest-key.pub.txt'), 'utf8').trim();
const EXT_ID = fs.readFileSync(path.join(ROOT, 'scripts/ext-id.txt'), 'utf8').trim();

const baseManifest = () => ({
  manifest_version: 3,
  name: '__MSG_extensionName__',
  version: '1.3.1',
  host_permissions: ['https://fonts.googleapis.com/*'],
  externally_connectable: { matches: ['https://evil.example/*'] }
});

test('extensionIdFromKey matches scripts/ext-id.txt', async () => {
  const { extensionIdFromKey } = await load();
  assert.strictEqual(extensionIdFromKey(KEY), EXT_ID);
  assert.match(extensionIdFromKey(KEY), /^[a-p]{32}$/);
});

test('patchManifest sets key, externally_connectable, host perms, name suffix', async () => {
  const { patchManifest, DEMO_HOSTS, EXTERNALLY_CONNECTABLE } = await load();
  const m = patchManifest(baseManifest(), { key: KEY, nameSuffix: ' (Solana demo)' });
  assert.strictEqual(m.key, KEY);
  assert.deepStrictEqual(m.externally_connectable.matches, EXTERNALLY_CONNECTABLE);
  assert.deepStrictEqual(EXTERNALLY_CONNECTABLE, ['https://heartui.ipfps.org/*', 'http://localhost:3434/*', 'https://gi13root.github.io/*']);
  for (const h of DEMO_HOSTS) assert.ok(m.host_permissions.includes(h), h);
  assert.ok(m.host_permissions.includes('https://api.devnet.solana.com/*'));
  assert.ok(m.host_permissions.includes('https://heartui.ipfps.org/*'));
  assert.ok(m.host_permissions.includes('https://fonts.googleapis.com/*'), 'keeps base hosts');
  assert.strictEqual(m.name, 'HearthUI (Solana demo)', 'resolves __MSG_ name to literal');
  assert.ok(/solana demo/i.test(m.version_name));
});

test('patchManifest is idempotent and does not mutate input', async () => {
  const { patchManifest } = await load();
  const input = baseManifest();
  const snapshot = JSON.stringify(input);
  const once = patchManifest(input, { key: KEY, nameSuffix: ' (Solana demo)' });
  const twice = patchManifest(once, { key: KEY, nameSuffix: ' (Solana demo)' });
  assert.strictEqual(JSON.stringify(input), snapshot);
  assert.deepStrictEqual(twice, once);
  assert.strictEqual(new Set(twice.host_permissions).size, twice.host_permissions.length);
});

test('patchManifest rejects a missing key', async () => {
  const { patchManifest } = await load();
  assert.throws(() => patchManifest(baseManifest(), { key: '' }), /key/);
});

test('orderAddonScripts puts solana-session.js and config.js first', async () => {
  const { orderAddonScripts } = await load();
  assert.deepStrictEqual(
    orderAddonScripts(['wallet-widget.js', 'solana-session.js', 'b.js', 'config.js', 'a.js']),
    ['config.js', 'solana-session.js', 'a.js', 'b.js', 'wallet-widget.js']
  );
  assert.deepStrictEqual(orderAddonScripts(['x.js', 'y.js'], ['y.js']), ['y.js', 'x.js']);
});

test('injectScripts adds deferred tags before </body>, once', async () => {
  const { injectScripts } = await load();
  const html = '<html><body><script defer src="newtab-main.js"></script>\n</body></html>';
  const out = injectScripts(html, ['addon/config.js', 'addon/x.js']);
  assert.ok(out.indexOf('src="addon/config.js"') < out.indexOf('src="addon/x.js"'));
  assert.ok(out.indexOf('newtab-main.js') < out.indexOf('addon/config.js'));
  assert.ok(out.indexOf('addon/x.js') < out.indexOf('</body>'));
  assert.strictEqual(injectScripts(out, ['addon/config.js', 'addon/x.js']), out);
  assert.throws(() => injectScripts('<html></html>', ['a.js']), /body/);
});

test('makeZip produces a valid archive with stored names and CRC', async () => {
  const { makeZip } = await load();
  const buf = makeZip([{ name: 'a/b.txt', data: Buffer.from('hello hello hello') }]);
  assert.strictEqual(buf.readUInt32LE(0), 0x04034b50);
  const eocd = buf.length - 22;
  assert.strictEqual(buf.readUInt32LE(eocd), 0x06054b50);
  assert.strictEqual(buf.readUInt16LE(eocd + 10), 1);
  const nameLen = buf.readUInt16LE(26);
  assert.strictEqual(buf.slice(30, 30 + nameLen).toString(), 'a/b.txt');
  const csize = buf.readUInt32LE(18);
  const raw = buf.slice(30 + nameLen, 30 + nameLen + csize);
  assert.strictEqual(zlib.inflateRawSync(raw).toString(), 'hello hello hello');
  assert.strictEqual(buf.readUInt32LE(14), zlib.crc32(Buffer.from('hello hello hello')));
});

test('injectStyles adds addon css before </head> once', async () => {
  const { injectStyles } = await import('../scripts/build-demo.mjs');
  const html = '<html><head><link rel="stylesheet" href="newtab.css"/></head><body></body></html>';
  const once = injectStyles(html, ['addon/addon.css']);
  assert.ok(once.indexOf('addon/addon.css') > once.indexOf('newtab.css'));
  assert.ok(once.indexOf('addon/addon.css') < once.indexOf('</head>'));
  assert.strictEqual(injectStyles(once, ['addon/addon.css']), once);
});
