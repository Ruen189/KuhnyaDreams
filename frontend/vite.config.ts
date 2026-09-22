import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Фронтенд обращается к API по относительным путям /api/...,
// в режиме разработки запросы проксируются на ASP.NET Core (порт 5207).
export default defineConfig({
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