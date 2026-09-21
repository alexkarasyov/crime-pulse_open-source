// Unit tests for cross-island state: setter invariants and localStorage
// hydration guards. state.ts feature-detects `window`, so each test installs
// a minimal window stub and re-imports the module fresh (the `hydrated` flag
// is module-level and sticky by design).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type StateModule = typeof import('./state');

function makeLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    _store: store,
  };
}

const STORAGE_KEY = 'crime-pulse.v1';

let localStorage: ReturnType<typeof makeLocalStorage>;

async function freshState(persisted?: object): Promise<StateModule> {
  localStorage = makeLocalStorage(
    persisted ? { [STORAGE_KEY]: JSON.stringify(persisted) } : {},
  );
  (globalThis as Record<string, unknown>).window = { localStorage };
  vi.resetModules();
  return import('./state');
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

describe('defaults', () => {
  it('initialises to the documented defaults', async () => {
    const s = await freshState();
    expect(s.unit.value).toBe('count');
    expect(s.primaryCat.value).toBe('assault');
    expect(s.activeCats.value).toHaveLength(5);
    expect(s.includeYTD.value).toBe(false);
    expect(s.yearRange.value).toEqual([s.YEAR_MIN, s.YEAR_MAX]);
  });
});

describe('toggleCat', () => {
  it('removes an active category and adds an inactive one', async () => {
    const s = await freshState();
    s.toggleCat('assault');
    expect(s.activeCats.value).not.toContain('assault');
    s.toggleCat('assault');
    expect(s.activeCats.value).toContain('assault');
  });

  it('never empties the selection', async () => {
    const s = await freshState();
    for (const id of [...s.activeCats.value]) s.toggleCat(id);
    expect(s.activeCats.value).toHaveLength(1);
  });
});

describe('setPrimaryCat', () => {
  it('restores an excluded category to scope when selected on Compare', async () => {
    const s = await freshState();
    s.toggleCat('robbery');
    s.setPrimaryCat('robbery');
    expect(s.primaryCat.value).toBe('robbery');
    expect(s.activeCats.value).toContain('robbery');
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.activeCats).toContain(saved.primaryCat);
  });
});

describe('setYearRange', () => {
  it('clamps to the comparable window', async () => {
    const s = await freshState();
    s.setYearRange(1990, 2050);
    expect(s.yearRange.value).toEqual([s.YEAR_MIN, s.YEAR_MAX]);
  });

  it('swaps a reversed range', async () => {
    const s = await freshState();
    s.setYearRange(2022, 2018);
    expect(s.yearRange.value).toEqual([2018, 2022]);
  });

  it('enforces a minimum 2-year span (YoY needs a prior year)', async () => {
    const s = await freshState();
    s.setYearRange(2020, 2020);
    expect(s.yearRange.value).toEqual([2019, 2020]);
    s.setYearRange(s.YEAR_MIN, s.YEAR_MIN);
    expect(s.yearRange.value).toEqual([s.YEAR_MIN, s.YEAR_MIN + 1]);
  });
});

describe('persistence round-trip', () => {
  it('setters write a snapshot that hydratePersisted restores', async () => {
    const s = await freshState();
    s.setUnit('rate');
    s.setPrimaryCat('robbery');
    s.setIncludeYTD(true);
    s.setYearRange(2018, 2023);
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();

    const s2 = await freshState(JSON.parse(raw!));
    s2.hydratePersisted();
    expect(s2.unit.value).toBe('rate');
    expect(s2.primaryCat.value).toBe('robbery');
    expect(s2.includeYTD.value).toBe(true);
    expect(s2.yearRange.value).toEqual([2018, 2023]);
  });

  it('is idempotent — the second call is a no-op', async () => {
    const s = await freshState({ unit: 'rate' });
    s.hydratePersisted();
    expect(s.unit.value).toBe('rate');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ unit: 'count' }));
    s.hydratePersisted();
    expect(s.unit.value).toBe('rate');
  });
});

describe('hydratePersisted validation (tampered/legacy localStorage)', () => {
  it('survives valid JSON that is not a preferences object', async () => {
    const s = await freshState();
    localStorage.setItem(STORAGE_KEY, 'null');
    expect(() => s.hydratePersisted()).not.toThrow();
    expect(s.unit.value).toBe('count');
  });

  it('ignores an unknown unit', async () => {
    const s = await freshState({ unit: 'furlongs' });
    s.hydratePersisted();
    expect(s.unit.value).toBe('count');
  });

  it('ignores an unknown primaryCat and filters unknown activeCats', async () => {
    const s = await freshState({
      primaryCat: 'arson',
      activeCats: ['assault', 'arson', 'robbery'],
    });
    s.hydratePersisted();
    expect(s.primaryCat.value).toBe('assault');
    expect(s.activeCats.value).toEqual(['assault', 'robbery']);
  });

  it('keeps the default cats when every persisted cat is unknown', async () => {
    const s = await freshState({ activeCats: ['arson', 'jaywalking'] });
    s.hydratePersisted();
    expect(s.activeCats.value).toHaveLength(5);
  });

  it('rejects non-integer and out-of-window year ranges', async () => {
    for (const bad of [
      ['2018', '2023'], // numeric strings coerce through comparisons
      [2018.5, 2023],
      [2015, 2023], // below YEAR_MIN
      [2018, 2026], // above YEAR_MAX
      [2023, 2018], // reversed
      [2020, 2020], // zero span
    ]) {
      const s = await freshState({ yearRange: bad });
      s.hydratePersisted();
      expect(s.yearRange.value).toEqual([s.YEAR_MIN, s.YEAR_MAX]);
    }
  });

  it('survives corrupt JSON', async () => {
    localStorage = makeLocalStorage({ [STORAGE_KEY]: '{not json' });
    (globalThis as Record<string, unknown>).window = { localStorage };
    vi.resetModules();
    const s: StateModule = await import('./state');
    expect(() => s.hydratePersisted()).not.toThrow();
    expect(s.unit.value).toBe('count');
  });
});

it('exact scope selection switches the lens and rejects an empty scope', async () => {
  const s = await freshState();
  s.setCategoryScope(['robbery', 'robbery']);
  expect(s.activeCats.value).toEqual(['robbery']);
  expect(s.primaryCat.value).toBe('robbery');
  s.setCategoryScope([]);
  expect(s.activeCats.value).toEqual(['robbery']);
  s.setCategoryScope(['assault', 'robbery']);
  expect(s.primaryCat.value).toBe('robbery');
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).activeCats).toEqual(['assault', 'robbery']);
});
