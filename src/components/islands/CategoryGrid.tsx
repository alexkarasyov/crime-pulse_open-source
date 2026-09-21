// Five category cards. Click → set primaryCat across the whole page.
// Reflects the active unit. Drives the rest of the Overview screen.

import { CATEGORIES } from '../../lib/categories';
import { ensureCatOn, primaryCat, setPrimaryCat, unit, yearRange, activeCats } from '../../lib/state';
import { changeTrend, yoyTrend, sliceByYearRange } from '../../lib/format';
import type { YearPoint } from '../../lib/aggregates';
import Sparkline from '../preact/Sparkline';
import CatGlyph from '../preact/CatGlyph';

interface Props {
  torontoSeries: Record<string, YearPoint[]>;
}

export default function CategoryGrid({ torontoSeries }: Props) {
  const u = unit.value;
  const pc = primaryCat.value;
  const [startYear, endYear] = yearRange.value;
  const rangeLabel = `'${String(startYear).slice(2)} → '${String(endYear).slice(2)}`;
  return (
    <div class="cat-grid">
      {CATEGORIES.map((cat) => {
        const series = sliceByYearRange(torontoSeries[cat.id] ?? [], startYear, endYear);
        const f = series[0]?.[u] ?? 0;
        const l = series[series.length - 1]?.[u] ?? 0;
        const prev = series[series.length - 2]?.[u] ?? 0;
        const change = changeTrend(f, l);
        // YoY uses yoyTrend's 1% flat band so the "YoY" chip matches the flat
        // semantics other YoY readouts use; the range-change chip stays changeTrend.
        const yoy = yoyTrend(prev, l);
        const isActive = pc === cat.id;
        // Scope chips in the view rail drive the map/hero sums; a card whose
        // category is toggled off dims so the filter state reads here too.
        const isFilteredOut = !activeCats.value.includes(cat.id);
        return (
          <button
            type="button"
            class={`cat-card ${isActive ? 'active' : ''}`}
            style={`color: ${cat.color}; text-align: left; width: 100%;${isFilteredOut ? ' opacity: 0.4;' : ''}`}
            aria-pressed={isActive}
            // Picking a primary category also forces it into the page scope
            // (activeCats) — a primary lens the scope chips have hidden would
            // desync the map/hero from the card state (see CategoryPicker).
            onClick={() => {
              setPrimaryCat(cat.id);
              ensureCatOn(cat.id);
            }}
          >
            <div class="cat-card-head">
              <CatGlyph cat={cat} size={12} />
              <span class="cat-card-name" style={`color: ${cat.color};`}>{cat.name}</span>
            </div>
            <div class="cat-card-rate" style="color: var(--ink);">
              {u === 'rate' ? l.toFixed(0) : Math.round(l).toLocaleString()}
              <span class="u">{u === 'rate' ? '/ 10K' : ''}</span>
            </div>
            <div class="cat-card-spark" style={`color: ${cat.color};`}>
              <Sparkline
                data={series.map((d) => ({ rate: d[u] }))}
                color={cat.color}
                fill
                accent
                height={36}
                width={180}
              />
            </div>
            <div class="cat-card-foot">
              <span>{rangeLabel}</span>
              <span class={`delta ${change.dir}`}>
                {change.dir === 'flat' ? '—' : `${change.glyph} ${Math.abs(change.delta).toFixed(0)}%`}
              </span>
              <span>YoY {yoy.dir === 'flat' ? '—' : `${yoy.glyph} ${Math.abs(yoy.delta).toFixed(1)}%`}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
