// Social media image generator for Toronto Crime Pulse.
// Same approach as scripts/build_og_images.mjs: SVG templates in the
// "Live Signal" palette rasterised with @resvg/resvg-js using the committed
// brand TTFs, real numbers read from public/data/aggregates/toronto-by-year.json.
//
// Outputs to <repo>/social/:
//   instagram-story.png  1080x1920
//   x-post.png           1600x900
//   facebook-post.png    1200x630
//   linkedin-post.png    1200x627
//
// "10 years, by the numbers" spark-chart card set (shared tableCard):
//   square-post.png        1080x1080
//   numbers-linkedin.png   1200x627
//   numbers-facebook.png   1200x630
//   numbers-x.png          1600x900
//   numbers-instagram.png  1080x1350

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(ROOT, 'package.json'));
const { Resvg } = require('@resvg/resvg-js');

const OUT = resolve(ROOT, 'social');
const FONT_DIR = resolve(ROOT, 'scripts/fonts');
const FONT_FILES = [
  resolve(FONT_DIR, 'SpaceGrotesk-Medium.ttf'),
  resolve(FONT_DIR, 'SpaceGrotesk-SemiBold.ttf'),
  resolve(FONT_DIR, 'SpaceGrotesk-Bold.ttf'),
  resolve(FONT_DIR, 'JetBrainsMono-Medium.ttf'),
  resolve(FONT_DIR, 'JetBrainsMono-Bold.ttf'),
];

// tokens.css oklch values resolved to sRGB hex (resvg needs hex).
const C = {
  bg: '#090d13',
  bgSoft: '#10151b',
  surface: '#151a20',
  surface2: '#1d2229',
  borderSoft: '#292e36',
  border: '#3c434d',
  ink: '#f3f5f8',
  ink2: '#c1c4c9',
  ink3: '#8d939a',
  ink4: '#7b8189',
  accent: '#4992f2',
  accentGlow: '#65a9ff',
  trendUp: '#ffa460',   // more incidents — warm amber, not red
  trendDown: '#69d6aa', // fewer — cool teal
  cat: {
    assault: '#fda856',
    autoTheft: '#40b8ee',
    breakEnter: '#d894e2',
    robbery: '#80d58d',
    theftOver: '#b29bee',
  },
};

const CATEGORIES = [
  { id: 'assault', name: 'Assault', glyph: 'diamond' },
  { id: 'autoTheft', name: 'Auto Theft', glyph: 'square' },
  { id: 'breakEnter', name: 'Break & Enter', glyph: 'triangle' },
  { id: 'robbery', name: 'Robbery', glyph: 'circle' },
  { id: 'theftOver', name: 'Theft Over $5,000', glyph: 'cross' },
];

const URL_LINE = 'crimepulse.ca';
const SOURCE_LINE = 'TPS COMMUNITY SAFETY INDICATORS';

// ── data ────────────────────────────────────────────────────────
const agg = JSON.parse(
  readFileSync(resolve(ROOT, 'public/data/aggregates/toronto-by-year.json'), 'utf-8'),
);

const stats = CATEGORIES.map((c) => {
  const full = agg.series[c.id].filter((p) => !p.partial);
  if (full.length < 2) {
    throw new Error(`series ${c.id} has ${full.length} full year(s); need >= 2`);
  }
  const counts = full.map((p) => p.count);
  const first = full[0];
  const last = full[full.length - 1];
  const prev = full[full.length - 2];
  return {
    ...c,
    color: C.cat[c.id],
    counts,
    firstYear: first.year,
    lastYear: last.year,
    lastCount: last.count,
    // Zero-base years produce no meaningful %; render as 0 rather than
    // Infinity/NaN (city-wide counts make this contingent, not expected).
    delta: first.count ? ((last.count - first.count) / first.count) * 100 : 0,
    yoy: prev.count ? ((last.count - prev.count) / prev.count) * 100 : 0,
    // Data claims baked into card copy must be recomputed, never asserted:
    // "ten-year high" is only true while the latest full year IS the max.
    isSeriesHigh: Math.max(...counts) === last.count,
  };
});
const byId = Object.fromEntries(stats.map((s) => [s.id, s]));
const FY = String(stats[0].firstYear).slice(2);
const LY = String(stats[0].lastYear).slice(2);

