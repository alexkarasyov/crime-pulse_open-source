// Preact mirror of src/components/CatGlyph.astro.
// Visual contract identical — same SVG primitives, same sizes.
// Used inside Preact islands where Astro components can't render.

import { CAT_BY_ID, type Category, type CategoryId } from '../../lib/categories';

interface Props {
  cat: CategoryId | Category;
  size?: number;
  filled?: boolean;
  stroke?: string;
}

export default function CatGlyph({
  cat,
  size = 12,
  filled = true,
  stroke,
}: Props) {
  const c = typeof cat === 'string' ? CAT_BY_ID[cat] : cat;
  if (!c) return null;
  const color = stroke ?? c.color;
  const w = size;
  const h = size;
  const s = w - 2;
  const cx = w / 2;
  const cy = h / 2;
  const fill = filled ? color : 'none';
  const sw = filled ? 0 : 1.5;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
      style={{ display: 'inline-block' }}
    >
      {c.glyph === 'diamond' && (
        <polygon
          points={`${cx},1 ${w - 1},${cy} ${cx},${h - 1} 1,${cy}`}
          fill={fill}
          stroke={color}
          stroke-width={sw}
        />
      )}
      {c.glyph === 'square' && (
        <rect x={1} y={1} width={s} height={s} fill={fill} stroke={color} stroke-width={sw} />
      )}
      {c.glyph === 'triangle' && (
        <polygon
          points={`${cx},1 ${w - 1},${h - 1} 1,${h - 1}`}
          fill={fill}
          stroke={color}
          stroke-width={sw}
        />
      )}
      {c.glyph === 'circle' && (
        <circle cx={cx} cy={cy} r={cy - 1} fill={fill} stroke={color} stroke-width={sw} />
      )}
      {c.glyph === 'cross' && (
        <g stroke={color} stroke-width={2} stroke-linecap="square">
          <line x1={2} y1={2} x2={w - 2} y2={h - 2} />
          <line x1={w - 2} y1={2} x2={2} y2={h - 2} />
        </g>
      )}
    </svg>
  );
}
