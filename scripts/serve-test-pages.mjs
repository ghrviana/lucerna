// Servidor estático para as páginas de teste. Uso: npm run test-pages → http://localhost:4173/
// POST /agent/result ecoa os campos recebidos (formulários das páginas de teste do agente).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), 'test-pages');
const port = Number(process.env.PORT ?? 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.pdf': 'application/pdf',
};

const escape = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 100_000) req.destroy();
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function echoForm(req, res) {
  const fields = [...new URLSearchParams(await readBody(req)).entries()];
  const items = fields.map(([k, v]) => `<li><b>${escape(k)}</b>: ${escape(v)}</li>`).join('');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Dados recebidos</title></head>` +
      `<body><h1>Dados recebidos</h1><ul id="dados">${items}</ul></body></html>`,
  );
}

createServer(async (req, res) => {
  const urlPath = (req.url ?? '/').split('?')[0];
  if (req.method === 'POST' && urlPath === '/agent/result') return echoForm(req, res);
  const path = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  const file = join(root, path === '/' || path === '\\' ? 'vision.html' : path);
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Não encontrado');
  }
}).listen(port, () => console.log(`Páginas de teste em http://localhost:${port}/`));
