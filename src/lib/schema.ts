// JSON-LD structured-data builders (schema.org). Server-only: consumed by
// Astro frontmatter and serialized into <script type="application/ld+json">
// by Base.astro. Kept honest — every field states something the About page
// also claims (sources, licence, coverage window).

import { dataImportedAt, dataThrough } from './aggregates';

export const SITE_URL = 'https://crimepulse.ca';
export const SITE_NAME = 'Toronto Crime Pulse';

type JsonLd = Record<string, unknown>;

// Use the same configured site as canonicals, OG metadata, and robots.txt.
// Astro.site carries SITE_URL overrides from astro.config.mjs at build time.
function siteUrl(path: string, site: URL | undefined): string {
  return new URL(path, site ?? SITE_URL).href;
}

/** Site-level WebSite node — homepage only (one per origin is the norm). */
export function webSiteSchema(site: URL | undefined): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: siteUrl('/', site),
    description:
      'Ten years of Toronto crime trends from TPS Community Safety Indicators — incident counts and rates per 10,000 residents across all 158 neighbourhoods.',
    inLanguage: 'en-CA',
  };
}

/** The underlying dataset the dashboard renders — eligible for Google
 *  Dataset Search. Emitted on the Overview and About pages. */
export function datasetSchema(site: URL | undefined): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    // Name window derives from the same source as temporalCoverage so the
    // two fields can't disagree (dataThrough includes any loaded YTD year).
    name: `Toronto neighbourhood crime rates, 2016–${dataThrough().slice(0, 4)}`,
    description:
      'Toronto Police Service Community Safety Indicators (assault, auto theft, break and enter, robbery, theft over $5,000) aggregated per year and per neighbourhood, as raw incident counts and as rates per 10,000 residents using Statistics Canada population denominators. Covers all 158 official Toronto neighbourhoods.',
    url: siteUrl('/about/', site),
    sameAs: 'https://data.torontopolice.on.ca/',
    license: 'https://open.toronto.ca/open-data-license/',
    isAccessibleForFree: true,
    creator: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: siteUrl('/', site),
    },
    temporalCoverage: `2016-01-01/${dataThrough()}`,
    dateModified: dataImportedAt(),
    spatialCoverage: {
      '@type': 'Place',
      name: 'Toronto, Ontario, Canada',
    },
    keywords: [
      'Toronto crime statistics',
      'neighbourhood crime rates',
      'Toronto Police Service',
      'Community Safety Indicators',
      'crime per capita',
    ],
  };
}

/** Breadcrumb trail for a neighbourhood page:
 *  Overview → Neighbourhoods → {name}. */
export function neighbourhoodBreadcrumbs(id: string, name: string, site: URL | undefined): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: SITE_NAME,
        item: siteUrl('/', site),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Neighbourhoods',
        item: siteUrl('/neighbourhood/', site),
      },
      {
        '@type': 'ListItem',
        position: 3,
        name,
        item: siteUrl(`/neighbourhood/${id}/`, site),
      },
    ],
  };
}
