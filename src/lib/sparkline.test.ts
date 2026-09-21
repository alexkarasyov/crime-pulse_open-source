// Unit tests for the pure sparkline path generators.
import { describe, expect, it } from 'vitest';
import { sparkPaths, sparkValueOf } from './sparkline';

const W = 100;
const H = 40;
const PAD_Y = 4; // must match sparkline.ts

describe('sparkValueOf', () => {
  it('passes numbers through', () => {
    expect(sparkValueOf(7)).toBe(7);
  });

  it('prefers rate over count, falls back to count, then 0', () => {
    expect(sparkValueOf({ rate: 3, count: 9 })).toBe(3);
    expect(sparkValueOf({ count: 9 })).toBe(9);
    expect(sparkValueOf({})).toBe(0);
  });
});

describe('sparkPaths', () => {
  it('returns empty paths for empty input', () => {
    expect(sparkPaths([], W, H)).toEqual({ path: '', areaPath: '', points: [] });
  });

  it('handles a single point without dividing by zero', () => {
    const { path, points } = sparkPaths([5], W, H);
    expect(points).toEqual([[0, H - PAD_Y]]);
    expect(path).toBe(`M0,${H - PAD_Y}`);
  });

  it('pins min to the bottom pad and max to the top pad', () => {
    const { points } = sparkPaths([0, 10], W, H);
    expect(points[0]).toEqual([0, H - PAD_Y]); // min
    expect(points[1]).toEqual([W, PAD_Y]); // max
  });

  it('renders a flat series along the bottom pad line (span guard)', () => {
    const { points } = sparkPaths([5, 5, 5], W, H);
    for (const [, y] of points) expect(y).toBe(H - PAD_Y);
  });

  it('spaces points evenly across the width', () => {
    const { points } = sparkPaths([1, 2, 3, 4, 5], W, H);
    expect(points.map(([x]) => x)).toEqual([0, 25, 50, 75, 100]);
  });

  it('maps higher values to smaller y (SVG up)', () => {
    const { points } = sparkPaths([1, 3, 2], W, H);
    const ys = points.map(([, y]) => y);
    expect(ys[1]).toBeLessThan(ys[0]!);
    expect(ys[1]).toBeLessThan(ys[2]!);
  });

  it('builds a move-then-line path and a closed area path', () => {
    const { path, areaPath } = sparkPaths([1, 2], W, H);
    expect(path).toMatch(/^M[\d.]+,[\d.]+ L[\d.]+,[\d.]+$/);
    expect(areaPath).toBe(`${path} L${W},${H} L0,${H} Z`);
  });

  it('accepts point objects (rate preferred) identically to raw numbers', () => {
    const fromObjects = sparkPaths(
      [{ rate: 1, count: 100 }, { rate: 2, count: 50 }],
      W,
      H,
    );
    const fromNumbers = sparkPaths([1, 2], W, H);
    expect(fromObjects).toEqual(fromNumbers);
  });
});
