// Calendar heatmap (month × year), laid out as two columns: the grid on the
// left, the title/legend/explainer on the right. Reacts to primaryCat and
// the view rail's year window (columns are sliced to the selected years).
//
// Props are dense count arrays (12 months × YEARS.length), not
// {month, year, count} cell objects — the (month, year) axis is implied by
// index, which keeps the serialized astro-island props small.
//
// Small-base rule (v2 design): single-category shading needs ~3 incidents a
// month to mean anything. Below that the primary category's grid is mostly
// noise, so the heatmap falls back to the sum of all five categories and the
// explainer says why.

import { CATEGORIES, CAT_BY_ID, YEARS, type CategoryId } from '../../lib/categories';
import { primaryCat, yearRange } from '../../lib/state';
import { useId, useRef, useState } from 'preact/hooks';

interface Props {
  /** Per category: 12 rows (month-1) × YEARS.length columns of counts. */
  countsByCat: Record<CategoryId, number[][]>;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Mean monthly incident count below which single-category shading is noise. */
const MIN_MONTHLY_MEAN = 3;

function gridTotal(grid: number[][]): number {
  return grid.reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0);
}

export default function NeighbourhoodCalendar({ countsByCat }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const helpId = useId();
  const [selected, setSelected] = useState({ year: YEARS[0]!, month: 0 });
  const cat = primaryCat.value;
  const [ys, ye] = yearRange.value;
  const primary = CAT_BY_ID[cat];

  // Column window: YEARS indices inside the selected year range.
  const startIdx = Math.max(0, YEARS.findIndex((y) => y >= ys));
  let endIdx = YEARS.length - 1;
  while (endIdx > 0 && YEARS[endIdx]! > ye) endIdx--;
  const years = YEARS.slice(startIdx, endIdx + 1);
  const sliceCols = (g: number[][]): number[][] =>
    g.map((row) => row.slice(startIdx, endIdx + 1));

  const primaryGrid = sliceCols(countsByCat[cat] ?? []);
  const months = primaryGrid.length || 12;
  const cells = months * years.length;
  const primaryTotal = gridTotal(primaryGrid);
  const sparse = cells > 0 && primaryTotal / cells < MIN_MONTHLY_MEAN;

  // Sparse primary → shade by the sum of all five categories instead.
  const grid = sparse
    ? Array.from({ length: months }, (_, m) =>
        Array.from({ length: years.length }, (_, yi) =>
          CATEGORIES.reduce(
            (s, c) => s + (countsByCat[c.id]?.[m]?.[startIdx + yi] ?? 0),
            0,
          ),
        ),
      )
    : primaryGrid;
  const color = sparse ? 'var(--accent)' : primary.color;
  const allTotal = CATEGORIES.reduce(
    (s, c) => s + gridTotal(sliceCols(countsByCat[c.id] ?? [])),
    0,
  );
  const perMonth = cells > 0 ? allTotal / cells : 0;
  const perYear = years.length > 0 ? primaryTotal / years.length : 0;

  const flat = grid.flat();
  const max = flat.length ? Math.max(...flat) || 1 : 1;
  const selectedYear = years.includes(selected.year) ? selected.year : years[0]!;
  const selectedColumn = years.indexOf(selectedYear);
  const selectedCount = grid[selected.month]?.[selectedColumn] ?? 0;
  const scopeName = sparse ? 'All five categories' : primary.name;
  return (
    <div class="cal-compact cal-cols">
      <div>
        <div
          class="cal-grid"
          ref={gridRef}
          role="table"
          aria-label={`${sparse ? 'All five categories' : primary.name} monthly incident counts, ${years[0]} to ${years[years.length - 1]}`}
          style={`grid-template-columns: 36px repeat(${years.length}, minmax(0, 1fr));`}
        >
          <div role="row" style="display: contents;">
            <span role="columnheader" aria-label="Month" />
            {years.map((y) => (
              <div role="columnheader" class="cal-col-label">'{String(y).slice(2)}</div>
            ))}
          </div>
          {grid.map((row, m) => (
            <div role="row" style="display: contents;">
              <div role="rowheader" class="cal-label">{MONTHS[m]}</div>
              {row.map((count, yi) => {
                const t = count / max;
                const label = `${MONTHS[m]} ${years[yi]}: ${count} incidents`;
                const bg =
                  t > 0.02
                    ? `color-mix(in oklab, ${color} ${(t * 100).toFixed(0)}%, var(--surface-2))`
                    : 'var(--surface-2)';
                return (
                  <div
                    class="cal-cell"
                    role="cell"
                    style={`background: ${bg};`}
                  >
                    <button
                      type="button"
                      class="cal-cell-button"
                      data-month={m}
                      data-column={yi}
                      aria-label={`${scopeName}, ${label}`}
                      aria-describedby={helpId}
                      aria-pressed={selected.month === m && selectedYear === years[yi]}
                      tabIndex={selected.month === m && selectedYear === years[yi] ? 0 : -1}
                      title={label}
                      onFocus={() => setSelected({ month: m, year: years[yi]! })}
                      onClick={() => setSelected({ month: m, year: years[yi]! })}
                      onKeyDown={(event) => {
                        let month = m;
                        let column = yi;
                        if (event.key === 'ArrowRight') column++;
                        else if (event.key === 'ArrowLeft') column--;
                        else if (event.key === 'ArrowDown') month++;
                        else if (event.key === 'ArrowUp') month--;
                        else if (event.key === 'Home') column = 0;
                        else if (event.key === 'End') column = years.length - 1;
                        else return;
                        event.preventDefault();
                        month = Math.max(0, Math.min(grid.length - 1, month));
                        column = Math.max(0, Math.min(years.length - 1, column));
                        gridRef.current?.querySelector<HTMLButtonElement>(
                          `[data-month="${month}"][data-column="${column}"]`,
                        )?.focus();
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 12px; font-family: var(--font-mono); font-size: 10px; color: var(--ink-3); letter-spacing: 0.06em;">
          <span>LOW</span>
          <div style="display: flex; gap: 2px;">
            {[0.05, 0.25, 0.5, 0.75, 1].map((t) => (
              <div
                style={`width: 14px; height: 10px; border-radius: 2px; background: color-mix(in oklab, ${color} ${t * 100}%, var(--surface-2));`}
              />
            ))}
          </div>
          <span>HIGH</span>
        </div>
        <p class="calendar-readout" role="status" aria-live="polite">
          <strong>{MONTHS[selected.month]} {selectedYear}</strong> · {scopeName}: {selectedCount.toLocaleString()} incidents
        </p>
        <details class="calendar-values">
          <summary>View monthly data</summary>
          <div class="calendar-values-scroll" tabIndex={0} role="region" aria-label="Monthly incident data, scroll horizontally">
            <table>
              <caption>{scopeName} · monthly incident counts · {years[0]}–{years[years.length - 1]}</caption>
              <thead><tr><th scope="col">Month</th>{years.map((y) => <th scope="col" key={y}>{y}</th>)}</tr></thead>
              <tbody>{grid.map((row, m) => (
                <tr key={m}><th scope="row">{MONTHS[m]}</th>{row.map((count, yi) => <td key={yi}>{count.toLocaleString()}</td>)}</tr>
              ))}</tbody>
            </table>
          </div>
        </details>
      </div>
      <div>
        <h3 class="card-title" style="margin: 0;">
          {sparse ? 'All five categories, monthly' : `${primary.name}, monthly`}
        </h3>
        <p class="card-sub" style="margin: 6px 0 0;">
          {years[0]} – {years[years.length - 1]} · darker = more · counts in every unit mode
        </p>
        <p class="vrail-hint" id={helpId}>Tap a cell to see its count. With the calendar focused, use arrow keys to move between months and years, or open the monthly data table.</p>
        {sparse ? (
          <div class="caveat compact" style="margin-top: 16px;">
            <span class="caveat-icon">◻</span>
            <div class="caveat-body">
              <strong>Keyed to all categories</strong> — {allTotal.toLocaleString()} incidents
              over {years.length} year{years.length === 1 ? '' : 's'} is roughly{' '}
              {perMonth.toFixed(1)} a month. {primary.name} alone is ~{perYear.toFixed(0)} a
              year here, too sparse to shade meaningfully, so single-category shading
              switches off below ~{MIN_MONTHLY_MEAN} incidents a month.
            </div>
          </div>
        ) : (
          <p class="vrail-hint" style="margin-top: 16px;">
            Shading is keyed to the <strong>primary category</strong> — pick another on the
            trend chart above. Cells are shaded relative to the busiest month in this view.
          </p>
        )}
      </div>
    </div>
  );
}
