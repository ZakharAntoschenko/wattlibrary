import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  site: 'https://wattlibrary.com',
  integrations: [sitemap()],
  trailingSlash: 'always',
  output: "hybrid",
  adapter: cloudflare()
});