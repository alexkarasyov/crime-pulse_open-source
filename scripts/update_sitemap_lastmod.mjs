// Post-build sitemap <lastmod> stamping — runs automatically at the end of
// `npm run build` (and build:dev).
//
// The rule: a page's <lastmod> advances only when that page's built HTML
// actually changed. We keep a committed manifest (data/sitemap-lastmod.json)
// of content hashes from the previous build; on each build we re-hash every
// page in the sitemap, bump lastmod to today's date for pages whose hash
// moved (or that are new), keep the stored date for unchanged pages, and
// rewrite dist/sitemap-0.xml with the result.
//
// Hashes are taken over the HTML with the one build-volatile string
// normalised out: the topbar freshness pill embeds `site built <date>` from
// the aggregate's generated_at, which advances on every aggregate rerun even
// when nothing else changed. Everything else in a page is deterministic
// (asset fingerprints only move when code moves; data strings only move when
// data moves), so the hash is a faithful "did this page change" signal.
//
// Commit data/sitemap-lastmod.json when it changes — it is the cross-build
// memory that makes "unchanged page keeps its old lastmod" work.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const DIST = resolve(ROOT, 'dist');
const SITEMAP = resolve(DIST, 'sitemap-0.xml');
const MANIFEST = resolve(ROOT, 'data', 'sitemap-lastmod.json');

if (!existsSync(SITEMAP)) {
  console.error('update_sitemap_lastmod: dist/sitemap-0.xml not found — run astro build first.');
  process.exit(1);
}

/** URL path → dist HTML file for the trailing-slash routes astro emits. */
function distFileFor(url) {
  const path = new URL(url).pathname; // "/", "/about/", "/neighbourhood/73/"
  const rel = path === '/' ? 'index.html' : `${path.replace(/^\/|\/$/g, '')}/index.html`;
  return resolve(DIST, rel);
}

/** Content hash with build-volatile strings normalised out. */
function pageHash(file) {
  const html = readFileSync(file, 'utf8')
    .replace(/site built \d{4}-\d{2}-\d{2}/g, 'site built X');
  return createHash('sha256').update(html).digest('hex');
}

const xml = readFileSync(SITEMAP, 'utf8');
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (urls.length === 0) {
  console.error('update_sitemap_lastmod: no <loc> entries found in sitemap-0.xml.');
  process.exit(1);
}

const prev = existsSync(MANIFEST)
  ? JSON.parse(readFileSync(MANIFEST, 'utf8'))
  : {};
const today = new Date().toISOString().slice(0, 10);

const next = {};
let changed = 0;
for (const url of urls) {
  const file = distFileFor(url);
  if (!existsSync(file)) {
    console.error(`update_sitemap_lastmod: sitemap lists ${url} but ${file} is missing.`);
    process.exit(1);
  }
  const hash = pageHash(file);
  const entry = prev[url];
  if (entry && entry.hash === hash) {
    next[url] = entry; // untouched page keeps its old lastmod
  } else {
    next[url] = { hash, lastmod: today };
    changed += 1;
  }
}

// Rewrite each <url> block with a <lastmod> right after its <loc>.
let stampedCount = 0;
const stamped = xml.replace(
  /<url><loc>([^<]+)<\/loc>(?:<lastmod>[^<]*<\/lastmod>)?/g,
  (m, loc) => {
    if (!next[loc]) return m;
    stampedCount += 1;
    return `<url><loc>${loc}</loc><lastmod>${next[loc].lastmod}</lastmod>`;
  },
);
// The rewrite regex assumes @astrojs/sitemap's exact <url><loc> adjacency.
// If a sitemap version changes shape, <loc> extraction above still succeeds
// while zero blocks match here — the manifest would then claim stamping that
// never landed in the XML. Verify every URL was actually stamped.
if (stampedCount !== urls.length) {
  console.error(
    `update_sitemap_lastmod: stamped ${stampedCount} of ${urls.length} <url> ` +
    'blocks — sitemap serialization may have changed shape; refusing to write.',
  );
  process.exit(1);
}
writeFileSync(SITEMAP, stamped);
writeFileSync(MANIFEST, `${JSON.stringify(next, null, 2)}\n`);

const dropped = Object.keys(prev).filter((u) => !(u in next)).length;
console.log(
  `sitemap lastmod: ${urls.length} URLs — ${changed} stamped ${today}, ` +
  `${urls.length - changed} unchanged${dropped ? `, ${dropped} removed from manifest` : ''}.`,
);
