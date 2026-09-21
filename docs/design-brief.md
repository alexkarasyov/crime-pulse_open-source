# Toronto Crime Pulse — v1 Design Brief

Hand-off document for a designer (e.g. Claude Design) producing the visual direction and screens for Toronto Crime Pulse v1. Engineering specs live in [`overview.md`](overview.md) and [`data-sources.md`](data-sources.md); the load-bearing decisions this brief is built on live in [`../project/decisions/`](../project/decisions/). This file is the *look, feel, and structure* the designer should work against.

Four decisions to keep in mind while reading the brief; each one shapes a section:

- **[ADR-001](../project/decisions/001-v1-scope-is-toronto-not-gta.md)** — v1 is **Toronto**, not GTA.
- **[ADR-002](../project/decisions/002-present-rates-not-counts.md)** — default unit is **incidents per 10,000 residents**, not raw counts.
- **[ADR-003](../project/decisions/003-choropleth-map-not-incident-dots.md)** — the map is a **neighbourhood choropleth**, not a dot/cluster map.
- **[ADR-004](../project/decisions/004-build-emits-aggregated-json.md)** — the dashboard reads **pre-aggregated JSON**, so cross-filter UI is feasible on mobile.

## 1. One-liner

A calm, trustworthy public dashboard that answers "is the crime rate in my Toronto neighbourhood going up or down?" using 10 years of official Toronto Police data, normalised to incidents per 10,000 residents.

## 2. Audience and tone

- **Who**: Toronto residents, prospective movers, journalists, community and parent groups. Assume **no data literacy**.
- **Tone**: civic and factual — closer to Statistics Canada or The Pudding than to a TV news crime ticker. No red alarms, no sirens, no "shocking" framing. Confident, restrained, transparent about limits.
- **Anti-pattern**: do **not** evoke true-crime, surveillance, or fear marketing. No bloody reds, no police-tape yellow stripes, no scary serif headlines, no faux-CCTV aesthetics.
- **Recency framing** (important): the TPS source refreshes quarterly. The dashboard is a **trend** view, not a live or "what happened last night" view. There is no "Recent incidents" widget, no relative dates ("3 days ago"), no live ticker. The feed uses absolute dates only. The footer carries a "Data current as of YYYY-MM-DD" line.

## 3. What the data actually looks like

Designer should know the shape they're visualising before picking a direction. Full detail in [`data-sources.md`](data-sources.md); summary:

- **Source**: Toronto Police Service Community Safety Indicators, imported into [`../data/crimes/`](../data/crimes/) as a Markdown archive, then aggregated by the build into JSON (see ADR-004).
- **Coverage**: 10 full years, 2016–2025. 369,616 deduped incidents. *(Counts in this section are as of the 2026-05 import, before NSA-row exclusion and the 2026 YTD import; the live site numbers differ slightly.)*
- **Unit**: default is rate per 10,000 residents (see ADR-002). Counts are a toggle. Toronto Neighbourhood Profiles (2021 Census) provide the per-neighbourhood denominator; Statistics Canada City of Toronto Census Subdivision population estimates (table 17-10-0155-01) provide the city-wide denominator by year — see [ADR-006](../project/decisions/006-city-wide-denominator-is-toronto-csd-not-cma.md) for why CSD rather than CMA.
- **2026** is year-to-date and is **excluded** from all comparable 10-year visuals. It is not shown as a rate (denominator and numerator are both incomplete). Design needs a clear way to surface this whenever the user expands the year range that far.
- **Categories** (only these — sexual assaults are explicitly excluded by source): Assault, Auto Theft, Break and Enter, Robbery, Theft Over.
- **Geo**: 158 official Toronto neighbourhoods (e.g. "Moss Park (73)", "High Park-Swansea (87)"). Per-incident lat/lng exists in the source but the source itself flags it as approximate and forbids exact-address presentation. The map therefore works at neighbourhood resolution, not point resolution (see ADR-003).
- **Signals worth foregrounding visually** (designer can pick which to dramatise on the Overview):
  - Assaults trended up in count 2016 → 2024 (17,329 → 23,816); the per-capita rate change is smaller but still up.
  - Auto Theft count tripled to a 2023 peak (3,232 → 11,276) then dropped sharply to 6,447 in 2025.
  - A 2020 dip across most categories (COVID).

