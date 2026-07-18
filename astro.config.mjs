import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://wattlibrary.com',
  integrations: [sitemap()],
  trailingSlash: 'always',
});
