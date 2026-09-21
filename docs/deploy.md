# Deploying Toronto Crime Pulse

The site is **static** — Astro emits plain HTML/CSS/JS to `dist/` and Cloudflare
serves it. The current production host is the existing **Workers Static Assets**
service `crime-pulse`, mapped to `https://crimepulse.ca`. The repository has no
dynamic request handler, SSR, or Pages Functions (see the original static-hosting rationale in
[`../project/decisions/005-static-cloudflare-pages-only.md`](../project/decisions/005-static-cloudflare-pages-only.md)).
Nothing in this stack runs Python or Node *at request time*; both are
**build-time only** (see "Why the build needs Python" below).

## Publish to the existing production service

After `npm run verify` passes, publish the verified `dist/` with the checked-in
`wrangler.jsonc`:

```sh
npx wrangler deploy --keep-vars --strict
```

Use the existing authenticated Cloudflare account and confirm the target name
is `crime-pulse`. The custom domain is managed in Cloudflare; preserve that
mapping. `--keep-vars` preserves dashboard variables, while `--strict` rejects
conflicting remote configuration changes. Record the version ID and check the
live `crimepulse.ca` domain after deployment. The September 12, 2026 release
used Wrangler 4.131.1; its [production test record](tests/2026-09-12-production-deployment.md)
captures the version and smoke checks. This direct publication does not push
source changes to GitHub.

## Alternative: create a Cloudflare Pages project

1. Push the repo to GitHub (or GitLab).
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git** → pick this repo.
3. Set the build configuration:

   | Setting | Value |
   |---|---|
   | Production branch | `main` |
   | Framework preset | None (or "Astro") |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | *(leave blank — repo root)* |

4. Add the environment variables below.
5. **Save and Deploy.** Cloudflare clones, runs `npm run build`, and publishes
   `dist/`. Every later push to `main` redeploys automatically.

## Workers Static Assets configuration (`wrangler.jsonc`)

Since 2026-07-13 the repo also carries a [`wrangler.jsonc`](../wrangler.jsonc)
for deploying `dist/` as **Cloudflare Workers static assets** (`npx wrangler
deploy` after `npm run build`). Notes that differ from the Pages flow above:

- `assets.not_found_handling` is set to `"404-page"` — Workers assets defaults
  to a bodyless 404 and does **not** auto-serve `404.html` the way Pages does.
- `public/_headers` (CSP, cache rules) is honoured by Workers assets for
  static responses; verified locally via `wrangler dev` on 2026-07-16.
- Wrangler deploys the **already-built** `dist/` — the data + OG + Astro build
  runs on your machine, so the CF build-image notes below don't apply to this
  path. Environment variables like `SITE_URL` must be set in the local shell
  at build time instead.

## Environment variables

Set these under **Settings → Environment variables → Production** (and Preview
if you use preview deploys):

