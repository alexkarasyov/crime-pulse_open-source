import { beforeEach, describe, expect, it } from 'vitest';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { CATEGORIES, YEARS, type CategoryId } from '../../lib/categories';
import { activeCats, primaryCat, unit, yearRange } from '../../lib/state';
import NeighbourhoodCalendar from './NeighbourhoodCalendar';
import NeighbourhoodIndex, { type SlimRow } from './NeighbourhoodIndex';

beforeEach(() => { primaryCat.value = 'assault'; unit.value = 'count'; yearRange.value = [2019, 2021]; activeCats.value = CATEGORIES.map(c => c.id); });
const countsByCat = Object.fromEntries(CATEGORIES.map((c, ci) => [c.id, Array.from({length:12}, (_, m) => YEARS.map((_, yi) => 10 + ci + m + yi))])) as Record<CategoryId, number[][]>;

describe('inspectable calendar values', () => {
  it('renders the selected months and years as a real table, with one keyboard entry point', () => {
    const html = renderToString(h(NeighbourhoodCalendar, {countsByCat}));
    expect(html).toContain('View monthly data');
    expect(html).toContain('monthly incident counts · 2019–2021');
    expect(html).toContain('<th scope="row">Jan</th><td>13</td><td>14</td><td>15</td>');
    expect((html.match(/class="cal-cell-button"/g) ?? []).length).toBe(36);
    expect((html.match(/tabindex="0"/g) ?? []).length).toBe(2); // roving cell + scrollable table
  });
  it('keeps sparse all-category fallback values explicitly labelled in rate mode', () => {
    unit.value = 'rate';
    const sparse = {...countsByCat, assault: []};
    const html = renderToString(h(NeighbourhoodCalendar, {countsByCat:sparse}));
    expect(html).toContain('All five categories · monthly incident counts');
    expect(html).toContain('<th scope="row">Jan</th><td>62</td><td>66</td><td>70</td>');
  });
});

it('index distinguishes summed scope from a single category in labels and totals', () => {
  const row: SlimRow = {id:'73', name:'Moss Park', population:10000, series:Object.fromEntries(CATEGORIES.map((c, i) => [c.id,{counts:YEARS.map(()=>(i+1)*100),rates:YEARS.map(()=>(i+1)*100)}])) as SlimRow['series']};
  const all = renderToString(h(NeighbourhoodIndex, {rows:[row]}));
  expect(all).toContain('5 CATEGORIES SUMMED');
  expect(all).toContain('1,500');
  activeCats.value = ['assault'];
  const single = renderToString(h(NeighbourhoodIndex, {rows:[row]}));
  expect(single).not.toContain('CATEGORIES SUMMED');
  expect(single).toContain('aria-label="Show only Assault"');
  expect(single).not.toContain('1,500');
});
