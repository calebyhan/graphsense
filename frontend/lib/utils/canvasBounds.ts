const BOUNDS_PADDING = 200;
const BOUNDS_MIN_HALF = 1500;

interface ElementBounds {
  position: { x: number; y: number };
  size: { width: number; height: number };
}

/**
 * Computes a symmetric canvas size around the world origin (0,0).
 * Returns { width, height } where each dimension = 2 * halfExtent.
 * halfExtent = max(MIN_HALF, maxAbsExtentFromOrigin + PADDING).
 *
 * Uses reduce instead of spread+Math.max to avoid call stack overflow
 * with large element counts.
 */
export function computeCanvasBounds(elements: ElementBounds[]): { width: number; height: number } {
  if (elements.length === 0) {
    return { width: BOUNDS_MIN_HALF * 2, height: BOUNDS_MIN_HALF * 2 };
  }

  let maxAbsX = 0;
  let maxAbsY = 0;
  for (const el of elements) {
    const left = Math.abs(el.position.x);
    const right = Math.abs(el.position.x + el.size.width);
    const top = Math.abs(el.position.y);
    const bottom = Math.abs(el.position.y + el.size.height);
    if (left > maxAbsX) maxAbsX = left;
    if (right > maxAbsX) maxAbsX = right;
    if (top > maxAbsY) maxAbsY = top;
    if (bottom > maxAbsY) maxAbsY = bottom;
  }

  const halfW = Math.ceil(Math.max(BOUNDS_MIN_HALF, maxAbsX + BOUNDS_PADDING));
  const halfH = Math.ceil(Math.max(BOUNDS_MIN_HALF, maxAbsY + BOUNDS_PADDING));
  return { width: halfW * 2, height: halfH * 2 };
}
