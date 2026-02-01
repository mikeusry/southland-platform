// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://southlandorganics.com',
  // base: '/podcast' - handled by Cloudflare Worker routing in production
  integrations: [
    react(),
    tailwind(),
    mdx()
  ],
  output: 'static',
  build: {
    format: 'directory'
  },
  vite: {
    define: {
      'import.meta.env.PUBLIC_SITE_URL': JSON.stringify(process.env.PUBLIC_SITE_URL || 'https://southlandorganics.com')
    }
  }
});
