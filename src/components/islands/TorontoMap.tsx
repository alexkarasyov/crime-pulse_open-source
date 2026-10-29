// Real Leaflet choropleth — replaces the hex cartogram.
// Loads /data/geo/toronto-neighbourhoods-158.geojson plus
// /data/aggregates/by-neighbourhood-year.json at hydration time,
// then renders 158 polygons over CartoDB Dark Matter tiles.
//
// Shading: single-hue sequential ramp keyed to the active category's
// CSS variable. The brief specifies dark mode; CartoDB Dark Matter is
// the named reference tile set.
//
// Click → navigate to /neighbourhood/{id}.
// Hover → update an external tooltip panel (a sibling Preact island
// renders the panel by reading from `mapHover` in lib/state.ts).
//
// Notes:
// - leaflet imports are dynamic so the JS only loads when this island
//   hydrates (about 38 kB gzipped — kept off the critical path).
// - Leaflet's CSS is self-hosted (/leaflet-1.9.4.css) and injected via a
//   <link> at runtime (see ensureLeafletCss) — no third-party CDN request,
//   and only map-bearing pages pay for the ~14 kB of map CSS.

import { useEffect, useRef, useState } from 'preact/hooks';
import { primaryCat, unit, showYoyArrows, yearRange } from '../../lib/state';
import { catValueAt, guardedChange } from '../../lib/format';
import { fetchJson } from '../../lib/fetchJson';
import { escapeHtml } from '../../lib/html';
import { type RawByNeighbourhoodYear, asByNeighbourhoodYear } from '../../lib/aggregateTypes';
import { THEME_CHANGE_EVENT } from '../../lib/theme';
// Hover signal lives in lib/ so it reliably shares across separately-hydrated
// islands (TorontoMap + MapSidebar) — required for client:visible lazy-mount.
import { mapHover } from '../../lib/mapHover';

type GeoJSON = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: { id: string; name: string };
    geometry: unknown;
  }>;
};

interface Props {
  selectedId?: string;
  /** When true, hover is silenced (used by the Neighbourhood mini map). */
  silentHover?: boolean;
}

