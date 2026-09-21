// Client-safe JSON fetcher shared by every island that loads aggregates.
// (src/lib/aggregates.ts imports node:fs and is therefore server-only.)
//
// - Rejects on non-2xx responses instead of letting r.json() throw a
//   SyntaxError on an HTML 404 page.
// - Caches the in-flight promise per URL, so e.g. TorontoMap and MapSidebar
//   on the same page share one request for by-neighbourhood-year.json.
// - A failed fetch is evicted from the cache so a retry is possible.

const cache = new Map<string, Promise<unknown>>();

export function fetchJson<T>(url: string): Promise<T> {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return r.json() as Promise<unknown>;
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p as Promise<T>;
}
