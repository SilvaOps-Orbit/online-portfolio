import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "assets",
    emptyOutDir: false,
    sourcemap: false,
    minify: "oxc",
    rollupOptions: {
      input: resolve(process.cwd(), "src/react/loader.ts"),
      output: {
        entryFileNames: "react-widget-loader.js",
        chunkFileNames: "react/[name].js",
        assetFileNames: "react/[name][extname]"
      }
    }
  }
});
