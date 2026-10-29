import { describe, expect, it } from 'vitest';
import { resolveComparePicks } from './CompareScreen';

describe('resolveComparePicks', () => {
  const neighbourhoods = {
    '87': { id: '87', name: 'Waterfront Communities-The Island', population: 1, series: { assault: [] } },
    '73': { id: '73', name: 'Moss Park', population: 2, series: { assault: [] } },
  };

  it('drops inherited property names instead of treating them as neighbourhoods', () => {
    const picks = resolveComparePicks(neighbourhoods, ['__proto__', 'constructor', 'toString', '87']);
    expect(picks.map((n) => n.id)).toEqual(['87']);
    expect(() => picks.forEach((n) => n.population.toLocaleString())).not.toThrow();
  });

  it('keeps the first copy of a repeated id', () => {
    expect(resolveComparePicks(neighbourhoods, ['87', '87', '73']).map((n) => n.id)).toEqual(['87', '73']);
  });
});
