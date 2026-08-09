const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const target = path.resolve(root, relative);

  if (!target.startsWith(root) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    response.writeHead(404).end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': mime[path.extname(target)] || 'application/octet-stream',
  });
  fs.createReadStream(target).pipe(response);
});

server.listen(0, '127.0.0.1', async () => {
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  try {
    for (const file of [
      '/',
      '/app/main.js',
      '/app/data.js',
      '/app/config.js',
      '/sw.js',
      '/manifest.webmanifest',
      '/assets/icons/icon.svg',
    ]) {
      const response = await fetch(base + file);
      assert.equal(response.status, 200, `${file} phải trả HTTP 200`);
    }

    const index = await (await fetch(base + '/')).text();
    assert.match(index, /\.\/app\/main\.js/);
    assert.match(index, /id="main-content"/);
    console.log('Smoke test app shell thành công.');
  } finally {
    server.close();
  }
});
