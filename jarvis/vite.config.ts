import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Tauri serves the build from ../dist and dev from port 5173 (see tauri.conf.json).
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', target: 'es2022' },
});
