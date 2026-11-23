#!/usr/bin/env node
// A tiny static file server with no dependencies — one way to host the
// complete website in dist-site/ (any ordinary static server works too):
//
//   node scripts/serve-static.mjs dist-site                     → http://localhost:8080/
//   node scripts/serve-static.mjs dist-site --base /onefile-studio/ --port 9000
//   node scripts/serve-static.mjs dist-site --copy              (serve a temporary copy)
//
// It serves files as they are (no build step, no rewriting), supports HTTP
// range requests (video seeking) and maps "folder/" to "folder/index.html",
// like GitHub Pages and most web servers. `--copy` first copies the folder to
// a temporary directory, which the tests use to prove the site does not depend
// on anything else in the repository.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, d) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : d;
};
let root = path.resolve(args.find((a, i) => !a.startsWith('--') && !['--port', '--base', '--host'].includes(args[i - 1])) ?? 'dist-site');
const port = Number(opt('--port', process.env.PORT ?? 8080));
const host = opt('--host', '127.0.0.1');
let base = opt('--base', '/');
if (!base.startsWith('/')) base = `/${base}`;
if (!base.endsWith('/')) base += '/';

if (!fs.existsSync(path.join(root, 'index.html'))) {
  console.error(`${root} has no index.html`);
  process.exit(1);
}
if (args.includes('--copy')) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'onefile-site-'));
  fs.cpSync(root, tmp, { recursive: true });
  root = tmp;
  const cleanup = () => fs.rmSync(tmp, { recursive: true, force: true });
  process.on('exit', cleanup);
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(0));
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.vtt': 'text/vtt; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.glb': 'model/gltf-binary',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }
  if (pathname === base.slice(0, -1)) {
    res.writeHead(301, { Location: base + url.search }).end();
    return;
  }
  if (!pathname.startsWith(base)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    return;
  }
  let file = path.join(root, pathname.slice(base.length));
  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  let stat = fs.statSync(file, { throwIfNoEntry: false });
  if (stat?.isDirectory()) {
    if (!pathname.endsWith('/')) {
      res.writeHead(301, { Location: `${pathname}/${url.search}` }).end();
      return;
    }
    file = path.join(file, 'index.html');
    stat = fs.statSync(file, { throwIfNoEntry: false });
  }
  if (!stat?.isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    return;
  }
  const headers = {
    'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-cache',
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : stat.size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : stat.size - 1;
    start = Math.max(0, start);
    end = Math.min(end, stat.size - 1);
    if (start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end();
      return;
    }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') return void res.end();
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, 'Content-Length': stat.size });
  if (req.method === 'HEAD') return void res.end();
  fs.createReadStream(file).pipe(res);
});

server.listen(port, host, () => {
  console.log(`Serving ${root} at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}${base}`);
});
