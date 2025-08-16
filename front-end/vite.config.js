// vite.config.ts / vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,            // Vite dev server
    proxy: {
      '/api': {
        target: 'http://localhost:5174', // <-- point to your Express server on 5174
        changeOrigin: true,
      },
    },
  },
});
