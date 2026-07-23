import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [{
    name: "trim-generated-whitespace",
    generateBundle(_options, bundle) {
      Object.values(bundle).forEach((asset) => {
        if (asset.type === "chunk") {
          asset.code = asset.code.replace(/[\t ]+$/gm, "");
        }
      });
    }
  }],
  build: {
    chunkSizeWarningLimit: 550,
    outDir: "assets",
    emptyOutDir: false,
    sourcemap: false,
    minify: "oxc",
    rollupOptions: {
      input: resolve(process.cwd(), "src/react/loader.ts"),
      output: {
        entryFileNames: "react-widget-loader.js",
        chunkFileNames: "react/[name].js",
        assetFileNames: "react/[name][extname]",
        manualChunks(id) {
          return id.includes("node_modules/three") ? "three-runtime" : undefined;
        }
      }
    }
  }
});
