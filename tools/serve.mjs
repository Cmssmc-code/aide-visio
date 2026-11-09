#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.zip': 'application/zip',
  '.apk': 'application/vnd.android.package-archive',
  '.ps1': 'text/plain; charset=utf-8',
  '.cmd': 'text/plain; charset=utf-8',
};

export function startServer({ port = 8080, dir = 'src', host = '127.0.0.1', quiet = false } = {}) {
  const fromCwd = path.resolve(process.cwd(), dir);
  const base = fs.existsSync(fromCwd) ? fromCwd : path.resolve(ROOT, dir);
  if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) {
    return Promise.reject(new Error(`Dossier introuvable : ${base}`));
  }

  const server = http.createServer((req, res) => {
    const started = Date.now();
    const done = (status) => {
      if (!quiet) console.log(`${String(status).padEnd(3)} ${req.method} ${req.url} ${Date.now() - started} ms`);
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return done(405);
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400).end('Requête invalide');
      return done(400);
    }
    let file = path.normalize(path.join(base, pathname));
    if (file !== base && !file.startsWith(base + path.sep)) {
      res.writeHead(403).end('Interdit');
      return done(403);
    }
    try {
      if (fs.statSync(file).isDirectory()) {
        if (!pathname.endsWith('/')) {
          res.writeHead(301, { Location: pathname + '/' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '') }).end();
          return done(301);
        }
        file = path.join(file, 'index.html');
      }
    } catch {  }

    let status = 200;
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      const notFound = path.join(base, '404.html');
      if (fs.existsSync(notFound)) {
        file = notFound;
        status = 404;
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Introuvable : ' + pathname);
        return done(404);
      }
    }

    const ext = path.extname(file).toLowerCase();
    const size = fs.statSync(file).size;
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': size,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    };
    if (path.basename(file) === 'sw.js') headers['Service-Worker-Allowed'] = '/';
    res.writeHead(status, headers);
    if (req.method === 'HEAD') {
      res.end();
      return done(status);
    }
    fs.createReadStream(file)
      .on('error', () => res.destroy())
      .on('end', () => done(status))
      .pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const actual = server.address().port;
      const shown = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
      resolve({ server, port: actual, url: `http://${shown}:${actual}/`, dir: base });
    });
  });
}

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--host') opts.host = argv[++i];
    else if (a === '--quiet' || a === '-q') opts.quiet = true;
    else if (/^\d+$/.test(a)) opts.port = Number(a);
    else if (!a.startsWith('-')) opts.dir = a;
  }
  return opts;
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const opts = parseArgs(process.argv.slice(2));
  startServer(opts)
    .then(({ url, dir }) => {
      console.log(`Aide Visio : ${url}  (dossier ${path.relative(ROOT, dir) || '.'})`);
      if (opts.host && opts.host !== '127.0.0.1' && opts.host !== 'localhost') {
        console.log('Attention : hors localhost, le micro et le service worker exigent HTTPS.');
      }
    })
    .catch((err) => {
      console.error(err.code === 'EADDRINUSE' ? `Port déjà utilisé : ${opts.port}` : err.message);
      process.exit(1);
    });
}
