// Serve the actual static build, with its Cloudflare-style response headers.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.geojson': 'application/geo+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.xml': 'application/xml', '.txt': 'text/plain' };

export async function startPreview() {
  const root = resolve(projectRoot, 'dist');
  await stat(resolve(root, 'index.html')).catch(() => { throw new Error('Production output missing. Run npm run build before npm run test:browser.'); });
  const rules = [];
  let current;
  for (const line of (await readFile(resolve(root, '_headers'), 'utf8')).split('\n')) {
    if (line.startsWith('/')) { current = { pattern: line.trim(), headers: {} }; rules.push(current); }
    else if (current && /^\s+[^:]+:/.test(line)) {
      const index = line.indexOf(':');
      current.headers[line.slice(0,index).trim()] = line.slice(index + 1).trim();
    }
  }
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const path = resolve(root, '.' + pathname);
      if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
      let file = path;
      let code = 200;
      try { if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html'); await stat(file); }
      catch { file = resolve(root, '404.html'); code = 404; }
      const headers = { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' };
      for (const rule of rules) {
        if (rule.pattern.endsWith('*') ? pathname.startsWith(rule.pattern.slice(0,-1)) : pathname === rule.pattern) Object.assign(headers, rule.headers);
      }
      const body = await readFile(file);
      res.writeHead(code, headers);
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { res.writeHead(500).end('Preview could not read the built file.'); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }) };
}
