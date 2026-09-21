// Build-time OG image generator.
//
// Renders one PNG per neighbourhood (and one default) into `public/og/`.
// Uses @resvg/resvg-js to rasterise an SVG template in the "Live Signal"
// palette (electric blue + Space Grotesk / JetBrains Mono), reading the
// Fontsource woff2 faces directly so output is deterministic across macOS
// dev and Linux CI/CD without bundling separate TTFs.
//
// PNG (1200x630) is chosen over SVG so Facebook/LinkedIn render real
// preview cards — they ignore SVG og:image. Discord/Slack/X handle both.
//
// Run from npm `build` after `build_aggregates.py` produces the JSON.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const AGG_PATH = resolve(ROOT, 'public/data/aggregates/by-neighbourhood-year.json');
const OG_DIR = resolve(ROOT, 'public/og');
// "Live Signal" faces, bundled as TTFs under scripts/fonts/ so output is
// deterministic across macOS dev and Linux CI. (resvg-js does not decode the
// Fontsource woff2 — text silently drops — so static TTFs are committed. Both
// families are SIL OFL 1.1; see the *-OFL.txt alongside.)
const FONT_DIR = resolve(HERE, 'fonts');
const FONT_FILES = [
  resolve(FONT_DIR, 'SpaceGrotesk-Medium.ttf'),
  resolve(FONT_DIR, 'SpaceGrotesk-SemiBold.ttf'),
  resolve(FONT_DIR, 'SpaceGrotesk-Bold.ttf'),
  resolve(FONT_DIR, 'JetBrainsMono-Medium.ttf'),
  resolve(FONT_DIR, 'JetBrainsMono-Bold.ttf'),
];

const W = 1200;
const H = 630;

// Comparable-year window shown in every card's footer — derived from the
// aggregate in main() so the label can't go stale when the window rolls.
let footerYears = '';

// resvg understands sRGB hex; we resolve the oklch tokens to their
// approximate sRGB equivalents up front so the renderer doesn't need
// to interpret CSS color functions.
const COLOR = {
  bg: '#090d13',
  bgSoft: '#14181f',
  border: '#353d49',
  ink: '#f2f5f9',
  ink2: '#c0c5c9',
  ink3: '#8d929b',
  accent: '#4893f2',
};

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// The title sits at x=96 on a 1200px canvas; reserve a matching 96px right
// margin, so the usable text width is W - 192 = 1008px. Long neighbourhood
// names (the longest, "St Lawrence-East Bayfront-The Islands", is 37 chars)
// overflow at the base 84px size, so we step the size down as the name grows
// and, as a hard backstop, cap the rendered run to TITLE_MAX_WIDTH with SVG
// textLength/lengthAdjust — guaranteeing no clip even for an unexpectedly long
// future name.
const TITLE_X = 96;
const TITLE_MAX_WIDTH = W - 2 * TITLE_X; // 1008px
const TITLE_BASE_SIZE = 84;
const TITLE_MIN_SIZE = 48;

function titleFontSize(title) {
  const len = String(title).length;
  // Comfortable up to ~22 chars at the base size; shrink ~2px per extra char
  // past that, down to a readable floor.
  if (len <= 22) return TITLE_BASE_SIZE;
  return Math.max(TITLE_MIN_SIZE, TITLE_BASE_SIZE - (len - 22) * 2);
}

// Rough mean glyph advance for Space Grotesk SemiBold (with the -1.5 tracking)
// as a fraction of the em. Used only to decide whether to clamp width — it
// overestimates slightly, which is the safe direction (we'd rather clamp a
// borderline title than let it clip).
const TITLE_GLYPH_EM = 0.56;

// Build the title <text>. We apply textLength/lengthAdjust ONLY when the
// estimated natural width would overflow TITLE_MAX_WIDTH — applying it
// unconditionally would also *stretch* short titles to fill 1008px, which
// looks wrong. When the estimate fits, we emit a plain run at its natural
// width. The font-size step-down handles the common case; this clamp is the
// hard backstop that guarantees no clip even for an unexpectedly long name.
function titleTextEl(title, size) {
  const estWidth = String(title).length * size * TITLE_GLYPH_EM;
  const clamp =
    estWidth > TITLE_MAX_WIDTH
      ? ` textLength="${TITLE_MAX_WIDTH}" lengthAdjust="spacingAndGlyphs"`
      : '';
  return `<text x="${TITLE_X}" y="260" fill="${COLOR.ink}" font-family="Space Grotesk" font-size="${size}" font-weight="600" letter-spacing="-1.5"${clamp}>
    ${escapeXml(title)}
  </text>`;
}

