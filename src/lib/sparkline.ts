// Pure path-generation helpers for the sparkline + trend SVGs.
// Shared between the Astro `Sparkline.astro` component and the Preact
// island equivalent — keep visual output identical regardless of caller.

export type SparkPoint = number | { rate?: number; count?: number };

export function sparkValueOf(p: SparkPoint): number {
  if (typeof p === 'number') return p;
  return p.rate ?? p.count ?? 0;
}

export interface SparkPaths {
  path: string;
  areaPath: string;
  points: Array<[number, number]>;
}

/**
 * Generate the line + area paths and point list for a Sparkline.
 * Visual contract matches `styleguide/components.jsx`'s Sparkline exactly.
 */
export function sparkPaths(
  data: readonly SparkPoint[],
  width: number,
  height: number,
): SparkPaths {
  if (!data || data.length === 0) {
    return { path: '', areaPath: '', points: [] };
  }
  const vals = data.map(sparkValueOf);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const padY = 4;
  const span = max - min || 1;
  const stepX = width / (data.length - 1 || 1);
  const points: Array<[number, number]> = vals.map((v, i) => {
    const x = i * stepX;
    const y = height - padY - ((v - min) / span) * (height - 2 * padY);
    return [x, y];
  });
  const path = points
    .map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`))
    .join(' ');
  const areaPath = `${path} L${width},${height} L0,${height} Z`;
  return { path, areaPath, points };
}
