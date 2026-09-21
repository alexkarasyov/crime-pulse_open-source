import { beforeEach, describe, expect, it } from 'vitest';
import { h } from 'preact';
import render from 'preact-render-to-string';
import ChartDataTable from './ChartDataTable';
import CompareTrendChart from './CompareTrendChart';
import TrendChart from './TrendChart';
import SmallMultiples from './SmallMultiples';
import OverviewTrend from '../islands/OverviewTrend';
import NeighbourhoodTrend from '../islands/NeighbourhoodTrend';
import { activeCats, primaryCat, unit, yearRange } from '../../lib/state';
import { CATEGORIES } from '../../lib/categories';

const points = [
  { year: 2016, count: 100, rate: 10.12 },
  { year: 2017, count: 110, rate: 11.14 },
  { year: 2018, count: 120, rate: 12.16 },
];
const baseline = points.map((p) => ({ ...p, count: p.count * 100, rate: p.rate * 2 }));
const seriesByCat = Object.fromEntries(CATEGORIES.map((c, i) => [c.id, points.map((p) => ({ ...p, count: p.count + i, rate: p.rate + i }))]));

beforeEach(() => {
  unit.value = 'count';
  primaryCat.value = 'assault';
  activeCats.value = CATEGORIES.map((c) => c.id);
  yearRange.value = [2016, 2025];
});

describe('chart value disclosures', () => {
  it('renders native keyboard disclosure and table semantics, retaining zero versus missing rates', () => {
    const html = render(h(ChartDataTable, {
      title: 'Test area', unit: 'rate', series: [{ label: 'Assault', points: [
        { year: 2025, count: 0, rate: 0 },
        { year: 2026, count: 12, rate: null, partial: true },
      ] }],
    }));
    expect(html).toContain('<details class="chart-data"><summary>View chart data</summary>');
    expect(html).toContain('scope="col">Assault');
    expect(html).toContain('scope="row">2026 YTD');
    expect(html).toContain('<td>0.00</td>');
    expect(html).toContain('<td>Not available</td>');
    expect(html).toContain('tabindex="0" role="region"');
    expect(html).toContain('incidents per 10,000 residents');
  });

  it('Overview table reconciles the selected scope and window', () => {
    activeCats.value = ['assault', 'robbery'];
    yearRange.value = [2017, 2018];
    const html = render(h(OverviewTrend, { torontoSeries: seriesByCat, totalSeries: baseline }));
    const table = html.slice(html.indexOf('<table>'));
    expect(table).not.toContain('2016');
    expect(table).toContain('2017–2018');
    expect(table).toContain('Assault + Robbery (baseline)');
    expect(table).toContain('<td>110</td><td>223</td>');
    expect(table).toContain('<td>120</td><td>243</td>');
  });

  it('neighbourhood main table omits the Toronto column in counts and restores it in rates', () => {
    const props = { nbhdName: 'Test neighbourhood', seriesByCat, torontoByCat: { assault: baseline } };
    const counts = render(h(NeighbourhoodTrend, props));
    expect(counts).not.toContain('scope="col">Toronto-wide (baseline)');
    unit.value = 'rate';
    const rates = render(h(NeighbourhoodTrend, props));
    expect(rates).toContain('scope="col">Toronto-wide (baseline)');
    expect(rates).toContain('<td>10.12</td><td>20.24</td>');
  });

  it('small-multiples table follows category scope and year window', () => {
    activeCats.value = ['robbery'];
    yearRange.value = [2017, 2018];
    const html = render(h(SmallMultiples, { seriesByCat, unit: 'rate', scoped: true, geography: 'Test area' }));
    const table = html.slice(html.indexOf('<table>'));
    expect(table).toContain('Test area category trends');
    expect(table).toContain('scope="col">Robbery');
    expect(table).not.toContain('Assault');
    expect(table).not.toContain('2016');
    expect(table).toContain('<td>14.14</td>');
  });
});

describe('visible chart scale and labels', () => {
  it('a hidden TrendChart baseline produces exactly the same chart as omitting it', () => {
    const props = { series: points, unit: 'count' as const, gradientId: 'fixed', seriesLabel: 'Local assault' };
    const hidden = render(h(TrendChart, { ...props, baseline, showBaseline: false }));
    expect(hidden).toBe(render(h(TrendChart, props)));
    expect(hidden).toContain('Local assault, incident counts, 2016–2018');
  });

  it('Compare expands neighbourhood traces when Toronto is hidden and keeps full names outside the plot', () => {
    const picks = [
      { id: '1', name: 'Long neighbourhood name one', color: 'red', points },
      { id: '2', name: 'Long neighbourhood name two', color: 'blue', points },
    ];
    const props = { picks, unit: 'count' as const, category: 'Assault' };
    const hidden = render(h(CompareTrendChart, props));
    const shown = render(h(CompareTrendChart, { ...props, baseline }));
    expect(hidden).toContain('data-baseline-visible="false"');
    expect(hidden).not.toContain('data-series="toronto"');
    expect(hidden).not.toContain('scope="col">Toronto-wide');
    expect(shown).toContain('data-series="toronto"');
    expect(shown).toContain('scope="col">Toronto-wide (baseline)');
    const pathYs = (html: string) => [...html.match(/data-series="1" d="([^"]+)/)![1]!.matchAll(/,[\d.]+/g)].map((m) => Number(m[0].slice(1)));
    const span = (values: number[]) => Math.max(...values) - Math.min(...values);
    expect(span(pathYs(hidden))).toBeGreaterThan(span(pathYs(shown)) * 90);
    expect(hidden).toContain('1. Long neighbourhood name one');
    expect(hidden).toContain('stroke-dasharray="8 3"');
    expect(hidden).not.toMatch(/<text[^>]*>Long neighbourhood/);
  });
});
