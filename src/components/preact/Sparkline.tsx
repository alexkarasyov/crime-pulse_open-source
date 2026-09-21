// Preact mirror of src/components/Sparkline.astro.
// Uses the same path-generation helper as the Astro version so they render
// identically on both sides of the static/island boundary.

import { sparkPaths, type SparkPoint } from '../../lib/sparkline';

interface Props {
  data: readonly SparkPoint[];
  color?: string;
  height?: number;
  width?: number;
  fill?: boolean;
  showDots?: boolean;
  accent?: boolean;
  class?: string;
}

export default function Sparkline({
  data,
  color = 'currentColor',
  height = 36,
  width = 200,
  fill = false,
  showDots = false,
  accent = false,
  class: className = '',
}: Props) {
  const hasData = Array.isArray(data) && data.length > 0;
  const { path, areaPath, points } = sparkPaths(data, width, height);
  const last = points[points.length - 1];
  return (
    <svg
      class={`sparkline ${className}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      width={width}
      height={height}
    >
      {hasData && fill && <path d={areaPath} fill={color} opacity="0.12" />}
      {hasData && (
        <path
          d={path}
          fill="none"
          stroke={color}
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      )}
      {hasData &&
        showDots &&
        points.map((p) => (
          <circle cx={p[0]} cy={p[1]} r="2.5" fill="var(--bg)" stroke={color} stroke-width="1.5" />
        ))}
      {hasData && accent && last && (
        <circle cx={last[0]} cy={last[1]} r="3" fill={color} />
      )}
    </svg>
  );
}
