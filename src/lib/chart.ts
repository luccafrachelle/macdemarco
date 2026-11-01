/* Tiny helpers for the build-time SVG charts. */

const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

/**
 * A 0-based scale with at most 4 gridlines (0 included): the smallest nice
 * step that covers `max` in 3 steps or fewer.
 */
export function niceTicks(max: number): { max: number; ticks: number[] } {
  if (max <= 0) return { max: 1, ticks: [0, 1] };
  const step = STEPS.find((s) => Math.ceil(max / s) <= 3) ?? Math.ceil(max / 3);
  const n = Math.ceil(max / step);
  return { max: n * step, ticks: Array.from({ length: n + 1 }, (_, i) => i * step) };
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

/** Bar with rounded top corners (data end) and a square baseline. */
export function barPath(x: number, y: number, w: number, h: number, radius: number): string {
  if (h <= 0 || w <= 0) return '';
  const r = Math.min(radius, h, w / 2);
  const [X, Y, R, X2, B] = [x, y, r, x + w, y + h].map(r2);
  if (r <= 0) return `M${X} ${B}V${Y}H${X2}V${B}Z`;
  return `M${X} ${B}V${r2(y + r)}A${R} ${R} 0 0 1 ${r2(x + r)} ${Y}H${r2(x + w - r)}A${R} ${R} 0 0 1 ${X2} ${r2(y + r)}V${B}Z`;
}

export type Segment = { index: number; value: number; y: number; h: number; top: boolean };

/** Stacks values bottom-up from `baseline` (px per unit `k`) with `gap` px between fills. */
export function stack(values: number[], baseline: number, k: number, gap: number): Segment[] {
  const out: Segment[] = [];
  let bottom = baseline;
  values.forEach((value, index) => {
    if (value <= 0) return;
    if (out.length) bottom -= gap;
    const h = value * k;
    out.push({ index, value, y: bottom - h, h, top: false });
    bottom -= h;
  });
  if (out.length) out[out.length - 1].top = true;
  return out;
}
