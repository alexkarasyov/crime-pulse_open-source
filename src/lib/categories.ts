// Canonical category list — name, colour, glyph, short code.
// This is metadata, not data; the build pipeline doesn't emit it.
// Single source of truth shared by the Astro frontmatter and the Preact islands.

export type CategoryId =
  | 'assault'
  | 'autoTheft'
  | 'breakEnter'
  | 'robbery'
  | 'theftOver';

export type CategoryGlyph =
  | 'diamond'
  | 'square'
  | 'triangle'
  | 'circle'
  | 'cross';

export interface Category {
  id: CategoryId;
  name: string;
  glyph: CategoryGlyph;
  /** CSS var() string — e.g. `var(--cat-assault)`. */
  color: string;
  /** Dimmed counterpart of `color` for backgrounds / wash fills. */
  dim: string;
  /** Three-letter glance code for dense tables. */
  shortCode: string;
}

export const CATEGORIES: readonly Category[] = [
  {
    id: 'assault',
    name: 'Assault',
    glyph: 'diamond',
    color: 'var(--cat-assault)',
    dim: 'var(--cat-assault-dim)',
    shortCode: 'ASL',
  },
  {
    id: 'autoTheft',
    name: 'Auto Theft',
    glyph: 'square',
    color: 'var(--cat-autoTheft)',
    dim: 'var(--cat-autoTheft-dim)',
    shortCode: 'AUT',
  },
  {
    id: 'breakEnter',
    name: 'Break and Enter',
    glyph: 'triangle',
    color: 'var(--cat-breakEnter)',
    dim: 'var(--cat-breakEnter-dim)',
    shortCode: 'B&E',
  },
  {
    id: 'robbery',
    name: 'Robbery',
    glyph: 'circle',
    color: 'var(--cat-robbery)',
    dim: 'var(--cat-robbery-dim)',
    shortCode: 'ROB',
  },
  {
    id: 'theftOver',
    name: 'Theft Over $5,000',
    glyph: 'cross',
    color: 'var(--cat-theftOver)',
    dim: 'var(--cat-theftOver-dim)',
    shortCode: 'TOV',
  },
] as const;

export const CAT_BY_ID: Readonly<Record<CategoryId, Category>> =
  Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Readonly<
    Record<CategoryId, Category>
  >;

/** The comparable year range the dashboard uses everywhere. */
export const YEARS: readonly number[] = [
  2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
] as const;
