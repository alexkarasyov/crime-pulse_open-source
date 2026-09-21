# Design system & restyle-readiness map

A map of the entire styling surface, written to make a **major restyling /
redesign drop** land cleanly. Read this before integrating new visuals.

_Last audited: 2026-06-10._

## Where styles live

| Layer | File(s) | What's in it |
|-------|---------|--------------|
| **Design tokens** | [`src/styles/tokens.css`](../src/styles/tokens.css) | 38 CSS custom properties: palette (`--bg`, `--surface*`, `--ink*`, `--accent*`, `--cat-*`), type (`--font-sans/-mono/-serif`), spacing (`--s-1..10`), radius (`--r-1..4`), shadow (`--shadow-1/2`), layout (`--max-w`, `--gutter`). **This is the theme contract.** |
| **Component / layout CSS** | [`src/styles/base.css`](../src/styles/base.css) | All class-based rules (topbar, hero, bigstat, cards, map, footer, tables, filterbar, caveats, etc.). Consumes tokens. |
| **Global import point** | [`src/layouts/Base.astro`](../src/layouts/Base.astro) | Imports Fontsource faces, then `tokens.css`, then `base.css`. Every page flows through `Base` → `Site`. |
| **Inline styles** | ~294 `style="…"` across `.astro` (153) + `.tsx` (141) | One-off spacing/sizing/colour on individual elements. **The main restyle friction — see below.** |
| **Fonts** | self-hosted via `@fontsource/ibm-plex-sans` + `-mono` (imported in `Base.astro`) | No third-party font request. |

There is **no** Tailwind, CSS-in-JS, CSS modules, or `<style>` blocks in
components — styling is plain global CSS + tokens + inline styles. A redesign
has a clean, conventional surface to work against.

## The token contract (what a palette/type swap touches)

Swapping the look **without touching markup** is possible to the extent that
styles reference tokens. Today:

- **Strong**: `base.css` rules and most inline styles reference `var(--…)`.
  Changing `tokens.css` alone restyles the bulk of the app (palette, fonts,
  spacing rhythm, radii).
- **Gaps (literals that bypass the tokens)** — these will NOT follow a token
  swap and must be edited directly:
  - `base.css`: ~15 `oklch(…)` literals — the topbar/filterbar translucent
    backgrounds (`oklch(0.16 …/0.85)`), `.sync-dot` green, and the
    up/down trend colours on `.bigstat-delta`, `.cat-card-foot .delta`,
    `.delta-cell .v`.
  - `.tsx`: `TorontoMap.tsx` uses hex literals (`#e9a35a`/`#7ec8a3`/`#9aa1a8`,
    `#0d1117`) for Leaflet path/marker styles — Leaflet writes these into SVG
    presentation attributes where `var()` is invalid, so they're resolved from
    tokens via `getComputedStyle` (`--accent`, `--cat-*`) or kept as literals.
  - JS trend colours are centralized in [`src/lib/format.ts`](../src/lib/format.ts)
    (`TREND_UP_COLOR`/`TREND_DOWN_COLOR`/`trendColor()`) — but these duplicate
    the CSS `.up`/`.down` literals. A redesign that recolours trends must touch
    both `tokens.css` (ideal: add `--trend-up/-down/-flat` tokens), `format.ts`,
    and the Leaflet hexes.
  - `.astro`: ~16 inline `oklch(…)` / theme literals (mostly the category
    headline cards on the Overview that set `color: var(--cat-*)` — those DO
    follow tokens; a handful set literal colours).

## Inline-style hotspots (the main friction)

294 inline `style=` attributes carry layout, spacing, and font-size decisions
directly on elements. Because inline styles win on specificity, **a redesign
delivered as new CSS classes cannot override them** — they'd have to be removed.
Densest files:

- `src/pages/index.astro`, `src/pages/about.astro`, `src/pages/neighbourhood/[id].astro` — heavy inline layout on hero/section/card markup.
- `src/layouts/Site.astro` — footer + topbar inline styles.
- Islands: `OverviewSignal1.tsx`, `NeighbourhoodHero.tsx`, `TorontoMapPanel.tsx`, `MapSidebar.tsx`, `CompareScreen.tsx` — inline styles on generated markup.

Many are genuinely reusable patterns (eyebrow rows, mono captions, delta chips)
that should become classes in `base.css`.

## How a redesign should integrate (by drop format)

- **New tokens only (palette / type / spacing swap)** → replace `tokens.css`.
  Then sweep the literal gaps above so they follow the new palette. Lowest
  effort; markup untouched.
- **New component stylesheet (new class system, same markup)** → the 294 inline
  styles are the blocker; they must be extracted to classes first or they'll
  override the new sheet. Plan a pre-pass to lift inline styles into `base.css`.
- **Full visual redesign (new markup + CSS)** → keep the data/logic layer
  (`src/lib/*`, the islands' behaviour, the `*.astro` frontmatter that loads
  aggregates) and rebuild the presentation. The token names are a reasonable
  contract to keep; the inline styles can be discarded with the old markup.

## What's already clean (don't re-do)

- No dead CSS or unused tokens shipping (pruned 2026-06-10; reserved tokens are
  annotated in `tokens.css`).
- Single global import path (`Base.astro`); no per-component stylesheets to hunt.
- Reduced-motion handled globally (`base.css` `@media (prefers-reduced-motion)`).
- Responsive breakpoints centralized at the bottom of `base.css` (1100px, 700px).
- A11y baseline: skip link, focus styles, `--ink-4` meets AA, SR-only data
  tables — preserve these through the redesign.

## Data/logic layer is decoupled from presentation

A redesign does **not** need to touch: the Python aggregation pipeline
(`scripts/`), the build-time loaders (`src/lib/aggregates.ts`), client state
(`src/lib/state.ts`, `urlState.ts`), the category metadata (`src/lib/categories.ts`),
or formatting helpers (`src/lib/format.ts`). Islands take typed props / read
signals; reskinning them is markup + CSS only.
