# Unindexed template survey

Survey of the 63 templates in `templates/raw/` that failed the first tokenizer passes with
"No usable index.html found" (2026-10-03).

The updated `findIndexHtml` in `tokenizer/index.js` now:

1. walks each template to depth 6, skipping `__MACOSX`, documentation dirs, `node_modules`, `vendor(s)`, `lib(s)`, `font(s)`,
   and server-template dirs (`templates/`, `views/`, `_layouts/`, `_includes/`, `_site/`)
2. takes the first static `index.html`
3. otherwise takes the shallowest common homepage name (`home.html`, `index-1.html`, `index1.html`, `index-2.html`,
   `index2.html`, `landing.html`, `main.html`, `demo.html`), then any `index-<variant>.html` (light/LTR variants first)
4. rejects documentation pages, empty or fragment files (no `<html>`/`<body>`), `.blade`/`.twig`/`.jinja`/`.liquid`/`.php`
   files, and any page containing `{% %}` tags, `<?php`, or Blade `@extends/@section/@yield/@include(`.

Two templates only had their static HTML inside a zip. Those zips were extracted in place (`arcado.zip`, `Goru.zip`).
Nothing was built or installed.

## Processed in this pass (4)

| id | framework | static HTML used | approach |
|---|---|---|---|
| arcado-nft-portfolio-html-template-2025-05-07-12-39-54-utc | Static HTML (zipped) | `main/arcado/index.html` (extracted from `main/arcado.zip`) | Extracted zip; tokenized |
| dating-mobile-app-pwa-html-template-romio-2026-01-29-05-25-22-utc | Static HTML (mobile PWA) | `Main File/Multipurpose Dating Mobile App PWA HTML Template - Romio/home.html` | `home.html` fallback; tokenized. Mobile-app UI, not a business site |
| goru-electronics-e-commerce-html-template-2023-11-27-04-58-27-utc | Static HTML (zipped) | `Goru_Package/Goru/index.html` (extracted from `Goru_Package/Goru.zip`) | Extracted zip; tokenized |
| sana-creative-multipurpose-html5-template-2024-08-01-10-36-16-utc | Static HTML | `Sana/index-agency-light.html` | `index-<variant>` fallback; tokenized (5 other home variants available) |

## Not processed (59)

