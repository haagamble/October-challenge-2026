// Local-only preview. Serve app assets, never database exports or private files.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const allowed = new Set(['index.html', 'group-challenge.js', 'group-challenge.css', 'cheerleader.js', 'manifest.webmanifest']);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  res.setHeader('Cache-Control', 'no-store');
  if (file === 'firebase-config.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    return res.end('window.GROUP_CHALLENGE_FIREBASE_CONFIG = Object.freeze({});');
  }
  if (!allowed.has(file) && !/^icons\/[a-z0-9-]+\.png$/.test(file)) {
    res.writeHead(404); return res.end('Not found');
  }
  fs.readFile(path.join(__dirname, file), (error, data) => {
    res.writeHead(error ? 404 : 200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(error ? 'Not found' : data);
  });
}).listen(4173, '127.0.0.1', () => console.log('Local preview: http://127.0.0.1:4173/ (browser storage only)'));
