import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [react(), {
    name: 'runtime-deployment-manifest',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'deployment.json',
        source: JSON.stringify({ schema_version: 1, runtime_config: true }) });
    },
  }],
  server: { proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } } },
});
