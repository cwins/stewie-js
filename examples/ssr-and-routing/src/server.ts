import { createServer as createHttpServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, extname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const isProd = process.env.NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT ?? '3000', 10);

// MIME type map for static asset serving (production only)
const MIME: Record<string, string> = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

if (isProd) {
  // ---------------------------------------------------------------------------
  // Production: serve pre-built client assets from dist/client/
  // ---------------------------------------------------------------------------
  const { renderApp } = await import('./app.js');
  const clientDir = resolve(root, 'client');
  const template = readFileSync(resolve(clientDir, 'index.html'), 'utf-8');

  const server = createHttpServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

    // Try static asset first
    const assetPath = resolve(clientDir, url.pathname.slice(1));
    if (assetPath.startsWith(clientDir) && assetPath !== clientDir && existsSync(assetPath)) {
      const ext = extname(assetPath);
      res.writeHead(200, { 'content-type': MIME[ext] ?? 'application/octet-stream' });
      res.end(readFileSync(assetPath));
      return;
    }

    // SSR render
    try {
      const { html: appHtml, stateScript } = await renderApp(req.url ?? '/');
      const html = template.replace('<!--ssr-outlet-->', appHtml).replace('</body>', `  ${stateScript}\n  </body>`);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (e) {
      res.writeHead(500);
      res.end(String(e));
    }
  });

  server.listen(PORT, () => {
    console.log(`Stewie SSR+Routing demo (production) at http://localhost:${PORT}`);
  });
} else {
  // ---------------------------------------------------------------------------
  // Development: Vite dev server as middleware
  // ---------------------------------------------------------------------------
  const { createServer: createViteServer } = await import('vite');

  const vite = await createViteServer({
    root,
    server: { middlewareMode: true },
    appType: 'custom'
  });

  const server = createHttpServer((req, res) => {
    vite.middlewares(req, res, () => {
      (async () => {
        try {
          const { renderApp } = (await vite.ssrLoadModule('/src/app.tsx')) as {
            renderApp: (url: string) => Promise<{ html: string; stateScript: string }>;
          };

          const rawTemplate = readFileSync(resolve(root, 'index.html'), 'utf-8');
          const template = await vite.transformIndexHtml(req.url ?? '/', rawTemplate);

          const { html: appHtml, stateScript } = await renderApp(req.url ?? '/');
          const html = template.replace('<!--ssr-outlet-->', appHtml).replace('</body>', `  ${stateScript}\n  </body>`);

          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
          res.end(html);
        } catch (e) {
          vite.ssrFixStacktrace(e as Error);
          res.writeHead(500);
          res.end(String(e));
        }
      })();
    });
  });

  server.listen(PORT, () => {
    console.log(`Stewie SSR+Routing demo (dev) at http://localhost:${PORT}`);
  });
}