## 4. Visual direction

- **Mood words**: civic, daylight, legible, evidence-led, quietly modern.
- **Palette suggestion** (designer can refine):
  - Neutral base: off-white / paper (#F7F6F2) in light mode, deep slate (#0F1B2D) in dark mode.
  - Accent: a **single** muted civic blue or teal for interactive elements.
  - Category colours: a 5-hue qualitative scale that's colour-blind safe (Okabe-Ito or similar). Each category gets ONE consistent colour reused everywhere it appears (chart line, choropleth highlight, list chip, filter chip).
  - **Choropleth shading**: a single-hue sequential ramp keyed to the active category's colour (e.g. light → saturated teal for Assault). Diverging ramps are reserved for views that explicitly compare a neighbourhood vs. the Toronto baseline.
  - Reserve red **only** for genuine emphasis (e.g. a sharp increase callout) — not as a default.
- **Typography**: one humanist sans for UI and numerals (Inter, IBM Plex Sans, or similar); one accent face only if needed for editorial headers. Tabular numerals in all data displays.
- **Density**: generous whitespace; this is a reading and scanning surface, not a control panel.
- **Light and dark modes**, both first-class. Map tiles need a matching dark variant (CartoDB Positron / Dark Matter is a good reference).

## 5. Information architecture

A single-page-app feel, even though it is statically built with Astro and reads pre-aggregated JSON. Suggested surfaces:

1. **Landing / Overview** — Toronto-wide pulse:
   - Hero with one big headline number stated as a **rate**, e.g. "Assault rate up 24% per 10,000 residents since 2016," plus a 10-year sparkline.
   - Five category cards (Assault, Auto Theft, Break and Enter, Robbery, Theft Over), each with a 10-year rate trendline and a YoY delta.
   - A small **"What this dashboard does not cover"** module on the Overview itself, naming the excluded categories (sexual assault) and the regional scope (Toronto only). This is not buried in About; it is part of the first impression.
   - A small **Toronto vs. Canada** context card using Statistics Canada Crime Severity Index (table 35-10-0026-01, per [`data-sources.md`](data-sources.md)) so non-experts have a national benchmark.
   - "Pick your neighbourhood" CTA.
2. **Neighbourhood view** — chosen from a search/dropdown of 158 neighbourhoods OR by clicking the choropleth:
   - Hero: neighbourhood name, rate per 10,000 (selected year), delta vs. prior year, delta vs. 10-year average, and delta vs. Toronto-wide rate.
   - 10-year stacked-area or small-multiples chart by category. The Toronto-wide rate appears as an overlay reference line by default (this is required, not optional).
   - Calendar heatmap (month × year) for the active filters.
   - Choropleth zoomed to the selected neighbourhood with its neighbours visible for context.
   - Chronological feed (paginated, virtualised) of incidents in that neighbourhood. Date, category badge, offence sub-type, premises type. No addresses, no coordinates surfaced.
3. **Compare** (stretch): pick 2–4 neighbourhoods, see their rate trendlines side by side, with the Toronto-wide rate as a shared baseline.
4. **About the data** — what is in, what is not, why rates not counts, why a choropleth not a dot map, refresh cadence, why 2026 is YTD, link to the TPS source and to the Toronto Neighbourhood Profiles used for denominators.

## 6. Core components

- **Filter bar** (sticky on scroll; collapses on mobile):
  - Neighbourhood selector (typeahead over 158 names; map-pick alternative).
  - Crime category multi-select (5 chips).
  - Year range slider (2016–2025), with a separate toggle to include 2026 YTD that surfaces an inline disclaimer chip when active.
  - Unit toggle: **Rate per 10,000** (default) ↔ **Raw counts**. Affects every chart axis, the choropleth legend, headline copy, and feed badges.
- **Headline stat card** — big number with its unit explicit (e.g. "184 per 10,000"), delta arrow (up / down / flat), tiny sparkline. Designed to be screenshot-worthy.
- **Trend chart** — line or area; **must support** the Toronto-wide baseline overlay. Tooltip shows rate, count, and YoY %.
- **Small-multiples grid** — one mini chart per category, shared y-axis treatment in rate units.
- **Calendar heatmap** — month × year cells. Cell shading uses rate; tooltip includes count.
- **Choropleth map** — 158 Toronto neighbourhood polygons over a quiet base tile. Shading by active category rate; hover/tap surfaces rate + count + sparkline; click drills into Neighbourhood view. A persistent "Toronto neighbourhoods, 2021 Census boundaries" legend caption is part of the map, not a footnote. **No incident dots in v1.**
- **Chronological feed row** — date, category badge, offence sub-type, neighbourhood, premises type. Compact, scannable. No victim language, no addresses, no relative dates.
- **Empty / loading / "no incidents match" states** — these should feel intentional, not error-y.
- **Data caveat callouts** — a reusable inline note style (icon + one sentence), used wherever a number could mislead. The four most common ones to design once and reuse:
  - "Rate per 10,000 residents. 2021 Census population."
  - "2026 is year-to-date and excluded from 10-year comparisons."
  - "This dataset does not include sexual assault."
  - "Toronto only. Peel, York, Durham, and Halton are not in this dashboard."

## 7. Responsive behaviour

- **Desktop (≥1024px)**: three-column potential — left filter rail, centre charts and feed, right choropleth (or choropleth dominant with overlay panel). Map and chart can coexist.
- **Tablet (768–1023px)**: filter rail collapses to a top bar; map and content stack into two columns or tabs.
- **Mobile (<768px)**:
  - Tabbed switcher between **Trends / Map / Feed** (the three core verbs).
  - Filter bar becomes a bottom sheet ("Filters" button, with a count badge showing active filters).
  - Unit toggle (rate ↔ count) is a sticky control in the header, not buried in the filter sheet — it changes the meaning of every number on screen.
  - Charts re-flow to a single column, simplified ticks, no hover — tap interactions instead.
  - Choropleth full-bleed; filter sheet slides over it. Polygon tap reveals a bottom card with rate, count, sparkline, "Open neighbourhood" CTA.
  - Chronological feed uses card rows, not table rows.
- Touch targets ≥44px. Charts must be readable at 360px wide.

## 8. Accessibility and ethics (non-negotiable)

- WCAG AA contrast minimum, including chart strokes and choropleth fills against background.
- Colour is never the only signal — pair every category colour with a label or icon (different glyph per category). On the choropleth, the legend must be labelled with rate values, not just a colour gradient.
- Screen-reader text for every chart and the choropleth: a hidden table and a one-sentence summary ("Assault rate rose from 167 to 207 per 10,000 residents between 2016 and 2024").
- Reduced-motion variants for any animated transitions, including choropleth fill animations.
- No language that implies a neighbourhood is "dangerous" or "safe." Show data, not labels.
- The choropleth never shows raw counts as its default shading — that would visually penalise high-population neighbourhoods. Rate-shading is the only default.

## 9. Sample headline copy (for mocks)

- *"Toronto's 10-year crime pulse."*
- *"Assault rate up 24% per 10,000 residents since 2016."*
- *"Auto theft rate tripled by 2023, then fell sharply through 2025."*
- *"Source: Toronto Police Service Community Safety Indicators. Rates use 2021 Census neighbourhood populations."*
- *"This dashboard covers Toronto only and does not include sexual assault."*

## 10. Deliverables requested from the designer

1. **Moodboard / direction frame** — 1 page, palette, type pairing, three reference screenshots.
2. **Desktop high-fi**: Overview, Neighbourhood view, Compare (optional), About-the-data.
3. **Mobile high-fi**: same screens, including the choropleth bottom-card interaction and the unit toggle in the sticky header.
4. **Component library page**: filter bar, headline stat card, trend chart with baseline overlay, small-multiples, calendar heatmap, choropleth + hover/tap card, feed row, caveat callout (four variants per §6), empty / loading states.
5. **Both light and dark modes** for at least Overview and Neighbourhood, including matching choropleth tile + polygon treatments.
6. **A short style note** (palette tokens including the single-hue sequential ramps per category, type scale, spacing scale, motion guidance) that a developer can implement against.

## 11. Out of scope for v1

No realtime, no alerts, no auth, no LLM/news features, no non-Toronto regions, no incident-level addresses or dots, no sexual-assault category (not in source), no 2026 numbers in comparable 10-year visuals, no relative dates in the feed. See [`overview.md`](overview.md) and [`../AGENTS.md`](../AGENTS.md) for the non-goals that constrain v1, and the ADRs linked at the top of this file for the load-bearing decisions.