| Variable | Value | Why |
|---|---|---|
| `SITE_URL` | the canonical origin (only needed to override) | Bakes absolute `og:image`, `<link rel="canonical">`, and `sitemap` URLs. **Defaults to the production domain `https://crimepulse.ca`** (baked into [`../astro.config.mjs`](../astro.config.mjs) since 2026-07-16 — before that a `crime-pulse.pages.dev` placeholder). Set it only when building for a different host (e.g. a staging domain). |
| `PYTHON_VERSION` | `3.11` | Pins the build-image Python. CF's default image already ships Python 3, but pinning avoids surprises. |
| `NODE_VERSION` | `22` | Pins Node for the Astro build. **Must be ≥ 22.12** — `astro@7` requires it. A committed `.nvmrc` (`22.12`) covers this if the env var is omitted; setting both is harmless. |
| `PUBLIC_CF_BEACON_TOKEN` | the site token from Cloudflare → **Web Analytics** (see next section) | Enables the privacy-first, cookieless Web Analytics beacon. **Until set, no beacon ships** — the `<script>` in [`../src/layouts/Base.astro`](../src/layouts/Base.astro) only renders when this is present, so dev/local builds stay request-clean. The token is public by design (it appears in the page's `data-cf-beacon` attribute). Add to Preview too if you want analytics on preview deploys. |

`CF_PAGES_URL` is injected by Cloudflare automatically but is **deliberately
not** used as a fallback (removed 2026-06-10): it is the per-deploy hash
subdomain, so falling back to it would bake a different "canonical" host into
every deploy. When `SITE_URL` is unset, every build — including previews —
uses the `https://crimepulse.ca` production default from
[`../astro.config.mjs`](../astro.config.mjs).

## One-time: enable Cloudflare Web Analytics

The optional cookieless beacon sends page-view telemetry to Cloudflare. The
site does not make an absolute “No tracking” claim. The beacon is **not**
auto-injected — it ships only via the `PUBLIC_CF_BEACON_TOKEN` env var above,
so this is the full wiring:

1. Cloudflare dashboard → **Web Analytics** → **Add a site** → enter your
   production hostname. Cloudflare issues a **site token** (a hex string).
2. Set `PUBLIC_CF_BEACON_TOKEN = <that token>` under **Settings → Environment
   variables → Production** (and Preview, if wanted), then redeploy.
3. Do **not** also enable Cloudflare's "automatic injection" toggle — the beacon
   is already added by [`../src/layouts/Base.astro`](../src/layouts/Base.astro);
   turning on both ships it twice.
4. The CSP in [`../public/_headers`](../public/_headers) already allowlists
   `static.cloudflareinsights.com` (script) and `cloudflareinsights.com`
   (connect); without those the browser would silently block the beacon.

## Build-time dependencies the CF image must provide

`npm run build` runs three stages in order
(`python3 scripts/build_aggregates.py && node scripts/build_og_images.mjs && astro build`):

- **Python 3.** A normal deploy build parses committed Markdown with the
  standard library. `npm run refresh` also runs the population XLSX importer,
  whose `openpyxl` dependency is declared in `requirements.txt`; install it
  with `python3 -m pip install -r requirements.txt` before a refresh.
- **No outbound network needed.** The City's 158-neighbourhood boundary GeoJSON
  is vendored in the repo at `data/geo/neighbourhoods-4326.geojson` (since
  2026-07-09), so a deploy build reads it off disk — the CKAN endpoint being
  down cannot fail a deploy. `build_aggregates.py` slims it and writes the
  shipped copy into `dist/`. To pull a fresh upstream copy (e.g. if the City
  revises boundaries), run
  `python3 scripts/build_aggregates.py --refresh-geojson` and commit the
  updated file.
- **Node 22 (≥ 22.12) + npm.** Standard Astro build — `astro@7` hard-exits on
  anything lower (see `NODE_VERSION` above and `package.json` `engines`).

## Why the build needs Python (it's a compiler, not a runtime)

The shipped site is 100% static; **no Python runs in production or in any
visitor's browser.** Python runs once, during the build, to turn raw data into
the JSON the pages read:

- `import_tps_csi.py` / `import_population.py` — fetch + normalise TPS incident
  data and StatCan/Census population denominators into Markdown under `data/`.
- `build_aggregates.py` (~990 lines, stdlib-only) — parses that
  ~390k-row corpus into the JSON under `public/data/` (~60 MB) that every page
  reads at runtime.

Dropping Python would mean committing 60 MB of generated JSON and never
refreshing it — which defeats the data pipeline. So Python stays as a build
dependency. It costs nothing at serve time.

## Refresh cadence (manual, by design for v1)

There is **no automated rebuild cron** in v1 — the maintainer can't commit to a
fixed delivery schedule, so the site never promises one (user-facing freshness
shows when the TPS corpus was imported and the latest report date it covers —
not `generated_at`, which advances on any local aggregate rerun; see the
comment in `src/layouts/Site.astro`).
Automating a weekly rebuild is a deferred post-v1 item: see
[`../project/backlog.md`](../project/backlog.md) → **P1.9**.

To refresh data and redeploy by hand:

```bash
npm run refresh   # stage all four sources and produce .refresh/<run>/review.md
# Inspect that review before accepting its candidate:
npm run refresh:apply -- .refresh/<run>/review.json
npm run verify    # fresh dist/ + unit/data tests + responsive Chrome QA
# Review/commit the accepted source changes, then push when ready to deploy.
```

Refresh staging cannot replace accepted sources. Apply checks source/candidate
hashes, revalidates, and rolls back ordinary failures; do not build concurrently
with apply. See [ADR-011](../project/decisions/011-review-staged-data-before-acceptance.md)
for recovery after an interrupted apply, and the [browser QA guide](../tests/browser/README.md)
for Chrome setup. Cloudflare's build command remains `npm run build`.

Only Markdown under `data/` is committed; `public/data/`, `public/og/`, and the
build-emitted sitemap are gitignored and regenerated each build.

## Post-deploy smoke check

After the first deploy, confirm on the live URL:

- `/` loads; the Leaflet choropleth renders 158 shaded polygons (Leaflet CSS is
  self-hosted at `/leaflet-1.9.4.css`, so the map styles even if CDNs are down).
- `/favicon.svg`, `/robots.txt`, and `/sitemap-index.xml` all return 200.
- View source on `/` and a `/neighbourhood/<id>` page: `og:image`,
  `canonical`, and `twitter:image` all use your `SITE_URL` host (not the
  placeholder).
- Hit a nonexistent path (e.g. `/nope`): the branded 404 renders.
- Paste the URL into a card validator (e.g. opengraph.xyz) to confirm the OG PNG
  renders.
- View source on `/`: a `<script ... src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"…"}'>`
  is present (confirms `PUBLIC_CF_BEACON_TOKEN` was picked up). If it's missing,
  the env var wasn't set for this build. Then load a page and check the browser
  console/Network tab for no CSP errors on `beacon.min.js`; within a few minutes
  the visit should appear in Cloudflare → **Web Analytics**.
