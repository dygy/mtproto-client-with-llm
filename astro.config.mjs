import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false,
    })
  ],
  output: 'server',
  adapter: vercel({
    webAnalytics: {
      enabled: true
    },
    functionPerRoute: false,
    runtime: 'nodejs20.x'
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
