// Topbar unit toggle island — switches every rate/count number on the page.
// Reads/writes the shared `unit` signal in src/lib/state.ts.

import { unit, setUnit } from '../../lib/state';

export default function UnitToggle() {
  const u = unit.value;
  return (
    <div class="seg" role="group" aria-label="Unit">
      <button
        type="button"
        class={`seg-btn ${u === 'count' ? 'active' : ''}`}
        aria-pressed={u === 'count'}
        onClick={() => setUnit('count')}
      >
        Counts
      </button>
      <button
        type="button"
        class={`seg-btn ${u === 'rate' ? 'active' : ''}`}
        aria-pressed={u === 'rate'}
        onClick={() => setUnit('rate')}
      >
        Rate / 10K
      </button>
    </div>
  );
}
