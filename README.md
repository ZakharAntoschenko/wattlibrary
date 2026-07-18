# WattLibrary

Portable power station database. Astro static site, generated from `src/data/power_stations.json`.

## Структура
- `src/data/power_stations.json` — база (єдине джерело правди; додав модель → сторінки згенерувались)
- `src/pages/power-stations/[slug].astro` — шаблон сторінки моделі
- `src/pages/power-stations/index.astro` — каталог з фільтрами
- `src/lib/utils.js` — формули (runtime, $/Wh, альтернативи)

## Локальний запуск
```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # статика в dist/
```

## Деплой на Cloudflare Pages (разово, ~15 хв)
1. Створи репозиторій на GitHub (наприклад `wattlibrary`), запуш цю папку:
   ```bash
   git init && git add -A && git commit -m "initial"
   git remote add origin git@github.com:USERNAME/wattlibrary.git
   git push -u origin main
   ```
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git → вибери репозиторій.
3. Framework preset: **Astro**. Build command: `npm run build`, output: `dist`. Deploy.
4. Custom domains → додай `wattlibrary.com` (якщо домен у Cloudflare — один клік).
5. Далі кожен `git push` = автодеплой.

## Після першого деплою (важливо для SEO)
1. [Google Search Console](https://search.google.com/search-console) → додай домен → підтверди через DNS (Cloudflare) → Sitemaps → додай `https://wattlibrary.com/sitemap-index.xml`
2. [Bing Webmaster Tools](https://www.bing.com/webmasters) — імпорт із GSC одним кліком (Bing живить і DuckDuckGo, і ChatGPT search)

## Робочий процес наповнення
1. **Верифікація моделей**: у базі всі записи `verified: false`. Відкрий `brand_product_url`, звір цифри, виправ, постав `verified: true`. ~5 хв/модель.
2. **Нова модель**: додай об'єкт у JSON → push → сторінка з'явилась.
3. Дивись Search Console з 3-4 тижня: які сторінки набирають impressions → того типу робимо більше.

## Наступні фази (див. 03-seo-plan.md)
Фаза 2: compare-сторінки X vs Y · Фаза 3: калькулятори · Фаза 4: can-it-run · Фаза 5: solar compatibility