function ogSvg({ eyebrow, title, subtitle, stat, statLabel }) {
  const titleSize = titleFontSize(title);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${COLOR.bg}"/>
  <rect x="48" y="48" width="${W - 96}" height="${H - 96}" fill="${COLOR.bgSoft}" stroke="${COLOR.border}" stroke-width="1" rx="20"/>

  <!-- accent rail -->
  <rect x="48" y="48" width="6" height="${H - 96}" fill="${COLOR.accent}" rx="3"/>

  <!-- brand mark (Live Signal equalizer), top-right -->
  <g transform="translate(1042, 86)">
    <rect x="0"  y="22" width="8" height="22" rx="1.5" fill="${COLOR.ink}"/>
    <rect x="13" y="12" width="8" height="32" rx="1.5" fill="${COLOR.ink}"/>
    <rect x="26" y="18" width="8" height="26" rx="1.5" fill="${COLOR.ink}"/>
    <rect x="39" y="0"  width="8" height="44" rx="1.5" fill="${COLOR.accent}"/>
    <rect x="52" y="14" width="8" height="30" rx="1.5" fill="${COLOR.ink}"/>
  </g>

  <!-- eyebrow -->
  <text x="96" y="132" fill="${COLOR.accent}" font-family="JetBrains Mono" font-size="22" font-weight="500" letter-spacing="3">
    ${escapeXml(eyebrow.toUpperCase())}
  </text>

  <!-- title -->
  ${titleTextEl(title, titleSize)}

  <!-- subtitle -->
  <text x="96" y="320" fill="${COLOR.ink2}" font-family="Space Grotesk" font-size="28" font-weight="500">
    ${escapeXml(subtitle)}
  </text>

  ${
    stat != null
      ? `
  <!-- stat -->
  <text x="96" y="460" fill="${COLOR.ink3}" font-family="JetBrains Mono" font-size="18" font-weight="500" letter-spacing="2">
    ${escapeXml(statLabel.toUpperCase())}
  </text>
  <text x="96" y="528" fill="${COLOR.accent}" font-family="JetBrains Mono" font-size="64" font-weight="700">
    ${escapeXml(stat)}
  </text>
  `
      : ''
  }

  <!-- footer: wordmark (left) + source (right) -->
  <text x="96" y="556" fill="${COLOR.ink}" font-family="Space Grotesk" font-size="22" font-weight="700" letter-spacing="-0.5">crime<tspan fill="${COLOR.accent}">.</tspan>pulse</text>
  <text x="${W - 96}" y="555" fill="${COLOR.ink3}" font-family="JetBrains Mono" font-size="18" font-weight="500" text-anchor="end" letter-spacing="1">
    TPS COMMUNITY SAFETY INDICATORS · ${escapeXml(footerYears)}
  </text>
</svg>
`;
}

function renderPng(svg) {
  const resvg = new Resvg(svg, {
    background: COLOR.bg,
    font: {
      loadSystemFonts: false,
      fontFiles: FONT_FILES,
      defaultFontFamily: 'Space Grotesk',
    },
    fitTo: { mode: 'width', value: W },
  });
  return resvg.render().asPng();
}

function rateOrDash(rates, idx) {
  const v = rates[idx];
  if (v == null) return null;
  return Math.round(v * 10) / 10;
}

function main() {
  rmSync(OG_DIR, { recursive: true, force: true });
  mkdirSync(OG_DIR, { recursive: true });

  let agg;
  try {
    agg = JSON.parse(readFileSync(AGG_PATH, 'utf-8'));
  } catch (e) {
    // Fail the build rather than silently shipping only default.png — every
    // neighbourhood page references /og/n-<id>.png, so a missing aggregate
    // here would 404 all per-neighbourhood OG cards in production.
    console.error(`[og] FATAL: could not read ${AGG_PATH}: ${e.message}`);
    process.exit(1);
  }

  const nbhds = agg.neighbourhoods ?? {};

  // Footer year window, from any series' full (non-partial) years.
  const anyFull = (Object.values(nbhds)[0]?.series?.assault ?? []).filter(
    (p) => !p.partial,
  );
  footerYears = anyFull.length
    ? `${anyFull[0].year}–${anyFull[anyFull.length - 1].year}`
    : '';

  // Default OG (for /, /about, /compare, /neighbourhood/).
  writeFileSync(
    resolve(OG_DIR, 'default.png'),
    renderPng(
      ogSvg({
        eyebrow: '§ Toronto Crime Pulse',
        title: 'Ten years of Toronto crime, by the numbers.',
        subtitle:
          'Counts & rates per 10K, 158 neighbourhoods.',
        stat: '5 categories · 158 nbhds',
        statLabel: 'What is inside',
      }),
    ),
  );
  let count = 0;
  for (const n of Object.values(nbhds)) {
    // Drop partial (YTD) rows so we don't surface a null rate as "missing".
    const assault = (n.series?.assault ?? []).filter((p) => !p.partial);
    const lastIdx = assault.length - 1;
    const rate = rateOrDash(assault.map((p) => p.rate_per_10k), lastIdx);
    const lastYear = lastIdx >= 0 ? assault[lastIdx].year : null;
    const stat = rate != null && lastYear != null ? `${rate.toFixed(1)} per 10K` : null;
    const statLabel = lastYear != null ? `Assault rate, ${lastYear}` : '';
    writeFileSync(
      resolve(OG_DIR, `n-${n.id}.png`),
      renderPng(
        ogSvg({
          eyebrow: `Neighbourhood N° ${n.id}`,
          title: n.name,
          subtitle: `Population ${Number(n.population ?? 0).toLocaleString('en-CA')} · 10-year trend`,
          stat,
          statLabel,
        }),
      ),
    );
    count++;
  }
  console.log(`[og] wrote default + ${count} neighbourhood OG PNGs to public/og/`);
}

try {
  main();
} catch (e) {
  // A render failure partway through leaves public/og/ incomplete (it was
  // cleared at the top of main). Surface a nonzero exit so CI fails instead
  // of deploying a site with missing OG cards.
  console.error(`[og] FATAL: ${e.stack || e.message}`);
  process.exit(1);
}