// ── helpers ─────────────────────────────────────────────────────
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (n) => n.toLocaleString('en-CA');

const mono = (x, y, size, fill, text, extra = '') =>
  `<text x="${x}" y="${y}" fill="${fill}" font-family="JetBrains Mono" font-size="${size}" ${extra.includes('font-weight') ? '' : 'font-weight="500"'} ${extra}>${esc(text)}</text>`;
const grot = (x, y, size, fill, text, weight = 600, extra = '') =>
  `<text x="${x}" y="${y}" fill="${fill}" font-family="Space Grotesk" font-size="${size}" font-weight="${weight}" ${extra}>${esc(text)}</text>`;

// Fixed category glyphs (drawn as shapes — the fonts may lack ✕◆ etc).
function glyph(type, cx, cy, r, color) {
  switch (type) {
    case 'diamond':
      return `<path d="M${cx},${cy - r} L${cx + r},${cy} L${cx},${cy + r} L${cx - r},${cy} Z" fill="${color}"/>`;
    case 'square': {
      const s = r * 0.85;
      return `<rect x="${cx - s}" y="${cy - s}" width="${2 * s}" height="${2 * s}" rx="${r * 0.15}" fill="${color}"/>`;
    }
    case 'triangle':
      return `<path d="M${cx},${cy - r} L${cx + r * 0.95},${cy + r * 0.8} L${cx - r * 0.95},${cy + r * 0.8} Z" fill="${color}"/>`;
    case 'circle':
      return `<circle cx="${cx}" cy="${cy}" r="${r * 0.9}" fill="${color}"/>`;
    case 'cross': {
      const a = r * 0.9, w = r * 0.32;
      return `<g transform="translate(${cx},${cy}) rotate(45)"><rect x="${-a}" y="${-w}" width="${2 * a}" height="${2 * w}" rx="${w * 0.6}" fill="${color}"/><rect x="${-w}" y="${-a}" width="${2 * w}" height="${2 * a}" rx="${w * 0.6}" fill="${color}"/></g>`;
    }
  }
}

// Trend arrow ▲ / ▼ / — , always paired with the % text.
function arrow(dir, x, y, s, color) {
  if (dir === 0)
    return `<rect x="${x}" y="${y - s * 0.15}" width="${s * 1.2}" height="${s * 0.3}" fill="${color}"/>`;
  return dir > 0
    ? `<path d="M${x},${y + s * 0.55} L${x + s * 1.2},${y + s * 0.55} L${x + s * 0.6},${y - s * 0.55} Z" fill="${color}"/>`
    : `<path d="M${x},${y - s * 0.55} L${x + s * 1.2},${y - s * 0.55} L${x + s * 0.6},${y + s * 0.55} Z" fill="${color}"/>`;
}

// Delta chip: arrow glyph + "NN%" mono text. Returns svg + advance width.
function delta(pct, x, yBaseline, size) {
  const dir = Math.abs(pct) < 0.5 ? 0 : pct > 0 ? 1 : -1;
  const color = dir > 0 ? C.trendUp : dir < 0 ? C.trendDown : C.ink3;
  const label = `${Math.abs(pct) >= 99.5 ? Math.round(Math.abs(pct)) : Math.abs(pct).toFixed(Math.abs(pct) < 10 ? 1 : 0)}%`;
  const aS = size * 0.42;
  const svg =
    arrow(dir, x, yBaseline - size * 0.32, aS, color) +
    mono(x + aS * 1.2 + size * 0.3, yBaseline, size, color, label, 'font-weight="700"');
  const width = aS * 1.2 + size * 0.3 + label.length * size * 0.62;
  return { svg, width, color };
}

// Sparkline replicating src/components/Sparkline.astro geometry.
function sparkline(data, x, y, w, h, color, sw, { fill = true, dot = true } = {}) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const padY = h * 0.11;
  const span = max - min || 1;
  const stepX = w / (data.length - 1);
  const pts = data.map((v, i) => [
    x + i * stepX,
    y + h - padY - ((v - min) / span) * (h - 2 * padY),
  ]);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return `
    ${fill ? `<path d="${path} L${x + w},${y + h} L${x},${y + h} Z" fill="${color}" opacity="0.12"/>` : ''}
    <path d="${path}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>
    ${dot ? `<circle cx="${last[0]}" cy="${last[1]}" r="${sw * 1.9}" fill="${color}"/>` : ''}`;
}

