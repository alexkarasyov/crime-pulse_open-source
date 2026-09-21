// Small toggle button for the choropleth's YoY arrow overlay (P1.8d).
// Sits in the map section header next to the category picker.

import { showYoyArrows, setShowYoyArrows } from '../../lib/state';

export default function MapArrowToggle() {
  const on = showYoyArrows.value;
  return (
    <button
      type="button"
      class={`filter-chip ${on ? 'on' : ''}`}
      aria-pressed={on}
      onClick={() => setShowYoyArrows(!on)}
      style={on ? 'color: var(--accent); border-color: var(--accent-line);' : ''}
      title="Toggle YoY arrows on each polygon"
    >
      <span style="font-family: var(--font-mono); font-size: 11px;">▲▼</span>
      <span style="margin-left: 4px;">YoY arrows</span>
    </button>
  );
}
