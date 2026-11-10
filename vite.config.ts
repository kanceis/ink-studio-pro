import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      // .wrangler/ holds the local R2/D1 state of `npm run pages:dev`; changes there must not reload the app.
      watch: process.env.DISABLE_HMR === 'true' ? null : { ignored: ['**/.wrangler/**'] },
      // In development, send photo API calls to `npm run pages:dev` (Cloudflare Pages Functions).
      proxy: {
        '/api': 'http://127.0.0.1:8788',
        '/img': 'http://127.0.0.1:8788',
      },
    },
  };
});
