import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Базовый путь нужен для статического хостинга в подкаталоге (GitHub Pages: /KuhnyaDreams/).
// Локально и в Docker остаётся корень: VITE_BASE не задан → '/'.
const base = process.env.VITE_BASE ?? '/';

// Фронтенд обращается к API по относительным путям /api/...,
// в режиме разработки запросы проксируются на ASP.NET Core (порт 5207).
export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5207',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});