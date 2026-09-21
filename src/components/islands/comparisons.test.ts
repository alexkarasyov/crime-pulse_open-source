import { beforeEach, describe, expect, it } from 'vitest';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { CATEGORIES } from '../../lib/categories';
import { primaryCat, unit, yearRange } from '../../lib/state';
import NeighbourhoodHero from './NeighbourhoodHero';
import NeighboursTable, { type NeighbourRow } from './NeighboursTable';

beforeEach(() => {
  primaryCat.value = 'assault';
  unit.value = 'count';
  yearRange.value = [2016, 2017];
});

describe('neighbourhood comparisons', () => {
  it('compares the neighbourhood with Toronto per capita in either display unit', () => {
    const props = {
      seriesByCat: { assault: [
        { year: 2016, count: 100, rate: 10 },
        { year: 2017, count: 200, rate: 20 },
      ] },
      torontoByCat: { assault: [
        { year: 2016, count: 1000, rate: 20 },
        { year: 2017, count: 1200, rate: 10 },
      ] },
    };
    for (const u of ['count', 'rate'] as const) {
      unit.value = u;
      const html = renderToString(h(NeighbourhoodHero, props));
      expect(html).toContain('vs. Toronto (rate)');
      expect(html).toMatch(/vs\. Toronto \(rate\)<\/span><span[^>]*>▲ 100%<\/span>/);
    }
  });

  const cityByCat = Object.fromEntries(CATEGORIES.map((c) => [c.id, {
    counts: [1000, 1100, 1300],
    rates: [10, 8, 9],
  }])) as NeighbourRow['byCat'];

  it('uses the displayed unit for the city change with annual population denominators', () => {
    const props = {
      years: [2016, 2017, 2018],
      rows: [],
      selfId: '1',
      cityByCat,
    };
    const countHtml = renderToString(h(NeighboursTable, props));
    expect(countHtml).toContain('▲ 10%');
    unit.value = 'rate';
    const rateHtml = renderToString(h(NeighboursTable, props));
    expect(rateHtml).toContain('▼ 20%');
    expect(rateHtml).not.toContain('▲ 10%');
  });

  it('shows the city population for the selected end year', () => {
    const html = renderToString(h(NeighboursTable, {
      years: [2016, 2017, 2018],
      rows: [],
      selfId: '1',
      cityByCat,
      cityPopulationByYear: { 2016: 1000000, 2017: 1375000, 2018: 1444444 },
    }));
    expect(html).toContain((1375000).toLocaleString());
    expect(html).not.toContain((1444444).toLocaleString());
  });
});
