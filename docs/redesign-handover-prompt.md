# Claude Design handover prompt — apply the redesign & produce the build bundle

The creative direction + branding are **already done** in Claude Design. This
prompt tells it to **apply that finished design across the whole product** and
emit a complete, **drop-in** handoff bundle for this Astro + Preact codebase.

## What to send Claude Design

1. The block under **"## PROMPT"** below (paste as-is — nothing to fill in).
2. **Attach `src/styles/tokens.css` and `src/styles/base.css`** — these are the
   current token names + CSS selector contract. Having them lets Claude Design
   restyle the *same* selectors/tokens, which is what makes the result a drop-in
   instead of a rewrite. (Optional: also attach `docs/design-system.md` for context.)

Paste in the same Claude Design project/session where the redesign was created
so it has the new brand in context; if it's a fresh session, also attach the
redesign artifacts/mockups.

---

## PROMPT

You have **already redesigned Toronto Crime Pulse** — the brand, visual
language, palette, and type direction are final. Your job now: **apply that
finished design across the entire product and produce a complete, drop-in
handoff bundle** for engineering. Prioritise **coverage, consistency, and
portability** over new creative exploration. The look is settled; make it real
across every screen, component, and state.

**The attached `tokens.css` and `base.css` are the integration contract.**
They define the CSS custom-property names and the class/selector names the
codebase already uses. Restyle **those same selectors and token names** so your
output is a drop-in replacement. Keep every selector and token name that still
applies; where your redesign changes a component's structure, provide the new
markup and record the change in `INTEGRATION.md` (below). Don't invent a parallel
class system, and don't use inline styles (the codebase is being cleaned of them).

If the redesign isn't in this session's context, treat the attached
mockups/artifacts as the source of truth for the visual language.

### What the product is

A calm, evidence-led static dashboard of 10 years (2016–2025) of Toronto Police
Community Safety Indicators, normalised to **incidents per 10,000 residents**,
across **158 neighbourhoods** and **5 crime categories** (Assault, Auto Theft,
Break and Enter, Robbery, Theft Over $5,000). Audience: public, journalists,
residents. Tone: measured, non-alarmist, trustworthy. This is a **reskin of a
shipped product** — IA, data, and behaviour are fixed.

### RETURN BUNDLE — deliver exactly this file tree

```
handoff/
  README.md              Overview of the bundle + how to read it.
  tokens.css             Drop-in replacement for src/styles/tokens.css — the full
                         theme as :root custom properties (contract below).
  base.css               Drop-in replacement for src/styles/base.css — all component
                         /layout styles, targeting the SAME class selectors as the
                         attached base.css (add new selectors only when structure
                         changes; list those in INTEGRATION.md).
  prototype/             A runnable static prototype (plain HTML + the two CSS files
    index.html             above + minimal JS) rendering all 7 surfaces in the new
    neighbourhood.html     design. Must run by opening the file / a static server —
    compare.html           no build step, no framework required. This is what
    about.html             engineering visually diffs against during the port.
    404.html
  components.html        Component sheet: every primitive in every state, labelled.
  brand/                 mark.svg, lockup.svg, wordmark.svg, favicon.svg — as clean,
                         inline-able SVG source (currentColor where appropriate).
  fonts.md               Font families used + their Fontsource package names (or
                         static file sources) and the exact weights needed.
  map-and-charts.md      (a) Resolved colour VALUES (hex/oklch) for every Leaflet
                         map state — polygon fill ramp, stroke, selected, hover,
                         YoY ▲▼— arrows, legend. (b) SVG geometry specs for the
                         sparkline, line/area trend chart, small-multiples, and
                         calendar heatmap (viewBox, paddings, tick counts, stroke
                         weights, label placement, marker for the 2020 line).
  INTEGRATION.md         The change manifest — see next.
```

**`INTEGRATION.md` must let a developer port the bundle without guessing:**
- New / renamed / removed **tokens** vs the attached `tokens.css`.
- New / renamed / removed **class selectors** vs the attached `base.css`.
- **Per surface**, any markup/DOM-structure change (so the `.astro`/`.tsx` can be
  updated), with the new markup snippet.
- Any new assets (fonts, SVGs) and where they go.
- Anything intentionally left for engineering.

Use semantic, class-based CSS consuming the tokens — **no inline styles.**

### Apply across EVERY surface (no gaps — extend the system if your comps only covered some)

1. **Overview (home)** — hero big-stat card (headline metric + sparkline +
   deltas), 5-category grid, full-city **interactive choropleth map** with legend
   + hover panel, year-by-year trend chart, national-context (Crime Severity
   Index) card, three editorial "signal" cards.
2. **Neighbourhood index** — type-ahead search, the choropleth (click to open),
   a sortable/searchable 158-row table with inline sparklines + YoY arrows.