| id | framework | best static HTML candidate | recommended approach |
|---|---|---|---|
| aeropage-laravel-multipurpose-landing-page-theme-2026-01-21-13-18-03-utc | Laravel (Blade) | none | Build: `composer install` + `php artisan serve`, then save rendered `/` as HTML |
| agenko-creative-digital-agency-php-template-2025-12-16-05-13-47-utc | Plain PHP (includes) | none | Render with `php -S` and save rendered `index.php` output |
| applock-next-js-15-app-landing-page-template-2026-02-04-05-34-19-utc | Next.js 15 | none | `npm ci && next build` with `output: 'export'`, use `out/index.html` |
| atroly-attorney-lawyer-react-nextjs-template-2026-01-18-18-36-44-utc | Next.js (React) | none | Static export (`next build` with `output: 'export'`) |
| aviator-responsive-email-themebuilder-access-2023-11-27-05-02-06-utc | Empty (email builder) | none | Directory is empty; re-download, or drop. It's an email product, not a site |
| avixa-multipurpose-figma-template-2026-01-23-16-11-19-utc | Figma design | none | Design file only; drop from the site catalog |
| baosh-digital-agency-php-template-2025-04-26-06-14-46-utc | Plain PHP (includes) | none | Render with `php -S` and save output |
| bentos-personal-portfolio-next-js-template-2026-02-04-15-58-05-utc | Next.js | none | Static export |
| borial-next-js-15-business-agency-template-2026-01-25-04-20-56-utc | Next.js 15 | none | Static export |
| bulidy-construction-business-laravel-template-2026-01-22-02-28-12-utc | Laravel (Blade) | none | Build and render with artisan |
| cargon-logistics-cargo-transportation-php-2026-02-04-17-39-31-utc | Plain PHP (includes) | none | Render with `php -S` and save output |
| chainex-multi-chain-crypto-wallet-2026-01-25-17-23-19-utc | React Native (iOS/Android app) | none | Native mobile app; drop from the site catalog |
| charitia-asp-net-core-charity-donation-template-2026-01-21-05-59-20-utc | ASP.NET Core MVC (Razor .cshtml) | none | `dotnet run` and save rendered pages, or drop |
| chatfox-ai-chatbot-mobile-app-figma-ui-kit-2026-01-21-17-20-02-utc | Figma UI kit | none | Design file only; drop |
| contis-ai-writer-copywriting-landing-page-reac-2024-07-15-08-50-31-utc | Next.js (app router, JS) | none | Static export |
| current-gatsby-js-electricity-services-template-2026-01-22-10-14-51-utc | Gatsby | none | `gatsby build`, use `public/index.html` |
| deskly-coworking-space-figma-template-2026-01-22-04-38-42-utc | Figma design | none | Design file only; drop |
| dojek-laravel-marketing-landing-page-template-2026-02-04-14-01-32-utc | Laravel (Blade) | none | Build and render with artisan |
| edudash-education-management-admin-dashboard-php-2026-01-27-17-16-03-utc | Plain PHP admin dashboard | none | Render with `php -S`. Admin UI, low value for business sites |
| eitech-it-agency-technology-startup-cakephp-2026-01-22-10-13-51-utc | CakePHP | none | `composer install` + `bin/cake server`, save rendered output |
| eventhub-ai-event-booking-mobile-app-figma-ui-kit-2026-01-31-18-37-51-utc | Figma UI kit | none | Design file only; drop |
| eventia-event-booking-mobile-app-figma-ui-kit-2026-02-05-13-48-32-utc | Figma UI kit | none | Design file only; drop |
| finco-finance-and-consulting-psd-template-2026-01-18-16-46-17-utc | PSD design | none | Design file only; drop |
| finza-finance-mobile-app-figma-ui-kit-2026-01-27-17-52-41-utc | Figma UI kit | none | Design file only; drop |
| foodox-food-delivery-mobile-app-figma-ui-kit-2026-02-04-06-20-31-utc | Figma UI kit | none | Design file only; drop |
| grafty-creative-agency-portfolio-symfony-template-2026-02-05-03-35-02-utc | Symfony (Twig) | none (only `*.html.twig`) | `composer install` + `symfony serve`, save rendered output |
| gstore-responsive-e-mail-template-2023-11-27-05-34-41-utc | HTML email (zipped) | `Files/Templates HTML.zip` → `Templates HTML/campaign monitor/index.html` | Email newsletter, not a website. Deliberately not extracted; drop or keep in a separate email catalog |
| happyhome-architect-construction-figma-templat-2025-08-21-13-08-52-utc | Figma design | none | Design file only; drop |
| helpy-charity-and-fundraising-symfony-template-2026-01-22-10-18-52-utc | Symfony (Twig) | none (only `*.html.twig`) | Build and render with Symfony |
| highlaw-law-firm-attorney-psd-templates-2026-01-29-20-11-22-utc | PSD design | none | Design file only; drop |
| hostc-laravel-12-web-hosting-provider-whmcs-2026-02-04-17-37-31-utc | Laravel 12 (Blade) | none | Build and render with artisan |
| indu-industrial-factory-psd-template-2026-01-23-05-55-25-utc | PSD design | none | Design file only; drop |
| keyra-multi-chain-crypto-wallet-app-ui-ux-2026-01-23-07-44-56-utc | React Native (iOS/Android app) | none | Native mobile app; drop |
| loxcy-landing-page-cakephp-template-2026-01-25-04-09-53-utc | CakePHP | none | Build and render with `bin/cake server` |
| martplace-multipurpose-marketplace-template-2026-01-29-08-14-12-utc | Next.js full-stack (DB/SQL) | none | Needs a database; static export unlikely to work. Drop or handle by hand |
| mirbal-yii-admin-dashboard-template-2026-02-04-05-43-27-utc | Yii2 admin dashboard | none (only icon-font demo pages under `libs/`) | Render with Yii. Admin UI, low value |
| naru-tailwind-nextjs-personal-portfolio-template-2025-03-13-09-32-32-utc | Next.js (Tailwind) | none | Static export |
| nemu-nextjs-personal-vcard-portfolio-template-2024-12-03-19-55-26-utc | Next.js | none | Static export |
| nexin-creative-digital-agency-figma-template-2026-02-04-06-30-34-utc | Figma design | none | Design file only; drop |
| nino-next-js-personal-portfolio-template-2025-08-02-04-43-30-utc | Next.js | none | Static export |
| nosic-laravel-12-responsive-landing-page-templat-2026-01-20-05-11-19-utc | Laravel 12 (Blade) | none | Build and render with artisan |
| nubia-minimal-blog-and-magazine-jekyll-theme-2023-11-27-05-01-17-utc | Jekyll (Liquid, zipped) | none (`nubia/nubia.zip` holds Liquid layouts only) | `jekyll build`, use `_site/index.html` |
| nunca-creative-agency-portfolio-figma-template-2024-09-18-04-16-08-utc | Figma design | none (`documentation.html` only) | Design file only; drop |
| nuur-nextjs-multipurpose-template-2024-12-03-12-24-08-utc | Next.js (JSX) | none | Static export |
| otech-cakephp-it-solutions-technology-startup-2026-01-22-10-20-53-utc | CakePHP | none | Build and render with `bin/cake server` |
| piku-creative-saas-software-php-template-2025-05-17-05-27-37-utc | Plain PHP (includes) | none | Render with `php -S` and save output |
| pixigon-php-online-courses-education-template-2026-02-04-05-43-21-utc | Plain PHP + Vite assets | none | Render with `php -S` and save output |
| pixy-creative-portfolio-template-2024-09-19-16-49-36-utc | Static HTML (incomplete extraction) | none (folders `css/ img/ js/ scss/ files/` all empty) | Re-extract the original download. The folder name has a trailing space, which likely broke the unzip on Windows |
| renev-modern-creative-agency-asp-net-core-9-mvc-2026-02-04-17-34-29-utc | ASP.NET Core 9 MVC (Razor) | none | `dotnet run` and save rendered pages, or drop |
| seox-gatsby-js-seo-digital-marketing-agency-2026-02-04-17-50-34-utc | Gatsby | none | `gatsby build`, use `public/index.html` |
| silicon-figma-business-technology-template-2026-01-21-13-18-03-utc | Figma design | none | Design file only; drop |
| stackly-app-landing-ai-software-business-figma-2026-01-22-16-53-27-utc | Figma design | none | Design file only; drop. The HTML version, `stackly-...-html-2026-01-18`, is already processed |
| tailwick-admin-dashboard-figma-template-2026-02-04-05-34-21-utc | Figma design | none | Design file only; drop |
| team-member-layout-html-template-pro-team-2024-12-19-04-14-09-utc | Static HTML component pack | `.../Grid-Layouts/layout-N/layout-N.html` (team-section snippets only) | Not a site template, so it was deliberately not picked. Drop, or use as a section library |
| techfolio-laravel-tailwindcss-portfolio-template-2025-03-25-18-27-33-utc | Laravel (Blade, Tailwind) | none | Build and render with artisan |
| techor-it-solution-technology-vue-nuxt-js-templ-2026-01-28-15-53-53-utc | Nuxt (Vue, zipped source) | none | Extract `techor.zip`, then `nuxt generate`, use `.output/public/index.html` |
| webadmin-php-admin-dashboard-template-2026-01-20-05-03-55-utc | Plain PHP admin dashboard | none | Render with `php -S`. Admin UI, low value |
| webfolio-creative-portfolio-nuxt-js-template-2025-03-06-15-29-40-utc | Nuxt 3 (Vue) | none | `nuxt generate`. The React version of webfolio is already processed |
| xpovio-digital-creative-agencytemplate-2025-11-06-16-16-45-utc | Plain PHP (includes) | none | Render with `php -S` and save output |

