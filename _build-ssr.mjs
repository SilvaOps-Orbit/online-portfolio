import * as vite from 'vite';
import path from 'path';

async function main() {
  await vite.build({
    configFile: false,
    logLevel: 'error',
    build: {
      ssr: '_ssr-entry.mjs',
      outDir: '_ssr-out',
      rollupOptions: {
        external: ['react', 'react-dom', 'react-dom/server'],
      },
    },
    resolve: {
      alias: [
        { find: /^react-dom\/client$/, replacement: path.resolve('_rdomclient.mjs') },
        { find: /^lucide-react$/, replacement: path.resolve('_lucide.mjs') },
        { find: /^\.\/IslandBoundary$/, replacement: path.resolve('_island.mjs') },
        { find: /^\.\/portfolio-types$/, replacement: path.resolve('_ptypes.mjs') },
      ],
    },
  });
  console.log('BUILT');
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
