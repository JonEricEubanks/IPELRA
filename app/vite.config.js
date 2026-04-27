import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_API_BASE_URL must be set at build time:
//   Local dev:  http://localhost:7071  (func start)
//   Production: https://func-ipelra-<suffix>.azurewebsites.net
// The value is baked into the JS bundle at build time.
// Update it in Azure Static Web App environment settings before building.

export default defineConfig({
  plugins: [react()],
  // Proxy /api → local Functions during local dev
  // In production React uses VITE_API_BASE_URL directly
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:7071',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