3. **Neighbourhood detail** — hero big-stat + delta strip, local-vs-city trend
   chart, month×year **calendar heatmap**, context mini-map, "nearest neighbours"
   comparison table, chronological incident feed (date / category / offence /
   premises only).
4. **Compare** — pick 2–4 neighbourhoods; shared-axis multi-line chart, numeric
   comparison table, per-pick small-multiples.
5. **About** — long-form methodology with a sticky table of contents.
6. **404** — branded not-found.
7. **Shared chrome** — sticky top bar (brand lockup, primary nav, "data through
   {date}" freshness pill, rate/count unit toggle), sticky **FilterBar** (category
   chips, year-range selects, "+ Include YTD" toggle, copy-link, unit toggle),
   footer.

Design each at **desktop, 1100px, and 700px** (the existing breakpoints).

### Every primitive, every state

Cover (these map to existing selectors — see attached `base.css`): big-stat card
(`.bigstat*`); category/metric cards (`.cat-card*`, `.card*`); **caveat callouts**
4 variants info/warn/exclude/scope (`.caveat*`); filter chips & segmented toggle
(`.filter-chip`, `.seg`/`.seg-btn`); sortable tables (`.cmp-table`,
`.nbhd-index-*`); sparkline, line/area trend chart (baseline overlay +
2020-pandemic marker), small-multiples (`.sm-*`), calendar heatmap (`.cal-*`),
choropleth + legend + hover panel (`.map-*`, `.legend-*`, `.hex-tooltip*`,
`.leaflet-cp-tooltip`); CSI bars (`.csi-*`); delta strip (`.delta-*`); feed
(`.feed-*`); type-ahead picker (`.nbhd-picker*`); "load more" pagination; brand
mark/lockup/wordmark/favicon; top bar + FilterBar + footer chrome.

For each: default / hover / active / focus-visible / disabled / empty / loading /
error.

### Token contract — deliver as `:root { --… }`, keep these names

The code references these everywhere; keep them (add new ones freely; flag drops
in `INTEGRATION.md`):

```
Palette:  --bg --bg-soft --surface --surface-2 --surface-3
          --border-soft --border --border-loud
          --ink --ink-2 --ink-3 --ink-4
          --accent --accent-soft --accent-line
Category: --cat-assault --cat-autoTheft --cat-breakEnter --cat-robbery --cat-theftOver
          (+ a -dim variant of each)
Trend:    --trend-up --trend-down --trend-flat   (add these — currently inlined)
Type:     --font-sans --font-mono   (--font-serif optional)
Space:    --s-1 … --s-10   Radius: --r-1 … --r-4, --r-full
Shadow:   --shadow-1 --shadow-2   Layout: --max-w --gutter
```

### Hard technical constraints (so it integrates)

- **Static Astro + Preact islands on Cloudflare Pages. No SSR, no backend.**
- **Charts are hand-rolled SVG** (no Chart.js/D3/charting lib) — hence the SVG
  geometry specs in `map-and-charts.md`.
- **Map is Leaflet** + CartoDB tiles + GeoJSON polygons; map colours go into SVG
  presentation attributes where CSS `var()` is invalid — hence the resolved map
  colour values in `map-and-charts.md`.
- **Self-hosted fonts** (no Google Fonts CDN); new faces must be on Fontsource or
  shippable as static files; keep the weight count small.
- Theme ships as the CSS custom properties above.

### Accessibility & ethics the design must uphold

- **WCAG AA** for all text/background and chart stroke/fill pairings (4.5:1
  normal, 3:1 large/graphical) on their backgrounds — include contrast evidence.
- The 5 category colours must be colour-vision-deficiency safe **and** each
  carries a **distinct glyph** (diamond/square/triangle/circle/cross) — colour is
  never the only signal.
- Default unit **rate per 10,000 residents** (counts via toggle). **No "safe"/
  "dangerous" place labels. No incident dots/addresses/point maps. No relative
  dates.** Designed homes for the load-bearing caveats: 2021 Census **25% sample**
  basis, frozen-2021 denominator for 2022–2025, YTD partial-year flag,
  sexual-assault exclusion, and an honest "data through {date}" freshness signal.
- Focus-visible treatment, reduced-motion behaviour, and an SR-only data-table
  alternative for every chart.

### Out of scope (do not change)

Data pipeline, aggregate JSON schema, the numbers/methodology, IA + URL
structure, the static-only architecture, the ethics rules. No new runtime
dependencies; no charting library; no third-party calls.

---

## Notes for whoever runs this

- When the bundle returns, point me (Claude Code) at the `handoff/` folder and
  I'll port it in: `tokens.css` + `base.css` swap, apply `INTEGRATION.md`'s markup
  changes, drop in the brand SVGs + fonts, wire the map/chart colour values, and
  remove the old inline styles the new selectors replace.
- The data/logic layer (`scripts/`, `src/lib/*`, island behaviour) is decoupled
  and shouldn't need changes — the port is markup + CSS + tokens.
