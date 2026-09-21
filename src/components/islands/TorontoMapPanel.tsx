// Sidebar that mirrors the hover state from TorontoMap.
// Reads `mapHover` + the shared `primaryCat` + `unit` signals.

import { CAT_BY_ID } from '../../lib/categories';
import { primaryCat, unit, yearRange } from '../../lib/state';
import { mapHover } from '../../lib/mapHover';
import {
  fmtUnit,
  guardedChange,
  SMALL_BASE_NOTE,
  sliceByYearRange,
  unitSuffix,
  trendColor,
} from '../../lib/format';
import Sparkline from '../preact/Sparkline';

export default function TorontoMapPanel() {
  const hovered = mapHover.value;
  const cat = primaryCat.value;
  const u = unit.value;
  const primary = CAT_BY_ID[cat];
  // The choropleth shades the END of the user-selected year range — the
  // panel must read the same year, not blindly the last series point.
  const displayYear = yearRange.value[1];
  if (!hovered) {
    return (
      <div
        style={{
          padding: '16px 0',
          color: 'var(--ink-3)',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          lineHeight: 1.6,
        }}
      >
        <div
          style={{
            fontSize: '11px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '8px',
          }}
        >
          How to read
        </div>
        Each polygon is one of Toronto's 158 official neighbourhoods.
        Darker shading = higher {primary.name.toLowerCase()} {u === 'rate' ? 'rate per 10K residents' : 'incident count'}.
        Hover any polygon for numbers; click to drill in. Boundaries are 2021 Census.
      </div>
    );
  }
  const last = hovered.series.find((p) => p.year === displayYear);
  const prev = hovered.series.find((p) => p.year === displayYear - 1);
  const lastVal = last ? (u === 'rate' ? last.rate : last.count) : 0;
  const change = guardedChange(prev?.count ?? 0, last?.count ?? 0);
  const arrowColor = trendColor(change.trend.dir);
  return (
    <div class="hex-tooltip">
      <p class="hname">{hovered.name}</p>
      <div class="hrow"><span>NEIGHBOURHOOD #</span><span class="v">{hovered.id}</span></div>
      <div class="hrow">
        <span>POPULATION</span>
        <span class="v">{hovered.population.toLocaleString()}</span>
      </div>
      <div class="hrow">
        <span>{primary.name.toUpperCase()}{last ? ` (${last.year})` : ''}</span>
        <span class="v" style={`color: ${primary.color}`}>
          {fmtUnit(lastVal, u)} <span style="color: var(--ink-3);">{unitSuffix(u) || 'count'}</span>
        </span>
      </div>
      <div class="hrow">
        <span>YEAR OVER YEAR</span>
        <span class="v" style={`color: ${arrowColor}; display: inline-flex; align-items: center; gap: 6px;`}>
          {change.kind === 'counts' ? (
            <>
              <span>
                {change.diff === 0
                  ? '—'
                  : `${change.trend.glyph} ${change.diff > 0 ? '+' : '−'}${Math.abs(change.diff)} · ${change.from}→${change.to}`}
              </span>
              <span class="sm-tag" title={SMALL_BASE_NOTE}>small base</span>
            </>
          ) : change.trend.dir === 'flat' ? (
            '—'
          ) : (
            `${change.trend.glyph} ${Math.abs(change.trend.delta).toFixed(1)}%`
          )}
        </span>
      </div>
      <div class="spark" style={`color: ${primary.color}; height: 32px;`}>
        {/* Slice to the rail's year window so the sparkline matches the
            value and YoY beside it. */}
        <Sparkline
          data={sliceByYearRange(hovered.series, yearRange.value[0], displayYear).map(
            (d) => ({ rate: u === 'rate' ? d.rate : d.count }),
          )}
          color={primary.color}
          fill
          height={32}
          width={220}
        />
      </div>
      <a class="cta" href={`/neighbourhood/${hovered.id}/`}>Open neighbourhood →</a>
    </div>
  );
}