### Unprocessed templates by kind (59)

| kind | count | templates |
|---|---|---|
| Design-only (Figma/PSD) | 16 | avixa, chatfox, deskly, eventhub, eventia, finco, finza, foodox, happyhome, highlaw, indu, nexin, nunca, silicon, stackly-figma, tailwick |
| Native mobile app (React Native) | 2 | chainex, keyra |
| Next.js | 10 | applock, atroly, bentos, borial, contis, martplace, naru, nemu, nino, nuur |
| Plain PHP | 8 | agenko, baosh, cargon, edudash, piku, pixigon, webadmin, xpovio |
| Laravel | 6 | aeropage, bulidy, dojek, hostc, nosic, techfolio |
| CakePHP | 3 | eitech, loxcy, otech |
| Symfony | 2 | grafty, helpy |
| ASP.NET Core | 2 | charitia, renev |
| Gatsby | 2 | current, seox |
| Nuxt | 2 | techor, webfolio |
| Yii | 1 | mirbal |
| Jekyll | 1 | nubia |
| Other | 4 | aviator (empty), pixy (broken extraction), gstore (email), team-member (component pack) |

## Finding: 17 previously processed templates used the wrong page

With the stricter rules, 17 templates that are already in `manifest.json` no longer resolve. Under the old finder, they
were tokenized from a server-side template or from a `node_modules` example page:

- Django/Flask Jinja pages (`templates/**/index.html` with `{% %}`), 15: adminto-flask, advicx-django, artlink-django, domania-django,
  econest-django, econest-flask, herozi-flask, highdmin-django, jobya-django, lizehen-flask, nafty-flask,
  opixo-django, silva-flask, upbond-django, webadmin-django
- Expo apps whose "index.html" was `node_modules/plist/examples/browser/index.html`, 2: keyra-...-expo, wallo-...-ui-ux-expo

Resume skips them because their `schema.json` already exists, so they were left as they are. Recommendation: remove them from
`templates/processed/` and `manifest.json`, or replace them with rendered output. Their previews will show raw `{% %}` tags or an unrelated page.

**Done 2026-10-05:** the 17 were moved from `templates/processed/` to `templates/excluded/` (list in `excluded/IDS.txt`)
and removed from `manifest.json` (105 → 88). A tokenizer re-run won't bring them back: the stricter finder rejects them.
To restore one, render it properly (e.g. run the Flask/Django app and save `/`), put it in `raw/`, and re-run.