function ensureLeafletCss(): void {
  if (typeof document === 'undefined') return;
  if (document.querySelector('link[data-leaflet-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  // Self-hosted (was unpkg CDN) so the map still styles if the CDN is
  // down and so no third-party request leaks visitor IPs. Bump the
  // filename if leaflet is upgraded; keep it in sync with package.json.
  link.href = '/leaflet-1.9.4.css';
  link.setAttribute('data-leaflet-css', '');
  document.head.appendChild(link);
}

export default function TorontoMap({ selectedId, silentHover = false }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<unknown>(null);
  const layerRef = useRef<unknown>(null);
  const arrowLayerRef = useRef<unknown>(null);
  const baseTileRef = useRef<unknown>(null);
  const labelTileRef = useRef<unknown>(null);
  const didFitRef = useRef(false);
  const [geo, setGeo] = useState<GeoJSON | null>(null);
  const [agg, setAgg] = useState<RawByNeighbourhoodYear | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Bumped on every dark/light toggle so the style effect re-runs and re-reads
  // the choropleth colours from CSS (Leaflet bakes resolved hex/oklch into SVG
  // presentation attributes, which don't follow a var() theme swap). THEMING §4.
  const [themeVersion, setThemeVersion] = useState(0);
  useEffect(() => {
    const onThemeChange = () => setThemeVersion((v) => v + 1);
    window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
  }, []);

  // Load geojson + aggregate once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [g, a] = await Promise.all([
          fetchJson<GeoJSON>('/data/geo/toronto-neighbourhoods-158.geojson'),
          fetchJson<unknown>('/data/aggregates/by-neighbourhood-year.json'),
        ]);
        if (!cancelled) {
          setGeo(g);
          setAgg(asByNeighbourhoodYear(a));
        }
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Once leaflet + data are ready, render the map.
  useEffect(() => {
    if (!geo || !agg || !mapRef.current) return;
    let cancelled = false;
    ensureLeafletCss();
    (async () => {
      const L = await import('leaflet');
      if (cancelled || !mapRef.current) return;
      // Create map only on first run.
      if (!leafletMapRef.current) {
        // Toronto roughly: 43.7,-79.4. Bounds keep us pinned to the city.
        const map = L.map(mapRef.current, {
          zoomControl: false,
          attributionControl: true,
          scrollWheelZoom: false,
          dragging: !silentHover,
          touchZoom: !silentHover,
          doubleClickZoom: !silentHover,
          minZoom: 9,
          maxZoom: 14,
        }).setView([43.72, -79.38], 10);

        L.control.zoom({ position: 'topright' }).addTo(map);
        // CartoDB basemap. The light/dark variant follows the app theme — set
        // below (and updated on theme change) so the basemap doesn't stay dark
        // in light mode. We keep refs to swap the tile URL on toggle.
        baseTileRef.current = L.tileLayer(
          'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19,
          },
        ).addTo(map);
        labelTileRef.current = L.tileLayer(
          'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
          {
            subdomains: 'abcd',
            maxZoom: 19,
            pane: 'shadowPane',
          },
        ).addTo(map);
        leafletMapRef.current = map;
      }

      // Theme the basemap tiles (dark ↔ light CartoDB variants). Runs on first
      // build and again whenever the effect re-runs for a theme change.
      const isLight = document.documentElement.dataset.theme === 'light';
      const baseVariant = isLight ? 'light_nolabels' : 'dark_nolabels';
      const labelVariant = isLight ? 'light_only_labels' : 'dark_only_labels';
      (baseTileRef.current as L.TileLayer | null)?.setUrl(
        `https://{s}.basemaps.cartocdn.com/${baseVariant}/{z}/{x}/{y}{r}.png`,
      );
      (labelTileRef.current as L.TileLayer | null)?.setUrl(
        `https://{s}.basemaps.cartocdn.com/${labelVariant}/{z}/{x}/{y}{r}.png`,
      );
      // Always re-build the choropleth layer when data/cat/unit changes.
      // The map is primary-category-only: shading value AND hue both come
      // from primaryCat, so the heading, legend, hover panel, and polygons
      // all describe the same single category. The view rail's multi-select
      // (activeCats) drives the hero/trend aggregates, not the map.
      const cat = primaryCat.value;
      const u = unit.value;
      // Leaflet writes path options into SVG presentation attributes, where
      // CSS var() is invalid and silently dropped — resolve tokens to literals.
      // Read fresh each run (the effect re-runs on theme change, see deps) so
      // map colours follow the active dark/light theme. (THEMING.md §4)
      const rootStyle = getComputedStyle(document.documentElement);
      const tok = (name: string, fallback: string) =>
        rootStyle.getPropertyValue(name).trim() || fallback;
      const catColor = tok(`--cat-${cat}`, '#888');
      const accentColor = tok('--accent', '#4893f2');
      const borderColor = tok('--border', '#3a434c'); // default polygon stroke
      const hoverColor = tok('--ink', '#f2f5f9'); // hover stroke
      const trendUpColor = tok('--trend-up', '#ffa460');
      const trendDownColor = tok('--trend-down', '#68d6ab');
      const trendFlatColor = tok('--trend-flat', '#8d929b');

      // The choropleth follows the end of the selected full-year window.
      const latestYear = yearRange.value[1];

      // Compute min/max of the primary category's values at the latest year.
      const vals: number[] = [];
      for (const nbhd of Object.values(agg.neighbourhoods)) {
        vals.push(catValueAt(nbhd.series, cat, latestYear, u));
      }
      const vmin = Math.min(...vals);
      const vmax = Math.max(...vals);
      const span = vmax - vmin || 1;

      const map = leafletMapRef.current as L.Map;
      // Remove the previous layer.
      if (layerRef.current) {
        map.removeLayer(layerRef.current as L.Layer);
      }

      const layer = L.geoJSON(geo as any, {
        style: (feature) => {
          const id = (feature as any).properties.id as string;
          const nbhd = agg.neighbourhoods[id];
          let opacity = 0.08;
          if (nbhd) {
            const v = catValueAt(nbhd.series, cat, latestYear, u);
            const t = (v - vmin) / span;
            opacity = 0.12 + t * 0.78;
          }
          const isSelected = id === selectedId;
          return {
            fillColor: catColor,
            fillOpacity: opacity,
            color: isSelected ? accentColor : borderColor,
            weight: isSelected ? 2.5 : 0.6,
            opacity: isSelected ? 1 : 0.7,
          };
        },
        onEachFeature: (feature, lyr) => {
          const props = (feature as any).properties as { id: string; name: string };
          lyr.on({
            mouseover: (e) => {
              if (silentHover) return;
              const target = e.target as L.Path;
              target.setStyle({ weight: 2, color: hoverColor, fillOpacity: Math.min(1, (target.options.fillOpacity ?? 0.4) + 0.12) });
              target.bringToFront();
              const nbhd = agg.neighbourhoods[props.id];
              if (nbhd) {
                mapHover.value = {
                  id: nbhd.id,
                  name: nbhd.name,
                  population: nbhd.population,
                  // Drop the partial (YTD) year — its rate_per_10k is null
                  // and would render as NaN / a mislabelled "latest" point.
                  series: nbhd.series[cat]
                    .filter((p) => !p.partial)
                    .map((p) => ({
                      year: p.year,
                      rate: p.rate_per_10k ?? 0,
                      count: p.count,
                    })),
                };
              }
            },
            mouseout: (e) => {
              if (silentHover) return;
              layer.resetStyle(e.target as L.Path);
              mapHover.value = null;
            },
            click: () => {
              if (typeof window !== 'undefined') {
                window.location.href = `/neighbourhood/${props.id}/`;
              }
            },
          });
          lyr.bindTooltip(escapeHtml(props.name ?? ''), {
            sticky: true,
            direction: 'top',
            className: 'leaflet-cp-tooltip',
            opacity: 0.9,
          });
        },
      }).addTo(map);
      layerRef.current = layer;
      // Tight bounds — first time only, so re-styling on a category/unit/year
      // change doesn't yank the user's pan/zoom back to the city extent.
      if (!didFitRef.current) {
        try {
          const b = layer.getBounds();
          if (b.isValid()) {
            map.fitBounds(b, { padding: [12, 12], maxZoom: 11 });
            didFitRef.current = true;
          }
        } catch {
          // ignore
        }
      }

      // Rebuild the YoY arrow overlay layer (P1.8d). Small ▲ ▼ — at each
      // polygon's bounds centre, coloured by YoY direction. Hidden when
      // showYoyArrows is off.
      if (arrowLayerRef.current) {
        map.removeLayer(arrowLayerRef.current as L.Layer);
        arrowLayerRef.current = null;
      }
      if (showYoyArrows.value) {
        const arrowGroup = L.layerGroup();
        layer.eachLayer((featLayer: L.Layer) => {
          const f = (featLayer as L.Polygon).feature as { properties: { id: string } } | undefined;
          if (!f) return;
          const props = f.properties;
          const nbhd = agg.neighbourhoods[props.id];
          if (!nbhd) return;
          // YoY arrow direction follows the primary category, matching the
          // shading value so an arrow never contradicts the polygon under it.
          const lastV = catValueAt(nbhd.series, cat, latestYear, 'count');
          const prevV = catValueAt(nbhd.series, cat, latestYear - 1, 'count');
          if (!lastV && !prevV) return;
          const t = guardedChange(prevV, lastV).trend;
          const arrowColor =
            t.dir === 'up'   ? trendUpColor
            : t.dir === 'down' ? trendDownColor
            : trendFlatColor;
          const bounds = (featLayer as L.Polygon).getBounds();
          if (!bounds.isValid()) return;
          const center = bounds.getCenter();
          const icon = L.divIcon({
            className: 'leaflet-yoy-arrow',
            html: `<span style="color:${arrowColor};font-family:var(--font-mono);font-size:12px;line-height:1;text-shadow:0 1px 2px rgba(0,0,0,0.6);font-weight:600;pointer-events:none;">${t.glyph}</span>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });
          L.marker(center, { icon, interactive: false, keyboard: false }).addTo(arrowGroup);
        });
        arrowGroup.addTo(map);
        arrowLayerRef.current = arrowGroup;
      }
    })();
    return () => {
      cancelled = true;
    };
    // The effect re-runs when any of these change because they're listed in
    // the deps array below (their `.value` is read during the tracked render,
    // not via effect-time tracking — signal reads inside an effect callback
    // are NOT auto-tracked, so the explicit deps are load-bearing).
  }, [geo, agg, primaryCat.value, unit.value, showYoyArrows.value, yearRange.value, themeVersion, selectedId, silentHover]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      const map = leafletMapRef.current as L.Map | null;
      if (map) map.remove();
      leafletMapRef.current = null;
      layerRef.current = null;
      arrowLayerRef.current = null;
      baseTileRef.current = null;
      labelTileRef.current = null;
    };
  }, []);

  if (err) {
    return (
      <div style="padding: 24px; color: var(--ink-3); font-family: var(--font-mono); font-size: 12px;">
        Map data failed to load: {err}
      </div>
    );
  }

  return (
    <div
      ref={mapRef as any}
      class="toronto-map"
      role="region"
      aria-label="Toronto neighbourhoods choropleth map. Pointer-based; for a keyboard-accessible list of all neighbourhoods, use the neighbourhood index."
      style={{
        width: '100%',
        height: '100%',
        minHeight: '460px',
        background: 'var(--surface-2)',
        borderRadius: 'var(--r-2)',
      }}
    />
  );
}
