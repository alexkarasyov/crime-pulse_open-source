// The right-rail category block on the Neighbourhood mini-map. Reacts to the
// page's category scope, selected year, and unit.

import { CATEGORIES } from '../../lib/categories';
import { activeCats, unit, yearRange } from '../../lib/state';
import type { YearPoint } from '../../lib/aggregates';
import CatGlyph from '../preact/CatGlyph';

interface Props {
  seriesByCat: Record<string, YearPoint[]>;
}

export default function NeighbourhoodCatReadout({ seriesByCat }: Props) {
  const u = unit.value;
  const displayYear = yearRange.value[1];
  const categories = activeCats.value;
  return (
    <>
      <div class="map-legend-title" style="margin-bottom: 8px;">{displayYear} · categories in scope</div>
      {CATEGORIES.map((c) => {
        const series = seriesByCat[c.id] ?? [];
        const point = series.find((item) => item.year === displayYear);
        return (
          <div class="category-readout-row" hidden={!categories.includes(c.id)}>
            <span style="color: var(--ink-2); display: inline-flex; align-items: center; gap: 6px;">
              <CatGlyph cat={c} size={8} /> {c.shortCode}
            </span>
            <span style={`color: ${c.color}; font-variant-numeric: tabular-nums;`}>
              {point
                ? u === 'rate'
                  ? point.rate.toFixed(0)
                  : point.count.toLocaleString()
                : '—'}
            </span>
          </div>
        );
      })}
    </>
  );
}
