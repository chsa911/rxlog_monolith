import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// vite.config.js
export default {
  server: { proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: true } } },
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
