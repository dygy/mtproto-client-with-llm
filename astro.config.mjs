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
    port: parseInt(process.env.PORT) || 4000,
    host: process.env.HOST || '0.0.0.0'
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
