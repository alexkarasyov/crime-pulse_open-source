// fetchJson — the client-side JSON loader every island shares. The contract
// under test: one in-flight promise per URL (deduped fetches), non-2xx
// rejection with a useful message, and eviction-on-failure so a retry can
// succeed after a transient error.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchJson } from './fetchJson';

// The module-level cache persists across tests in one file; use a unique URL
// per test so cases stay independent.
let n = 0;
function freshUrl(): string {
  n += 1;
  return `/data/test-${n}.json`;
}

function okResponse(body: unknown): Partial<Response> {
  return { ok: true, status: 200, json: () => Promise.resolve(body) };
}

function errResponse(status: number): Partial<Response> {
  return {
    ok: false,
    status,
    json: () => Promise.reject(new SyntaxError('not json')),
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const mockFetch = () => globalThis.fetch as ReturnType<typeof vi.fn>;

describe('fetchJson', () => {
  it('resolves parsed JSON on a 2xx response', async () => {
    const url = freshUrl();
    mockFetch().mockResolvedValue(okResponse({ hello: 'world' }));
    await expect(fetchJson(url)).resolves.toEqual({ hello: 'world' });
  });

  it('dedupes concurrent requests for the same URL into one fetch', async () => {
    const url = freshUrl();
    mockFetch().mockResolvedValue(okResponse({ v: 1 }));
    const [a, b] = await Promise.all([fetchJson(url), fetchJson(url)]);
    expect(a).toEqual({ v: 1 });
    expect(b).toEqual({ v: 1 });
    expect(mockFetch()).toHaveBeenCalledTimes(1);
  });

  it('serves later calls from the cache without refetching', async () => {
    const url = freshUrl();
    mockFetch().mockResolvedValue(okResponse({ v: 2 }));
    await fetchJson(url);
    await fetchJson(url);
    expect(mockFetch()).toHaveBeenCalledTimes(1);
  });

  it('rejects with url + status on a non-2xx response instead of parsing', async () => {
    const url = freshUrl();
    mockFetch().mockResolvedValue(errResponse(404));
    await expect(fetchJson(url)).rejects.toThrow(`${url}: HTTP 404`);
  });

  it('evicts a failed request so a retry can succeed', async () => {
    const url = freshUrl();
    mockFetch()
      .mockResolvedValueOnce(errResponse(500))
      .mockResolvedValueOnce(okResponse({ recovered: true }));
    await expect(fetchJson(url)).rejects.toThrow('HTTP 500');
    // Eviction happens in a .catch() attached to the same promise — let the
    // microtask queue drain before retrying.
    await Promise.resolve();
    await expect(fetchJson(url)).resolves.toEqual({ recovered: true });
    expect(mockFetch()).toHaveBeenCalledTimes(2);
  });

  it('evicts on network failure (fetch itself rejects)', async () => {
    const url = freshUrl();
    mockFetch()
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValueOnce(okResponse({ back: 'up' }));
    await expect(fetchJson(url)).rejects.toThrow('network down');
    await Promise.resolve();
    await expect(fetchJson(url)).resolves.toEqual({ back: 'up' });
  });

  it('does not share cache entries across different URLs', async () => {
    const urlA = freshUrl();
    const urlB = freshUrl();
    mockFetch()
      .mockResolvedValueOnce(okResponse({ which: 'a' }))
      .mockResolvedValueOnce(okResponse({ which: 'b' }));
    await expect(fetchJson(urlA)).resolves.toEqual({ which: 'a' });
    await expect(fetchJson(urlB)).resolves.toEqual({ which: 'b' });
    expect(mockFetch()).toHaveBeenCalledTimes(2);
  });
});
