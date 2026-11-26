import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        viewer: "viewer.html",
      },
    },
    sourcemap: true,
    target: "es2022",
  },
  server: {
    strictPort: true,
  },
});
