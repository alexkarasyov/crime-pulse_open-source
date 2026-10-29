// Unit tests for shareable-URL state encoding/decoding. buildQuery() is
// exercised directly against the signals; the URL-parsing path is exercised
// through initUrlSync() with a stubbed window whose location carries the
// query under test.
import { afterEach, describe, expect, it, vi } from 'vitest';

type StateModule = typeof import('./state');
type UrlModule = typeof import('./urlState');

interface Stub {
  state: StateModule;
  url: UrlModule;
  win: {
    location: { search: string; pathname: string; hash: string; origin: string };
    history: { replaceState: (a: unknown, b: string, next: string) => void };
    addEventListener: (type: string, fn: () => void) => void;
    localStorage: { getItem: (k: string) => string | null; setItem: () => void };
    _popstate?: () => void;
    _lastUrl?: string;
  };
}

async function fresh(search = ''): Promise<Stub> {
  const win: Stub['win'] = {
    location: { search, pathname: '/', hash: '', origin: 'https://example.test' },
    history: {
      replaceState: (_a, _b, next) => {
        win._lastUrl = next;
        // Mirror the browser: replaceState rewrites the current location.
        const q = next.indexOf('?');
        const h = next.indexOf('#');
        const end = h === -1 ? next.length : h;
        win.location.search = q === -1 ? '' : next.slice(q, end);
        win.location.hash = h === -1 ? '' : next.slice(h);
      },
    },
    addEventListener: (type, fn) => {
      if (type === 'popstate') win._popstate = fn;
    },
    localStorage: { getItem: () => null, setItem: () => {} },
  };
  (globalThis as Record<string, unknown>).window = win;
  vi.resetModules();
  const state: StateModule = await import('./state');
  const url: UrlModule = await import('./urlState');
  return { state, url, win };
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

describe('buildQuery', () => {
  it('is empty at defaults (clean shareable URLs)', async () => {
    const { url } = await fresh();
    expect(url.buildQuery()).toBe('');
  });

  it('encodes each non-default signal with its short key', async () => {
    const { state, url } = await fresh();
    state.setUnit('rate');
    expect(url.buildQuery()).toBe('u=rate');
    state.setUnit('count');

    state.setPrimaryCat('breakEnter');
    expect(url.buildQuery()).toBe('p=be');
    state.setPrimaryCat('assault');

    state.setYearRange(2018, 2023);
    expect(url.buildQuery()).toBe('y=2018-2023');
    state.setYearRange(state.YEAR_MIN, state.YEAR_MAX);

    state.setIncludeYTD(true);
    expect(url.buildQuery()).toBe('ytd=1');
    state.setIncludeYTD(false);

    url.setComparePicks(['1', '2']);
    expect(url.buildQuery()).toBe('cmp=1,2');
  });

  it('encodes a category subset as stable short codes', async () => {
    const { state, url } = await fresh();
    state.toggleCat('theftOver');
    state.toggleCat('robbery');
    expect(url.buildQuery()).toBe('c=as,at,be');
  });

  it('treats an equal-by-value compare pick list as default', async () => {
    const { url } = await fresh();
    url.setComparePicks([...url.DEFAULT_COMPARE_PICKS]);
    expect(url.buildQuery()).toBe('');
  });
});

describe('initUrlSync — hydrating from a shared link', () => {
  it('applies every recognised key', async () => {
    const { state, url } = await fresh('?u=rate&p=ro&c=as,ro&y=2017-2023&ytd=1&cmp=5,9,12');
    url.initUrlSync();
    expect(state.unit.value).toBe('rate');
    expect(state.primaryCat.value).toBe('robbery');
    expect(state.activeCats.value).toEqual(['assault', 'robbery']);
    expect(state.yearRange.value).toEqual([2017, 2023]);
    expect(state.includeYTD.value).toBe(true);
    expect(url.comparePicks.value).toEqual(['5', '9', '12']);
  });

  it('rejects malformed values and keeps defaults', async () => {
    const { state, url } = await fresh('?u=parsecs&p=zz&c=zz,yy&y=2015-2030&cmp=1');
    url.initUrlSync();
    expect(state.unit.value).toBe('count');
    expect(state.primaryCat.value).toBe('assault');
    expect(state.activeCats.value).toHaveLength(5);
    expect(state.yearRange.value).toEqual([state.YEAR_MIN, state.YEAR_MAX]);
    // cmp needs 2–4 ids; a single id is ignored.
    expect(url.comparePicks.value).toEqual(url.DEFAULT_COMPARE_PICKS);
  });

  it('rejects compare ids that are not neighbourhood numbers', async () => {
    const proto = await fresh('?cmp=__proto__,constructor');
    proto.url.initUrlSync();
    expect(proto.url.comparePicks.value).toEqual(proto.url.DEFAULT_COMPARE_PICKS);

    const mixed = await fresh('?cmp=87,__proto__,73');
    mixed.url.initUrlSync();
    expect(mixed.url.comparePicks.value).toEqual(mixed.url.DEFAULT_COMPARE_PICKS);

    const inherited = await fresh('?cmp=toString,valueOf');
    inherited.url.initUrlSync();
    expect(inherited.url.comparePicks.value).toEqual(inherited.url.DEFAULT_COMPARE_PICKS);
  });

  it('rejects a reversed or degenerate year range', async () => {
    const { state, url } = await fresh('?y=2023-2018');
    url.initUrlSync();
    expect(state.yearRange.value).toEqual([state.YEAR_MIN, state.YEAR_MAX]);
  });

  it('dedupes repeated category codes', async () => {
    const { state, url } = await fresh('?c=as,as,ro');
    url.initUrlSync();
    expect(state.activeCats.value).toEqual(['assault', 'robbery']);
  });

  it('keeps the primary lens inside page scope for hand-edited links', async () => {
    const { state, url } = await fresh('?p=as&c=ro');
    url.initUrlSync();
    expect(state.activeCats.value).toEqual(['robbery']);
    expect(state.primaryCat.value).toBe('robbery');
  });

  it('writes signal changes back into the query, preserving the anchor', async () => {
    const { state, url, win } = await fresh();
    win.location.hash = '#main-content';
    url.initUrlSync();
    state.setUnit('rate');
    expect(win._lastUrl).toBe('/?u=rate#main-content');
  });

  it('popstate resets unmentioned keys to defaults (history traversal)', async () => {
    const { state, url, win } = await fresh('?u=rate&ytd=1');
    url.initUrlSync();
    expect(state.unit.value).toBe('rate');
    expect(state.includeYTD.value).toBe(true);

    // Traverse back to an entry that only asserts the year range.
    win.location.search = '?y=2018-2023';
    win._popstate!();
    expect(state.yearRange.value).toEqual([2018, 2023]);
    expect(state.unit.value).toBe('count');
    expect(state.includeYTD.value).toBe(false);
  });

  it('popstate to an entry with no state keys resets everything', async () => {
    const { state, url, win } = await fresh('?u=rate&p=ro&ytd=1');
    url.initUrlSync();
    expect(state.unit.value).toBe('rate');

    // Traverse back to a clean-URL entry (e.g. the pre-anchor-click entry):
    // no state keys means the all-defaults view.
    win.location.search = '';
    win._popstate!();
    expect(state.unit.value).toBe('count');
    expect(state.primaryCat.value).toBe('assault');
    expect(state.includeYTD.value).toBe(false);
    expect(state.activeCats.value).toHaveLength(5);
  });

  it('initial load with a clean URL still honours localStorage prefs', async () => {
    const stub = await fresh('');
    stub.win.localStorage = {
      getItem: (k: string) =>
        k === 'crime-pulse.v1' ? JSON.stringify({ unit: 'rate' }) : null,
      setItem: () => {},
    };
    stub.url.initUrlSync();
    expect(stub.state.unit.value).toBe('rate');
  });
});

describe('buildShareUrl', () => {
  it('assembles origin + path + query + hash', async () => {
    const { state, url, win } = await fresh();
    url.initUrlSync();
    state.setUnit('rate');
    win.location.hash = '#main-content';
    const shared = new URL(url.buildShareUrl());
    expect(shared.origin + shared.pathname).toBe('https://example.test/');
    expect(shared.searchParams.get('u')).toBe('rate');
    expect(shared.hash).toBe('#main-content');
  });

  it('reproduces a default view over recipient preferences, including after reload', async () => {
    const sender = await fresh();
    sender.url.initUrlSync();
    const shared = new URL(sender.url.buildShareUrl());
    const saved = JSON.stringify({
      unit: 'rate',
      primaryCat: 'robbery',
      activeCats: ['robbery'],
      yearRange: [2019, 2024],
      includeYTD: true,
    });
    const receiver = await fresh(shared.search);
    receiver.win.localStorage.getItem = () => saved;
    receiver.url.initUrlSync();
    expect(receiver.state.unit.value).toBe('count');
    expect(receiver.state.primaryCat.value).toBe('assault');
    expect(receiver.state.activeCats.value).toHaveLength(5);
    expect(receiver.state.yearRange.value).toEqual([2016, 2025]);
    expect(receiver.state.includeYTD.value).toBe(false);

    // Canonicalization must retain the explicit defaults, otherwise reloading
    // a clean URL would reapply the recipient's original saved rate preference.
    const reloaded = await fresh(receiver.win.location.search);
    reloaded.win.localStorage.getItem = () => saved;
    reloaded.url.initUrlSync();
    expect(reloaded.state.unit.value).toBe('count');
    expect(reloaded.state.activeCats.value).toHaveLength(5);
  });
});

describe('Compare baseline URL state', () => {
  it('defaults off for counts and on for rates and keeps independent user choices', async () => {
    const { state, url } = await fresh();
    expect(url.compareBaseline.value).toEqual({ count: false, rate: true });
    url.setCompareBaseline(true);
    state.setUnit('rate');
    url.setCompareBaseline(false);
    expect(url.compareBaseline.value).toEqual({ count: true, rate: false });
    expect(url.buildQuery()).toContain('cb=10');
    state.setUnit('count');
    expect(url.compareBaseline.value.count).toBe(true);
  });

  it('preserves both choices through share, reload, and history traversal', async () => {
    const { url, win } = await fresh('?u=rate&cb=10');
    url.initUrlSync();
    expect(url.compareBaseline.value).toEqual({ count: true, rate: false });
    const reloaded = await fresh(new URL(url.buildShareUrl()).search);
    reloaded.url.initUrlSync();
    expect(reloaded.url.compareBaseline.value).toEqual({ count: true, rate: false });
    // Use the current reloaded stub because the global window now points there.
    reloaded.win.location.search = '?u=rate';
    reloaded.win._popstate!();
    expect(reloaded.url.compareBaseline.value).toEqual({ count: false, rate: true });
    expect(win.location.search).toContain('cb=10');
  });

  it('ignores malformed baseline state', async () => {
    const { url } = await fresh('?cb=12');
    url.initUrlSync();
    expect(url.compareBaseline.value).toEqual({ count: false, rate: true });
  });

  it('retains explicit defaults in complete links created before cb existed', async () => {
    const { url, win } = await fresh('?u=count&p=as&c=as,at,be,ro,to&y=2016-2025&ytd=0&cmp=87,73,143');
    win.localStorage.getItem = () => JSON.stringify({ unit: 'rate' });
    url.initUrlSync();
    expect(win.location.search).toContain('u=count');
    expect(win.location.search).toContain('cb=01');
  });
});
