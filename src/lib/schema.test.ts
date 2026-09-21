import { describe, expect, it, vi } from 'vitest';
import { datasetSchema, neighbourhoodBreadcrumbs, webSiteSchema } from './schema';

vi.mock('./aggregates', () => ({
  dataImportedAt: () => '2026-08-30',
  dataThrough: () => '2026-03-31',
}));

describe('structured-data site URLs', () => {
  it.each([
    ['production fallback', undefined, 'https://crimepulse.ca'],
    ['configured custom origin', new URL('https://staging.example.test/'), 'https://staging.example.test'],
  ] as const)('keeps all first-party URLs on the %s', (_label, site, origin) => {
    const website = webSiteSchema(site);
    const dataset = datasetSchema(site);
    const breadcrumbs = neighbourhoodBreadcrumbs('73', 'Moss Park', site);

    expect(website.url).toBe(`${origin}/`);
    expect(dataset.url).toBe(`${origin}/about/`);
    expect((dataset.creator as Record<string, unknown>).url).toBe(`${origin}/`);
    expect((breadcrumbs.itemListElement as Array<{ item: string }>).map((entry) => entry.item))
      .toEqual([`${origin}/`, `${origin}/neighbourhood/`, `${origin}/neighbourhood/73/`]);
    expect(dataset.sameAs).toBe('https://data.torontopolice.on.ca/');
  });
});