// "Live Signal" equalizer brand mark. Base footprint 60x44 at scale 1.
function brandMark(x, y, scale = 1, inkColor = C.ink) {
  return `<g transform="translate(${x},${y}) scale(${scale})">
    <rect x="0"  y="22" width="8" height="22" rx="1.5" fill="${inkColor}"/>
    <rect x="13" y="12" width="8" height="32" rx="1.5" fill="${inkColor}"/>
    <rect x="26" y="18" width="8" height="26" rx="1.5" fill="${inkColor}"/>
    <rect x="39" y="0"  width="8" height="44" rx="1.5" fill="${C.accent}"/>
    <rect x="52" y="14" width="8" height="30" rx="1.5" fill="${inkColor}"/>
  </g>`;
}

const wordmark = (x, y, size) =>
  `<text x="${x}" y="${y}" fill="${C.ink}" font-family="Space Grotesk" font-size="${size}" font-weight="700" letter-spacing="-0.5">crime<tspan fill="${C.accent}">.</tspan>pulse</text>`;

const svgDoc = (w, h, body) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="${C.bg}"/>
${body}
</svg>`;

function render(name, w, svg) {
  const png = new Resvg(svg, {
    background: C.bg,
    font: { loadSystemFonts: false, fontFiles: FONT_FILES, defaultFontFamily: 'Space Grotesk' },
    fitTo: { mode: 'width', value: w },
  }).render().asPng();
  writeFileSync(resolve(OUT, name), png);
  console.log(`wrote social/${name}`);
}

// ════════════════════════════════════════════════════════════════
// X POST — 1600x900 · single hero stat (theft over $5,000)
// ════════════════════════════════════════════════════════════════
function xPost() {
  const W = 1600, H = 900;
  const s = byId.theftOver;
  const M = 72; // panel inset
  const P = 84; // content padding inside panel
  const LX = M + P;

  const d1 = delta(s.delta, LX + 210, 700, 30);
  const yoyX = LX + 210 + d1.width + 90;
  const d2 = delta(s.yoy, yoyX + 74, 700, 30);

  const body = `
  <rect x="${M}" y="${M}" width="${W - 2 * M}" height="${H - 2 * M}" fill="${C.bgSoft}" stroke="${C.borderSoft}" stroke-width="1.5" rx="28"/>
  <rect x="${M}" y="${M}" width="7" height="${H - 2 * M}" fill="${s.color}" rx="3.5"/>

  ${brandMark(W - M - P - 60, M + 56, 1.0)}

  ${glyph('cross', LX + 15, M + 78, 15, s.color)}
  ${mono(LX + 46, M + 87, 26, s.color, s.name.toUpperCase(), 'letter-spacing="4"')}

  ${grot(LX - 6, 448, 230, C.ink, num(s.lastCount), 600, 'letter-spacing="-8"')}
  ${grot(LX, 512, 34, C.ink2, `incidents in ${s.lastYear}${s.isSeriesHigh ? ' — the ten-year high' : ''}`, 500)}

  ${sparkline(s.counts, LX, 560, W - 2 * M - 2 * P, 100, s.color, 5)}

  ${mono(LX, 700, 26, C.ink3, `'${FY} → '${LY}`)}
  ${d1.svg}
  ${mono(yoyX, 700, 26, C.ink3, 'YOY')}
  ${d2.svg}

  ${wordmark(LX, H - M - 52, 30)}
  ${mono(W - M - P, H - M - 55, 21, C.ink4, `${SOURCE_LINE} · ${s.firstYear}–${s.lastYear}`, 'text-anchor="end" letter-spacing="1"')}`;

  render('x-post.png', W, svgDoc(W, H, body));
}

// ════════════════════════════════════════════════════════════════
// FACEBOOK — 1200x630 · brand hero + five category chips
// ════════════════════════════════════════════════════════════════
function facebook() {
  const W = 1200, H = 630;
  const M = 44, P = 52;
  const LX = M + P;

  const chipW = (W - 2 * M - 2 * P - 4 * 16) / 5;
  const chips = stats
    .map((s, i) => {
      const cx = LX + i * (chipW + 16);
      const cy = 356;
      const d = delta(s.delta, cx + 22, cy + 118, 19);
      return `
      <rect x="${cx}" y="${cy}" width="${chipW}" height="146" fill="${C.surface}" stroke="${C.borderSoft}" stroke-width="1" rx="14"/>
      ${glyph(s.glyph, cx + 32, cy + 32, 9, s.color)}
      ${mono(cx + 50, cy + 38, 15, C.ink3, s.id === 'theftOver' ? 'THEFT OVER $5K' : s.name.toUpperCase(), 'letter-spacing="0.5"')}
      ${grot(cx + 20, cy + 84, 38, C.ink, num(s.lastCount), 600, 'letter-spacing="-1"')}
      ${d.svg}`;
    })
    .join('');

  const body = `
  <rect x="${M}" y="${M}" width="${W - 2 * M}" height="${H - 2 * M}" fill="${C.bgSoft}" stroke="${C.borderSoft}" stroke-width="1" rx="22"/>
  <rect x="${M}" y="${M}" width="6" height="${H - 2 * M}" fill="${C.accent}" rx="3"/>
  ${brandMark(W - M - P - 60, M + 42, 0.9)}

  ${mono(LX, M + 84, 21, C.accent, `§ TORONTO CRIME PULSE · ${stats[0].firstYear}–${stats[0].lastYear}`, 'letter-spacing="3"')}
  ${grot(LX, M + 158, 58, C.ink, 'Ten years of Toronto crime,', 600, 'letter-spacing="-1.5"')}
  ${grot(LX, M + 222, 58, C.ink, 'by the numbers.', 600, 'letter-spacing="-1.5"')}
  ${grot(LX, M + 268, 24, C.ink2, `Incidents in ${stats[0].lastYear} and the ten-year change · 158 neighbourhoods · no rankings, just data.`, 500)}

  ${chips}

  ${wordmark(LX, H - M - 34, 24)}
  ${mono(W - M - P, H - M - 36, 17, C.ink4, `${SOURCE_LINE} · ${URL_LINE}`, 'text-anchor="end" letter-spacing="1"')}`;

  render('facebook-post.png', W, svgDoc(W, H, body));
}

// ════════════════════════════════════════════════════════════════
// LINKEDIN — 1200x627 · "Five indicators, one scale" data table
// ════════════════════════════════════════════════════════════════
function linkedin() {
  const W = 1200, H = 627;
  const M = 44, P = 52;
  const LX = M + P;

  const rowH = 55;
  const top = 226;
  const sparkX = LX + 340, sparkW = 300;
  const countX = LX + 780;
  const deltaX = LX + 850;

  const header = `
  ${mono(LX, top - 14, 14, C.ink4, 'CATEGORY', 'letter-spacing="2"')}
  ${mono(sparkX, top - 14, 14, C.ink4, `TREND '${FY}–'${LY}`, 'letter-spacing="2"')}
  ${mono(countX, top - 14, 14, C.ink4, stats[0].lastYear + '', 'text-anchor="end" letter-spacing="2"')}
  ${mono(deltaX + 100, top - 14, 14, C.ink4, `Δ '${FY}→'${LY}`, 'text-anchor="end" letter-spacing="2"')}
  <line x1="${LX}" y1="${top - 4}" x2="${W - M - P}" y2="${top - 4}" stroke="${C.border}" stroke-width="1"/>`;

  const rows = stats
    .map((s, i) => {
      const y = top + i * rowH;
      const base = y + rowH / 2 + 8;
      const d = delta(s.delta, deltaX, base, 21);
      return `
      ${i ? `<line x1="${LX}" y1="${y}" x2="${W - M - P}" y2="${y}" stroke="${C.borderSoft}" stroke-width="1"/>` : ''}
      ${glyph(s.glyph, LX + 12, base - 8, 10, s.color)}
      ${grot(LX + 38, base, 25, C.ink, s.name, 500)}
      ${sparkline(s.counts, sparkX, y + 12, sparkW, rowH - 24, s.color, 2.5)}
      ${mono(countX, base, 24, C.ink, num(s.lastCount), 'text-anchor="end" font-weight="700"')}
      ${d.svg}`;
    })
    .join('');

  const body = `
  <rect x="${M}" y="${M}" width="${W - 2 * M}" height="${H - 2 * M}" fill="${C.bgSoft}" stroke="${C.borderSoft}" stroke-width="1" rx="22"/>
  <rect x="${M}" y="${M}" width="6" height="${H - 2 * M}" fill="${C.accent}" rx="3"/>
  ${brandMark(W - M - P - 60, M + 42, 0.9)}

  ${mono(LX, M + 74, 19, C.accent, `TORONTO · CITY-WIDE INCIDENTS · ${stats[0].firstYear}–${stats[0].lastYear}`, 'letter-spacing="3"')}
  ${grot(LX, M + 130, 46, C.ink, 'Five indicators, one scale.', 600, 'letter-spacing="-1"')}

  ${header}
  ${rows}

  ${wordmark(LX, H - M - 30, 24)}
  ${mono(W - M - P, H - M - 32, 16, C.ink4, `${SOURCE_LINE} · ${URL_LINE}`, 'text-anchor="end" letter-spacing="1"')}`;

  render('linkedin-post.png', W, svgDoc(W, H, body));
}

// ════════════════════════════════════════════════════════════════
// INSTAGRAM STORY — 1080x1920 · stacked category cards + CTA
// ════════════════════════════════════════════════════════════════
function igStory() {
  const W = 1080, H = 1920;
  const M = 64; // side margin; top/bottom safe zones ~180/170 handled below
  const topSafe = 190;

  const cardH = 196, gap = 22;
  const cardsTop = 560;

  const cards = stats
    .map((s, i) => {
      const y = cardsTop + i * (cardH + gap);
      const x = M;
      const cw = W - 2 * M;
      const pad = 40;
      const d1 = delta(s.delta, x + pad + 175, y + cardH - 38, 25);
      const yoyX = x + pad + 175 + d1.width + 70;
      const d2 = delta(s.yoy, yoyX + 68, y + cardH - 38, 25);
      return `
      <rect x="${x}" y="${y}" width="${cw}" height="${cardH}" fill="${C.surface}" stroke="${C.borderSoft}" stroke-width="1.5" rx="20"/>
      ${glyph(s.glyph, x + pad + 12, y + 52, 12, s.color)}
      ${mono(x + pad + 40, y + 60, 21, s.color, s.name.toUpperCase(), 'letter-spacing="3"')}
      ${grot(x + pad - 4, y + 128, 62, C.ink, num(s.lastCount), 600, 'letter-spacing="-2"')}
      ${sparkline(s.counts, x + cw - pad - 330, y + 36, 330, 88, s.color, 3.5)}
      ${mono(x + pad, y + cardH - 38, 25, C.ink3, `'${FY} → '${LY}`)}
      ${d1.svg}
      ${mono(yoyX, y + cardH - 38, 25, C.ink3, 'YOY')}
      ${d2.svg}`;
    })
    .join('');

  const ctaY = cardsTop + 5 * (cardH + gap) + 26;

  const body = `
  ${brandMark(M, topSafe, 1.15)}
  ${wordmark(M + 88, topSafe + 42, 40)}

  ${mono(M, topSafe + 130, 25, C.accent, `TORONTO · ${stats[0].firstYear}–${stats[0].lastYear}`, 'letter-spacing="4"')}
  ${grot(M, topSafe + 208, 66, C.ink, 'Ten years of Toronto', 600, 'letter-spacing="-2"')}
  ${grot(M, topSafe + 282, 66, C.ink, 'crime, by the numbers.', 600, 'letter-spacing="-2"')}
  ${grot(M, topSafe + 336, 28, C.ink2, `City-wide incidents · 158 neighbourhoods · no rankings.`, 500)}

  ${cards}

  <rect x="${M}" y="${ctaY}" width="${W - 2 * M}" height="92" fill="${C.accent}" opacity="0.14" rx="18"/>
  <rect x="${M}" y="${ctaY}" width="${W - 2 * M}" height="92" fill="none" stroke="${C.accent}" stroke-width="1.5" opacity="0.5" rx="18"/>
  ${grot(W / 2, ctaY + 44, 28, C.ink, 'Explore every neighbourhood', 600, 'text-anchor="middle"')}
  ${mono(W / 2, ctaY + 74, 21, C.accentGlow, URL_LINE.toUpperCase(), 'text-anchor="middle" letter-spacing="3"')}

  ${mono(W / 2, H - 96, 18, C.ink4, `${SOURCE_LINE} · ${stats[0].firstYear}–${stats[0].lastYear}`, 'text-anchor="middle" letter-spacing="1.5"')}`;

  render('instagram-story.png', W, svgDoc(W, H, body));
}

// ════════════════════════════════════════════════════════════════
// INSTAGRAM STORY — 1080x1920 · single-stat deep dive: theft over
// $5,000, ▲87% over ten years
// ════════════════════════════════════════════════════════════════
function igStoryTheftOver() {
  const W = 1080, H = 1920;
  const M = 72;
  const topSafe = 200;
  const s = byId.theftOver;
  const firstCount = s.counts[0];

  // Big sparkline block geometry (shared by line + endpoint labels).
  const spX = M + 20, spW = W - 2 * M - 40, spY = 1050, spH = 300;

  const ctaY = 1640;

  const body = `
  ${brandMark(M, topSafe, 1.15)}
  ${wordmark(M + 88, topSafe + 42, 40)}

  ${glyph('cross', M + 16, topSafe + 136, 16, s.color)}
  ${mono(M + 48, topSafe + 146, 27, s.color, s.name.toUpperCase(), 'letter-spacing="4"')}
  ${mono(M, topSafe + 196, 23, C.ink3, `TORONTO · ${s.firstYear} – ${s.lastYear}`, 'letter-spacing="3"')}

  ${arrow(s.delta >= 0 ? 1 : -1, M + 8, 700, 62, s.delta >= 0 ? C.trendUp : C.trendDown)}
  ${grot(M + 120, 758, 270, C.ink, `${Math.abs(Math.round(s.delta))}%`, 600, 'letter-spacing="-10"')}
  ${grot(M, 850, 44, C.ink2, `${s.delta >= 0 ? 'more' : 'fewer'} reported incidents than`, 500)}
  ${grot(M, 906, 44, C.ink2, 'ten years ago.', 500)}

  ${sparkline(s.counts, spX, spY, spW, spH, s.color, 6)}
  ${mono(spX, spY + spH + 56, 26, C.ink3, `'${FY}`)}
  ${mono(spX, spY + spH + 100, 34, C.ink, num(firstCount), 'font-weight="700"')}
  ${mono(spX + spW, spY + spH + 56, 26, C.ink3, `'${LY}`, 'text-anchor="end"')}
  ${mono(spX + spW, spY + spH + 100, 34, s.color, num(s.lastCount), 'text-anchor="end" font-weight="700"')}
  ${grot(W / 2, spY + spH + 80, 26, C.ink3, `${s.isSeriesHigh ? 'a ten-year high · ' : ''}YoY ${s.yoy >= 0 ? '+' : '−'}${Math.abs(s.yoy).toFixed(1)}%`, 500, 'text-anchor="middle"')}

  <rect x="${M}" y="${ctaY}" width="${W - 2 * M}" height="92" fill="${C.accent}" opacity="0.14" rx="18"/>
  <rect x="${M}" y="${ctaY}" width="${W - 2 * M}" height="92" fill="none" stroke="${C.accent}" stroke-width="1.5" opacity="0.5" rx="18"/>
  ${grot(W / 2, ctaY + 44, 28, C.ink, 'See the full ten-year picture', 600, 'text-anchor="middle"')}
  ${mono(W / 2, ctaY + 74, 21, C.accentGlow, URL_LINE.toUpperCase(), 'text-anchor="middle" letter-spacing="3"')}

  ${mono(W / 2, H - 96, 18, C.ink4, `${SOURCE_LINE} · ${s.firstYear}–${s.lastYear}`, 'text-anchor="middle" letter-spacing="1.5"')}`;

  render('instagram-story-theft-over.png', W, svgDoc(W, H, body));
}

// ════════════════════════════════════════════════════════════════
// "10 YEARS, BY THE NUMBERS" CARD SET
// One spark-chart table renderer, sized per platform. Column x
// positions are fractions of the content width so every format keeps
// the same proportions; vertical rhythm is tuned per canvas.
// ════════════════════════════════════════════════════════════════
const COL = { sparkX: 0.32, sparkW: 0.32, count: 0.8, delta: 0.852 };

const HEADLINE_1 = '10 years of Toronto crime, by the numbers.';
const HEADLINE_2 = ['10 years of Toronto crime,', 'by the numbers.'];
const SUBLINE = '158 neighbourhoods · no rankings, just data.';

function tableCard(o) {
  const { file, W, H, M, P } = o;
  const LX = M + P;
  const RX = W - M - P;
  const CW = RX - LX;

  const sparkX = LX + COL.sparkX * CW;
  const sparkW = COL.sparkW * CW;
  const countX = LX + COL.count * CW;
  const deltaX = LX + COL.delta * CW;

  const top = o.tableTop;
  const hy = top - o.headerSize * 1.4;

  const header = `
  ${mono(LX, hy, o.headerSize, C.ink4, 'CATEGORY', 'letter-spacing="2"')}
  ${mono(sparkX, hy, o.headerSize, C.ink4, `TREND '${FY}–'${LY}`, 'letter-spacing="2"')}
  ${mono(countX, hy, o.headerSize, C.ink4, stats[0].lastYear + '', 'text-anchor="end" letter-spacing="2"')}
  ${mono(RX, hy, o.headerSize, C.ink4, `Δ '${FY}→'${LY}`, 'text-anchor="end" letter-spacing="2"')}
  <line x1="${LX}" y1="${top - o.headerSize * 0.6}" x2="${RX}" y2="${top - o.headerSize * 0.6}" stroke="${C.border}" stroke-width="1"/>`;

  const rows = stats
    .map((s, i) => {
      const y = top + i * o.rowH;
      const base = y + o.rowH / 2 + o.nameSize * 0.35;
      const d = delta(s.delta, deltaX, base, o.deltaSize);
      return `
      ${i ? `<line x1="${LX}" y1="${y}" x2="${RX}" y2="${y}" stroke="${C.borderSoft}" stroke-width="1"/>` : ''}
      ${glyph(s.glyph, LX + o.glyphR * 1.2, base - o.nameSize * 0.3, o.glyphR, s.color)}
      ${grot(LX + o.glyphR * 3.8, base, o.nameSize, C.ink, s.name, 500)}
      ${sparkline(s.counts, sparkX, y + o.rowH * 0.2, sparkW, o.rowH * 0.6, s.color, o.sparkSW)}
      ${mono(countX, base, o.countSize, C.ink, num(s.lastCount), 'text-anchor="end" font-weight="700"')}
      ${d.svg}`;
    })
    .join('');

  const title = o.titleLines
    .map((line, i) =>
      grot(LX, o.titleY + i * o.titleGap, o.titleSize, C.ink, line, 600, `letter-spacing="${-o.titleSize * 0.03}"`),
    )
    .join('');

  const cta = o.ctaY
    ? `
  <rect x="${LX}" y="${o.ctaY}" width="${CW}" height="${o.ctaH}" fill="${C.accent}" opacity="0.14" rx="18"/>
  <rect x="${LX}" y="${o.ctaY}" width="${CW}" height="${o.ctaH}" fill="none" stroke="${C.accent}" stroke-width="1.5" opacity="0.5" rx="18"/>
  ${grot(LX + CW / 2, o.ctaY + o.ctaH * 0.46, o.ctaH * 0.3, C.ink, 'Explore every neighbourhood', 600, 'text-anchor="middle"')}
  ${mono(LX + CW / 2, o.ctaY + o.ctaH * 0.79, o.ctaH * 0.23, C.accentGlow, URL_LINE.toUpperCase(), 'text-anchor="middle" letter-spacing="3"')}`
    : '';

  const body = `
  <rect x="${M}" y="${M}" width="${W - 2 * M}" height="${H - 2 * M}" fill="${C.bgSoft}" stroke="${C.borderSoft}" stroke-width="1" rx="24"/>
  <rect x="${M}" y="${M}" width="6" height="${H - 2 * M}" fill="${C.accent}" rx="3"/>
  ${brandMark(RX - 60 * o.markScale, M + o.eyebrowY - 36 * o.markScale, o.markScale)}

  ${mono(LX, M + o.eyebrowY, o.eyebrowSize, C.accent, `TORONTO · CITY-WIDE INCIDENTS · ${stats[0].firstYear}–${stats[0].lastYear}`, 'letter-spacing="3"')}
  ${title}
  ${grot(LX, o.subY, o.subSize, C.ink2, SUBLINE, 500)}

  ${header}
  ${rows}
  ${cta}

  ${wordmark(LX, H - M - o.footY, o.wordmarkSize)}
  ${mono(RX, H - M - o.footY - 2, o.footSize, C.ink4, `${SOURCE_LINE} · ${URL_LINE}`, 'text-anchor="end" letter-spacing="1"')}`;

  render(file, W, svgDoc(W, H, body));
}

// Square 1080x1080 — LinkedIn / IG feed / X, no cropping anywhere.
const squareCard = () =>
  tableCard({
    file: 'square-post.png', W: 1080, H: 1080, M: 40, P: 48, markScale: 1.0,
    eyebrowY: 92, eyebrowSize: 20,
    titleLines: HEADLINE_2, titleY: 218, titleSize: 62, titleGap: 74,
    subY: 340, subSize: 25,
    tableTop: 428, rowH: 100,
    nameSize: 29, countSize: 28, deltaSize: 24, glyphR: 11, sparkSW: 3, headerSize: 16,
    footY: 46, footSize: 18, wordmarkSize: 28,
  });

// LinkedIn 1200x627 — landscape link card, single-line headline.
const linkedinNumbers = () =>
  tableCard({
    file: 'numbers-linkedin.png', W: 1200, H: 627, M: 44, P: 52, markScale: 0.9,
    eyebrowY: 70, eyebrowSize: 18,
    titleLines: [HEADLINE_1], titleY: 168, titleSize: 42, titleGap: 0,
    subY: 206, subSize: 19,
    tableTop: 258, rowH: 53,
    nameSize: 22, countSize: 21, deltaSize: 18, glyphR: 8.5, sparkSW: 2.5, headerSize: 13,
    footY: 26, footSize: 15, wordmarkSize: 23,
  });

// Facebook 1200x630 — same landscape geometry as LinkedIn.
const facebookNumbers = () =>
  tableCard({
    file: 'numbers-facebook.png', W: 1200, H: 630, M: 44, P: 52, markScale: 0.9,
    eyebrowY: 70, eyebrowSize: 18,
    titleLines: [HEADLINE_1], titleY: 168, titleSize: 42, titleGap: 0,
    subY: 206, subSize: 19,
    tableTop: 260, rowH: 53,
    nameSize: 22, countSize: 21, deltaSize: 18, glyphR: 8.5, sparkSW: 2.5, headerSize: 13,
    footY: 26, footSize: 15, wordmarkSize: 23,
  });

// X 1600x900 — 16:9, the widest sparklines of the set.
const xNumbers = () =>
  tableCard({
    file: 'numbers-x.png', W: 1600, H: 900, M: 72, P: 84, markScale: 1.0,
    eyebrowY: 74, eyebrowSize: 22,
    titleLines: [HEADLINE_1], titleY: 228, titleSize: 54, titleGap: 0,
    subY: 276, subSize: 24,
    tableTop: 340, rowH: 80,
    nameSize: 28, countSize: 27, deltaSize: 23, glyphR: 11, sparkSW: 3, headerSize: 16,
    footY: 42, footSize: 18, wordmarkSize: 27,
  });

// Instagram 1080x1350 — 4:5 portrait feed, tall rows + CTA bar.
const instagramNumbers = () =>
  tableCard({
    file: 'numbers-instagram.png', W: 1080, H: 1350, M: 44, P: 48, markScale: 1.0,
    eyebrowY: 92, eyebrowSize: 20,
    titleLines: HEADLINE_2, titleY: 222, titleSize: 62, titleGap: 74,
    subY: 344, subSize: 25,
    tableTop: 432, rowH: 128,
    nameSize: 29, countSize: 28, deltaSize: 24, glyphR: 11, sparkSW: 3.5, headerSize: 16,
    ctaY: 1120, ctaH: 92,
    footY: 44, footSize: 18, wordmarkSize: 28,
  });

mkdirSync(OUT, { recursive: true });
xPost();
facebook();
linkedin();
igStory();
igStoryTheftOver();
squareCard();
linkedinNumbers();
facebookNumbers();
xNumbers();
instagramNumbers();
console.log('done');
