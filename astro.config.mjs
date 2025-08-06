import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';

export default defineConfig({
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false,
    })
  ],
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover'
  },
  server: {
    port: 4000,
    host: true
  },
  vite: {
    define: {
      global: 'globalThis',
    },
    optimizeDeps: {
      exclude: ['telegram'],
      include: ['react', 'react-dom']
    },
    build: {
      rollupOptions: {
        external: ['telegram']
      }
    },
    esbuild: {
      logOverride: { 'this-is-undefined-in-esm': 'silent' }
    }
  },
  typescript: {
    strict: false
  }
});
