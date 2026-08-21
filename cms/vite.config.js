import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const root = path.dirname(fileURLToPath(import.meta.url));
const apiTarget = process.env.VITE_API_URL || 'http://127.0.0.1:3000';

export default defineConfig({
  root,
  plugins: [react(), tailwindcss()],
  server: {
    port: 4174,
    strictPort: true,
    host: '127.0.0.1',
    proxy: {
      '/login': { target: apiTarget, changeOrigin: true },
      '/google-login': { target: apiTarget, changeOrigin: true },
      '/me': { target: apiTarget, changeOrigin: true },
      '/admin': { target: apiTarget, changeOrigin: true },
    },
  },
});
