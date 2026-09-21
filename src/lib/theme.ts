// Dark / light theme state. Dark is the default (dark-first product).
//
// Source of truth for CSS is `data-theme` on <html>, set before first paint by
// the no-FOUC inline script in Base.astro (reads localStorage). This module
// mirrors that into a Preact signal so islands that bake CSS-var values into
// non-CSS sinks — the Leaflet map, which writes colours into SVG presentation
// attributes where var() is invalid — can re-read and re-apply on toggle.
//
// Everything else (all CSS, inline var() styles, SVG charts using currentColor/
// var) re-themes automatically when the attribute flips; only the map needs the
// signal. See redesign THEMING.md.

import { signal } from '@preact/signals';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'cp_theme';

/** Default on both server and client so island hydration never mismatches;
 * synced to the real DOM value post-mount via initTheme(). */
export const theme = signal<Theme>('dark');

function domTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

/** Sync the signal to whatever the no-FOUC script already painted. Idempotent;
 * call from an island effect (post-mount). Without this, a persisted "light"
 * load would leave the signal on "dark" and the first toggle would no-op. */
export function initTheme(): void {
  if (typeof document === 'undefined') return;
  const t = domTheme();
  if (theme.value !== t) theme.value = t;
}

/** Fired on every theme change. The map listens for this — a global DOM event
 * reliably crosses island/bundle boundaries, where a shared module signal is
 * not guaranteed to (a client:only island can hold a separate module instance
 * from a client:load one). */
export const THEME_CHANGE_EVENT = 'cp-theme-change';

export function setTheme(next: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // private mode / quota — the attribute still applies for this session.
  }
  theme.value = next;
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: next }));
}

/** Flip dark ⇄ light. Reads the live DOM value so it's correct even if the
 * signal hasn't been synced yet. */
export function toggleTheme(): void {
  setTheme(domTheme() === 'light' ? 'dark' : 'light');
}

/** The 6-step choropleth ramp for the current theme, resolved from CSS
 * (--ramp-0..5). Used by the map, which can't reference var() in Leaflet
 * presentation attributes. */
export function getRamp(): string[] {
  if (typeof document === 'undefined') return [];
  const cs = getComputedStyle(document.documentElement);
  return [0, 1, 2, 3, 4, 5].map((i) => cs.getPropertyValue(`--ramp-${i}`).trim());
}
