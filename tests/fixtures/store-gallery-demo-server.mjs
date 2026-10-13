// Local QA host for the actual demo build. It never loads a wallet provider or sends transactions.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const build = path.join(root, 'dist/hearthui-solana-demo');
const types = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.webp':'image/webp', '.avif':'image/avif', '.png':'image/png', '.svg':'image/svg+xml', '.json':'application/json' };
createServer(async (req,res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const captureFiles={
      '/__qa-date-concepts.html':['tests/fixtures/date-concepts-source.html','text/html'],
      '/__qa-date-concept-stage.js':['tests/fixtures/date-concept-stage.js','application/javascript'],
      '/__qa-date-concepts.json':['docs/artifacts/store-gallery/date-concept-inventory.json','application/json']
    };
    if(captureFiles[url.pathname]){
      const [file,type]=captureFiles[url.pathname];res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});
      return res.end(await readFile(path.join(root,file)));
    }
    if (url.pathname === '/__qa-fixture.js') {
      res.writeHead(200, {'Content-Type':'application/javascript','Cache-Control':'no-store'});
      return res.end(await readFile(path.join(root,'tests/fixtures/store-gallery-browser-fixture.js')));
    }
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'newtab.html';
    const file = path.resolve(build,rel);
    if (!file.startsWith(build + path.sep)) throw Error('invalid path');
    let bytes = await readFile(file);
    if (rel === 'newtab.html') bytes = Buffer.from(bytes.toString().replace('<head>', '<head><script src="/__qa-fixture.js"></script>'));
    res.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});
    res.end(bytes);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(3435,'127.0.0.1',()=>console.log('Store QA host: http://localhost:3435/newtab.html'));
