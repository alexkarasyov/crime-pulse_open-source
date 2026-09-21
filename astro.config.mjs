// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

// Toronto Crime Pulse — static-only Astro config.
// Deployment target is Cloudflare Pages (static assets only).
// See project/decisions/005-static-cloudflare-pages-only.md for why
// there is no SSR adapter, no Workers, no Pages Functions.
//
// Preact is the only UI-framework integration. P1.7b uses it for the small
// number of state-holding islands (FilterBar, the Overview category picker,
// the Compare picker, the Neighbourhood feed filter, the Leaflet map host).
// Static rendering carries the rest of every screen.
//
// DEV vs PROD builds:
//   INCLUDE_DEV_ROUTES=1 → /project and /styleguide are emitted.
//   unset (or anything else) → public pages only (Overview, Neighbourhood,
//   Compare, About). The dev routes live in src/dev/, outside src/pages/,
//   so they are *only* materialised when the integration below injects
//   them — there is no path for them to leak into a prod build.
const includeDevRoutes = process.env.INCLUDE_DEV_ROUTES === '1';

/** @type {import('astro').AstroIntegration} */
const devRoutesIntegration = {
  name: 'crime-pulse:dev-routes',
  hooks: {
    'astro:config:setup': ({ injectRoute, logger }) => {
      if (!includeDevRoutes) {
        logger.info('dev routes OFF — /project and /styleguide will not be emitted');
        return;
      }
      logger.info('dev routes ON — /project and /styleguide will be emitted');
      injectRoute({ pattern: '/project', entrypoint: './src/dev/project.astro' });
      injectRoute({ pattern: '/styleguide', entrypoint: './src/dev/styleguide.astro' });
    },
  },
};

// Canonical site URL for absolute `og:image` and `<link rel="canonical">`.
// Override at build time: `SITE_URL=https://your-domain.example npm run build`.
// The default is the real production domain (P1.11, set 2026-07-16 — before
// that it was a `crime-pulse.pages.dev` placeholder that shipped to prod).
// Deliberately NOT falling back to `CF_PAGES_URL`: on Cloudflare Pages that
// is the deployment-specific hash subdomain (https://a1b2c3d4.<project>.pages.dev)
// even on production-branch builds, so using it would bake a different
// "canonical" URL into every deploy's canonicals/og:url/sitemap/robots.
const siteUrl = process.env.SITE_URL ?? 'https://crimepulse.ca';

export default defineConfig({
  site: siteUrl,
  output: 'static',
  // Preserve the existing template whitespace behavior across Astro 7.
  compressHTML: true,
  // Emit and link every route with a trailing slash. This matches Astro's
  // directory build output (about/index.html) so the baked <link rel=canonical>,
  // the og:url, and the @astrojs/sitemap URLs are all consistent — and every
  // internal href in the app is written with a trailing slash to match.
  trailingSlash: 'always',
  integrations: [preact(), sitemap(), devRoutesIntegration],
  server: {
    host: '127.0.0.1',
    port: 41690,
  },
  // strictPort can't be set in defineConfig's server block in current Astro;
  // we pass it via Vite below so `astro dev` fails fast if 41690 is taken
  // rather than silently moving to the next free port.
  vite: {
    // Small font subsets must remain first-party files: the deployed CSP
    // deliberately permits font-src 'self', without data: URLs.
    build: { assetsInlineLimit: 0 },
    server: {
      strictPort: true,
    },
    preview: {
      strictPort: true,
    },
  },
});
