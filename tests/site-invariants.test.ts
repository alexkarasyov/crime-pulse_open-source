// Invariant checks over the BUILT site in dist/ — the HTML actually deployed.
// Complements tests/data-invariants.test.ts (which covers the aggregate JSON):
// this suite catches page-level regressions — missing surfaces, leaked dev
// routes, broken canonical/OG metadata, sitemap drift. Run `npm run build`
// first; the whole suite skips with a notice when dist/ is absent so a fresh
// clone can still run `npm test`.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIST = resolve(process.cwd(), 'dist');
const built = existsSync(resolve(DIST, 'index.html'));
const d = built ? describe : describe.skip;
if (!built) {
  console.warn('site-invariants: dist/ absent — run `npm run build` first; skipping.');
}

const NBHD_COUNT = 158;
const SITE = 'https://crimepulse.ca';

function page(rel: string): string {
  return readFileSync(resolve(DIST, rel), 'utf8');
}

const KEY_PAGES = [
  ['Overview', 'index.html', `${SITE}/`],
  ['About', 'about/index.html', `${SITE}/about/`],
  ['Compare', 'compare/index.html', `${SITE}/compare/`],
  ['Neighbourhood index', 'neighbourhood/index.html', `${SITE}/neighbourhood/`],
  ['Neighbourhood detail', 'neighbourhood/73/index.html', `${SITE}/neighbourhood/73/`],
] as const;

