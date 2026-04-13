import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    // Bundle report: only generated when ANALYZE=true npm run build
    process.env.ANALYZE === 'true' && visualizer({
      filename: 'dist/bundle-report.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ].filter(Boolean),

  server: {
    host: true,
    port: 5173,
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core — cached independently, changes rarely
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-vendor';
          }
          // Vidstack — large media player, loaded only when needed
          if (id.includes('@vidstack')) {
            return 'vidstack';
          }
          // Lucide icons — static asset, changes only on upgrades
          if (id.includes('lucide-react')) {
            return 'icons';
          }
          // @tanstack — virtualization utilities
          if (id.includes('@tanstack')) {
            return 'tanstack';
          }
        },
      },
    },
  },
});
