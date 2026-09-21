// Small segmented control of category short-codes. Used beside the map
// and beside the Neighbourhood trend chart. Click → setPrimaryCat.

import { CATEGORIES, type CategoryId } from '../../lib/categories';
import { ensureCatOn, primaryCat, setPrimaryCat } from '../../lib/state';
import CatGlyph from '../preact/CatGlyph';

// Picking a primary category also forces it into the page scope (activeCats)
// — a primary lens that the scope chips have hidden would render nothing.
function pick(id: CategoryId): void {
  setPrimaryCat(id);
  ensureCatOn(id);
}

interface Props {
  variant?: 'seg' | 'chips';
  showName?: boolean;
}

export default function CategoryPicker({
  variant = 'seg',
  showName = false,
}: Props) {
  const pc = primaryCat.value;
  if (variant === 'chips') {
    return (
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        {CATEGORIES.map((c) => {
          const on = pc === c.id;
          return (
            <button
              type="button"
              class={`filter-chip ${on ? 'on' : ''}`}
              aria-pressed={on}
              onClick={() => pick(c.id)}
              style={on ? `color: ${c.color}; border-color: ${c.color};` : ''}
            >
              <CatGlyph cat={c} size={8} /> {showName ? c.name : c.shortCode}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div class="seg" role="group" aria-label="Category">
      {CATEGORIES.map((c) => {
        const on = pc === c.id;
        return (
          <button
            type="button"
            class={`seg-btn ${on ? 'active' : ''}`}
            aria-pressed={on}
            onClick={() => pick(c.id)}
            style={on ? `color: ${c.color};` : ''}
          >
            <CatGlyph cat={c} size={8} />{' '}
            <span style="margin-left: 4px;">{showName ? c.name : c.shortCode}</span>
          </button>
        );
      })}
    </div>
  );
}
