import * as vite from 'vite';
import path from 'path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';

const resolveMap = {
  'react-dom/client': path.resolve('_rdomclient.mjs'),
  'lucide-react': path.resolve('_lucide.mjs'),
  './IslandBoundary': path.resolve('_island.mjs'),
  './portfolio-types': path.resolve('_ptypes.mjs'),
};

async function main() {
  const server = await vite.createServer({
    configFile: false,
    logLevel: 'error',
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true },
    resolve: {
      alias: [
        { find: /^react-dom\/client$/, replacement: path.resolve('_rdomclient.mjs') },
        { find: /^lucide-react$/, replacement: path.resolve('_lucide.mjs') },
        { find: /^\.\/IslandBoundary$/, replacement: path.resolve('_island.mjs') },
        { find: /^\.\/portfolio-types$/, replacement: path.resolve('_ptypes.mjs') },
      ],
    },
  });

  await server.ssrLoadModule('/_ssr-entry.mjs');
  await server.close();
}

main().catch((e) => {
  console.error('FATAL:', e && e.message);
  console.error(e && e.stack);
  process.exit(1);
});
