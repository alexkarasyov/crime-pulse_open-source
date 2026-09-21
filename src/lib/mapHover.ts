// Shared hover state for the choropleth. Lives in lib/ (not in TorontoMap.tsx)
// so it's reliably hoisted into one shared chunk across the separately-hydrated
// TorontoMap and MapSidebar/TorontoMapPanel islands — the same way lib/state.ts
// signals are shared. (A component-local signal can end up duplicated per island
// bundle, which silently breaks the hover→panel sync.)

import { signal } from '@preact/signals';

export interface MapHoverInfo {
  id: string;
  name: string;
  population: number;
  /** The series the map currently shades by — total rate per 10k by year. */
  series: { year: number; rate: number; count: number }[];
}

export const mapHover = signal<MapHoverInfo | null>(null);
