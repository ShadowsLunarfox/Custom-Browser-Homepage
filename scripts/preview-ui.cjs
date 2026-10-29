// Local preview only. The extension still loads directly from manifest.json.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = Number(process.argv[2]) || 4173;
let latestViewportReport = null;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.mp4': 'video/mp4' };
http.createServer((request, response) => {
  // Local test-result reporting, so layout checks can be inspected without taking browser focus.
  if (request.url === '/__viewport-report') {
    if (request.method === 'GET') {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(latestViewportReport));
      return;
    }
    if (request.method !== 'POST') { response.writeHead(405).end(); return; }
    let body = '';
    request.on('data', chunk => {
      body += chunk;
      if (body.length > 100000) request.destroy();
    });
    request.on('end', () => {
      try {
        latestViewportReport = JSON.parse(body);
        response.writeHead(200).end('ok');
      } catch { response.writeHead(400).end(); }
    });
    return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end(); return; }
  const target = path.resolve(root, `.${pathname === '/' ? '/home.html' : pathname}`);
  if (!target.startsWith(root + path.sep) || pathname.split('/').some(part => part.startsWith('.'))) {
    response.writeHead(403).end(); return;
  }
  fs.stat(target, (error, stat) => {
    if (error || !stat.isFile()) { response.writeHead(404).end(); return; }
    const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
    if (start > end || start >= stat.size) { response.writeHead(416).end(); return; }
    const headers = { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 };
    if (range) headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    response.writeHead(range ? 206 : 200, headers);
    fs.createReadStream(target, { start, end }).pipe(response);
  });
}).listen(port, '127.0.0.1', () => console.log(`Lunar preview: http://127.0.0.1:${port}/home.html`));
