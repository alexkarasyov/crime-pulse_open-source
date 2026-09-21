// Small island that surfaces 2026 YTD data when the user toggles the
// "+ Include 2026 YTD" chip in the view rail. Sits under the bigstat on
// the Overview hero. Hides itself when the toggle is off.

import { CAT_BY_ID } from '../../lib/categories';
import { primaryCat, includeYTD } from '../../lib/state';
import type { YearPoint } from '../../lib/aggregates';

interface Props {
  /** Partial-year points keyed by category id (e.g. [{year: 2026, count: 5254, ...}]). */
  partialByCat: Record<string, YearPoint[]>;
  /** Per partial year: the max report date covered (e.g. {"2026": "2026-03-31"}). */
  throughByYear?: Record<string, string>;
}

export default function OverviewYTDFootnote({ partialByCat, throughByYear }: Props) {
  if (!includeYTD.value) return null;
  const cat = primaryCat.value;
  const primary = CAT_BY_ID[cat];
  const partials = partialByCat[cat] ?? [];
  if (partials.length === 0) return null;
  const latest = partials[partials.length - 1]!;
  const through = throughByYear?.[String(latest.year)];
  return (
    <div
      style="
        margin-top: 16px;
        padding: 12px 16px;
        border: 1px dashed var(--accent-line);
        border-radius: var(--r-2);
        background: var(--accent-soft);
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--ink-2);
        display: flex; align-items: center; gap: 12px;
      "
    >
      <span style="color: var(--accent); font-weight: 600;">+ {latest.year} YTD</span>
      <span style="color: var(--ink);">
        {latest.count.toLocaleString()} {primary.name.toLowerCase()} incidents
      </span>
      <span style="margin-left: auto; color: var(--ink-3);">
        {through ? `through ${through} · ` : 'partial year · '}rate not computed
      </span>
    </div>
  );
}