d('built surfaces', () => {
  it('emits every public surface', () => {
    for (const [, rel] of KEY_PAGES) {
      expect(existsSync(resolve(DIST, rel)), rel).toBe(true);
    }
    expect(existsSync(resolve(DIST, '404.html'))).toBe(true);
  });

  it('emits one page per neighbourhood', () => {
    // ids are not contiguous 1..158 — count emitted directories instead of
    // assuming the id axis.
    const html = page('neighbourhood/index.html');
    const emitted = new Set(
      [...html.matchAll(/href="\/neighbourhood\/(\d+)\//g)].map((m) => m[1]),
    );
    expect(emitted.size).toBe(NBHD_COUNT);
    for (const id of emitted) {
      expect(
        existsSync(resolve(DIST, 'neighbourhood', id!, 'index.html')),
        `neighbourhood ${id}`,
      ).toBe(true);
    }
  });

  it('does not leak dev-only routes into the production build', () => {
    expect(existsSync(resolve(DIST, 'project'))).toBe(false);
    expect(existsSync(resolve(DIST, 'styleguide'))).toBe(false);
  });

  it('ships deploy support files', () => {
    expect(existsSync(resolve(DIST, '_headers'))).toBe(true);
    expect(existsSync(resolve(DIST, 'robots.txt'))).toBe(true);
    expect(existsSync(resolve(DIST, 'favicon.svg'))).toBe(true);
    expect(existsSync(resolve(DIST, 'leaflet-1.9.4.css'))).toBe(true);
  });
});

d('page metadata', () => {
  it.each(KEY_PAGES)('%s has canonical, title, and description', (_label, rel, canonical) => {
    const html = page(rel);
    expect(html).toContain(`<link rel="canonical" href="${canonical}"`);
    expect(html).toMatch(/<title>[^<]{5,}<\/title>/);
    expect(html).toMatch(/<meta name="description" content="[^"]{20,}"/);
  });

  it.each(KEY_PAGES)('%s og:image resolves to a shipped file', (_label, rel) => {
    const html = page(rel);
    const m = html.match(/property="og:image" content="([^"]+)"/);
    expect(m, 'og:image tag present').not.toBeNull();
    const url = m![1]!;
    expect(url.startsWith(`${SITE}/`)).toBe(true);
    const local = url.slice(SITE.length + 1);
    expect(existsSync(resolve(DIST, local)), local).toBe(true);
  });

  it('every neighbourhood page has a canonical matching its path', () => {
    const html = page('neighbourhood/index.html');
    const ids = [...html.matchAll(/href="\/neighbourhood\/(\d+)\//g)].map((m) => m[1]!);
    for (const id of ids) {
      const nb = page(`neighbourhood/${id}/index.html`);
      expect(nb, `neighbourhood ${id}`).toContain(
        `<link rel="canonical" href="${SITE}/neighbourhood/${id}/"`,
      );
    }
  });
});

d('structured data (JSON-LD)', () => {
  function jsonLd(rel: string): Array<Record<string, unknown>> {
    const html = page(rel);
    return [...html.matchAll(
      /<script type="application\/ld\+json">(.*?)<\/script>/gs,
    )].map((m) => JSON.parse(m[1]!));
  }

  it('Overview carries WebSite + Dataset nodes', () => {
    const types = jsonLd('index.html').map((n) => n['@type']);
    expect(types).toContain('WebSite');
    expect(types).toContain('Dataset');
  });

  it('About carries the Dataset node with coverage metadata', () => {
    const ds = jsonLd('about/index.html').find((n) => n['@type'] === 'Dataset');
    expect(ds).toBeDefined();
    expect(ds!.license).toContain('open.toronto.ca');
    expect(String(ds!.temporalCoverage)).toMatch(/^2016-01-01\/\d{4}-\d{2}-\d{2}$/);
    expect(String(ds!.dateModified)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('every neighbourhood page carries a valid BreadcrumbList', () => {
    const html = page('neighbourhood/index.html');
    const ids = [...html.matchAll(/href="\/neighbourhood\/(\d+)\//g)].map((m) => m[1]!);
    for (const id of ids) {
      const bc = jsonLd(`neighbourhood/${id}/index.html`).find(
        (n) => n['@type'] === 'BreadcrumbList',
      );
      expect(bc, `neighbourhood ${id}`).toBeDefined();
      const items = bc!.itemListElement as Array<{ item: string }>;
      expect(items).toHaveLength(3);
      expect(items[2]!.item).toBe(`${SITE}/neighbourhood/${id}/`);
    }
  });
});

d('internal linking', () => {
  it('every neighbourhood page statically links its nearby neighbourhoods', () => {
    const html = page('neighbourhood/index.html');
    const ids = [...html.matchAll(/href="\/neighbourhood\/(\d+)\//g)].map((m) => m[1]!);
    const all = new Set(ids);
    for (const id of ids) {
      const nb = page(`neighbourhood/${id}/index.html`);
      const nav = nb.match(/<nav class="nearby-links"[^>]*>(.*?)<\/nav>/s);
      expect(nav, `neighbourhood ${id} nearby-links nav`).not.toBeNull();
      const links = [...nav![1]!.matchAll(/href="\/neighbourhood\/(\d+)\/"/g)].map((m) => m[1]!);
      expect(links.length, `neighbourhood ${id} link count`).toBeGreaterThanOrEqual(4);
      expect(links, `neighbourhood ${id} must not link itself`).not.toContain(id);
      for (const l of links) expect(all.has(l), `link target ${l} exists`).toBe(true);
    }
  });
});

d('sitemap + robots', () => {
  it('sitemap covers all public surfaces and every neighbourhood', () => {
    expect(existsSync(resolve(DIST, 'sitemap-index.xml'))).toBe(true);
    const xml = page('sitemap-0.xml');
    const locs = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
    for (const [, , canonical] of KEY_PAGES) {
      expect(locs.has(canonical), canonical).toBe(true);
    }
    const nbhdLocs = [...locs].filter((l) => /\/neighbourhood\/\d+\/$/.test(l!));
    expect(nbhdLocs).toHaveLength(NBHD_COUNT);
  });

  it('every sitemap entry has an ISO-date lastmod', () => {
    const xml = page('sitemap-0.xml');
    const entries = [...xml.matchAll(/<url>(.*?)<\/url>/gs)].map((m) => m[1]!);
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e, e.slice(0, 80)).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
    }
  });

  it('lastmod manifest is committed and consistent with the sitemap', () => {
    const manifestPath = resolve(process.cwd(), 'data', 'sitemap-lastmod.json');
    expect(existsSync(manifestPath), 'data/sitemap-lastmod.json').toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<
      string,
      { hash: string; lastmod: string }
    >;
    const xml = page('sitemap-0.xml');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
    expect(Object.keys(manifest).sort()).toEqual([...locs].sort());
    for (const [url, entry] of Object.entries(manifest)) {
      expect(entry.hash, url).toMatch(/^[0-9a-f]{64}$/);
      const inXml = xml.includes(`<loc>${url}</loc><lastmod>${entry.lastmod}</lastmod>`);
      expect(inXml, `${url} lastmod matches manifest`).toBe(true);
    }
  });

  it('sitemap has no dev routes and no 404', () => {
    const xml = page('sitemap-0.xml');
    expect(xml).not.toContain('/project');
    expect(xml).not.toContain('/styleguide');
    expect(xml).not.toContain('/404');
  });

  it('robots.txt allows crawling and points at the sitemap', () => {
    const robots = page('robots.txt');
    expect(robots).toContain('Allow: /');
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap-index.xml`);
  });
});
