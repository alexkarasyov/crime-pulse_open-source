// Dynamic robots.txt so the Sitemap directive uses the *configured* deploy
// domain (SITE_URL / CF_PAGES_URL / the default in astro.config.mjs) rather
// than a hardcoded host that goes stale on a custom domain. Prerendered to a
// static /robots.txt by `output: 'static'`.

import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const lines = ['User-agent: *', 'Allow: /'];
  if (site) {
    lines.push('', `Sitemap: ${new URL('sitemap-index.xml', site).href}`);
  }
  return new Response(lines.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
