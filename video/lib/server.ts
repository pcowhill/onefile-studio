import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.vtt': 'text/vtt',
};

/** A minimal static file server (no dependencies) for the capture and render steps. */
export async function serveStatic(root: string, port = 0): Promise<{ url: string; close(): Promise<void> }> {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://x');
    let file = path.join(root, decodeURIComponent(u.pathname));
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(data);
    });
  });
  await new Promise<void>((r) => server.listen(port, '127.0.0.1', r));
  const { port: p } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${p}/`, close: () => new Promise((r) => server.close(() => r())) };
}
