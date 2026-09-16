import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  publicDir: false,
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    sourcemap: false,
  },
  resolve: {
    alias: {
      '@ds': path.resolve(__dirname, 'design_system/ds'),
      '@design': path.resolve(__dirname, 'design_system'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [path.resolve(__dirname)],
    },
  },
  esbuild:
    mode === 'production'
      ? { drop: ['debugger'], pure: ['console.log', 'console.debug', 'console.info'] }
      : undefined,
}));
