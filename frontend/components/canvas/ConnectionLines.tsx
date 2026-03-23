'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useCanvasStore, CanvasElement } from '@/store/useCanvasStore';

type Side = 'top' | 'bottom' | 'left' | 'right';
type Point = { x: number; y: number };

/** Pick the face of `el` that is closest to the other element's center. */
function getBestSide(el: CanvasElement, other: CanvasElement): Side {
  const cx = el.position.x + el.size.width / 2;
  const cy = el.position.y + el.size.height / 2;
  const ocx = other.position.x + other.size.width / 2;
  const ocy = other.position.y + other.size.height / 2;
  const dx = ocx - cx;
  const dy = ocy - cy;
  return Math.abs(dx) >= Math.abs(dy)
    ? dx >= 0 ? 'right' : 'left'
    : dy >= 0 ? 'bottom' : 'top';
}

/** Center point on the given face of `el`. */
function getSidePoint(el: CanvasElement, side: Side): Point {
  const { x, y } = el.position;
  const { width, height } = el.size;
  switch (side) {
    case 'top':    return { x: x + width / 2, y };
    case 'bottom': return { x: x + width / 2, y: y + height };
    case 'left':   return { x,                y: y + height / 2 };
    case 'right':  return { x: x + width,     y: y + height / 2 };
  }
}

const OPPOSITE: Record<Side, Side> = { right: 'left', left: 'right', top: 'bottom', bottom: 'top' };
// Minimum world-space clearance (px at zoom=1) between a U-bend and the element face it exits from
const U_GAP = 40;

interface ConnInfo {
  id: string;
  d: string;
  /** World-space position of the draggable elbow handle (null for L-shapes). */
  handlePoint: Point | null;
  /** Which axis the handle can be dragged along. */
  dragAxis: 'x' | 'y' | null;
}

/**
 * Compute path + handle info for a single connection.
 * `elbowOffset` is added to the auto-computed elbow position (world units).
 */
function computeConnInfo(
  id: string,
  p1: Point, side1: Side,
  p2: Point, side2: Side,
  elbowOffset: number,
): ConnInfo {
  const horizontal = side1 === 'left' || side1 === 'right';

  if (side2 === OPPOSITE[side1]) {
    // Opposite faces → Z-shape (horizontal) or S-shape (vertical)
    if (horizontal) {
      const mx = (p1.x + p2.x) / 2 + elbowOffset;
      return {
        id,
        d: `M${p1.x},${p1.y} L${mx},${p1.y} L${mx},${p2.y} L${p2.x},${p2.y}`,
        handlePoint: { x: mx, y: (p1.y + p2.y) / 2 },
        dragAxis: 'x',
      };
    } else {
      const my = (p1.y + p2.y) / 2 + elbowOffset;
      return {
        id,
        d: `M${p1.x},${p1.y} L${p1.x},${my} L${p2.x},${my} L${p2.x},${p2.y}`,
        handlePoint: { x: (p1.x + p2.x) / 2, y: my },
        dragAxis: 'y',
      };
    }
  }

  if (side1 === side2) {
    // Same face → U-shape
    if (side1 === 'right') {
      const fx = Math.max(p1.x, p2.x) + U_GAP + elbowOffset;
      return { id, d: `M${p1.x},${p1.y} L${fx},${p1.y} L${fx},${p2.y} L${p2.x},${p2.y}`, handlePoint: { x: fx, y: (p1.y + p2.y) / 2 }, dragAxis: 'x' };
    }
    if (side1 === 'left') {
      const fx = Math.min(p1.x, p2.x) - U_GAP + elbowOffset;
      return { id, d: `M${p1.x},${p1.y} L${fx},${p1.y} L${fx},${p2.y} L${p2.x},${p2.y}`, handlePoint: { x: fx, y: (p1.y + p2.y) / 2 }, dragAxis: 'x' };
    }
    if (side1 === 'bottom') {
      const fy = Math.max(p1.y, p2.y) + U_GAP + elbowOffset;
      return { id, d: `M${p1.x},${p1.y} L${p1.x},${fy} L${p2.x},${fy} L${p2.x},${p2.y}`, handlePoint: { x: (p1.x + p2.x) / 2, y: fy }, dragAxis: 'y' };
    }
    // top
    const fy = Math.min(p1.y, p2.y) - U_GAP + elbowOffset;
    return { id, d: `M${p1.x},${p1.y} L${p1.x},${fy} L${p2.x},${fy} L${p2.x},${p2.y}`, handlePoint: { x: (p1.x + p2.x) / 2, y: fy }, dragAxis: 'y' };
  }

  // Perpendicular faces → L-shape (single bend, not draggable)
  if (horizontal) {
    return { id, d: `M${p1.x},${p1.y} L${p2.x},${p1.y} L${p2.x},${p2.y}`, handlePoint: null, dragAxis: null };
  } else {
    return { id, d: `M${p1.x},${p1.y} L${p1.x},${p2.y} L${p2.x},${p2.y}`, handlePoint: null, dragAxis: null };
  }
}

interface DragState {
  connId: string;
  startClientX: number;
  startClientY: number;
  startOffset: number;
  axis: 'x' | 'y';
}

interface ConnectionLinesProps {
  canvasWidth: number;
  canvasHeight: number;
}

export default function ConnectionLines({ canvasWidth, canvasHeight }: ConnectionLinesProps) {
  const canvasElements = useCanvasStore((s) => s.canvasElements);
  const zoom = useCanvasStore((s) => s.viewport.zoom);

  // elbow offset per connection id (world-space units, added to auto position)
  const [elbowOffsets, setElbowOffsets] = useState<Record<string, number>>({});
  const [selectedConn, setSelectedConn] = useState<string | null>(null);
  const [hoveredConn, setHoveredConn] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  // Keep zoom in a ref so the window-level listener always reads the latest value
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Window-level pointermove/pointerup so dragging works even when the mouse
  // leaves the handle circle or the SVG entirely.
  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const deltaScreen =
        drag.axis === 'x'
          ? e.clientX - drag.startClientX
          : e.clientY - drag.startClientY;
      setElbowOffsets((prev) => ({
        ...prev,
        [drag.connId]: drag.startOffset + deltaScreen / zoomRef.current,
      }));
    };

    const onUp = () => {
      dragRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    // pointercancel fires on mobile when the OS interrupts (e.g. incoming call).
    // Without it the drag state gets stuck and the canvas stops responding.
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [isDragging]);

  // Click-outside deselect: listen on window, ignore events inside SVG elements
  // of this component (they call stopPropagation on pointerdown).
  useEffect(() => {
    if (!selectedConn || isDragging) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target instanceof SVGElement)) setSelectedConn(null);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [selectedConn, isDragging]);

  const handleHitPointerDown = useCallback(
    (e: React.PointerEvent<SVGPathElement>, connId: string) => {
      e.stopPropagation();
      e.preventDefault();
      setSelectedConn(connId);
      setHoveredConn(connId);
    },
    [],
  );

  const handleHandlePointerDown = useCallback(
    (e: React.PointerEvent<SVGCircleElement>, connId: string, axis: 'x' | 'y') => {
      e.stopPropagation();
      e.preventDefault();
      setSelectedConn(connId);
      setIsDragging(true);
      dragRef.current = {
        connId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startOffset: elbowOffsets[connId] ?? 0,
        axis,
      };
    },
    [elbowOffsets],
  );

  // Build a lookup: datasetId → dataset canvas element
  // Guard on position/size: a malformed remote element would crash getBestSide
  const datasetMap = new Map<string, CanvasElement>();
  for (const el of canvasElements) {
    if (el.type === 'dataset' && el.data?.datasetId && el.position && el.size) {
      datasetMap.set(el.data.datasetId, el);
    }
  }

  const connections: ConnInfo[] = [];
  for (const el of canvasElements) {
    const srcId = el.data?.sourceDatasetId;
    if (!srcId) continue;
    const src = datasetMap.get(srcId);
    if (!src) continue;
    // Skip if either element is missing geometry (can happen with in-flight remote adds)
    if (!el.position || !el.size) continue;

    const side1 = getBestSide(src, el);
    const side2 = getBestSide(el, src);
    const p1 = getSidePoint(src, side1);
    const p2 = getSidePoint(el, side2);
    const connId = `${src.id}→${el.id}`;

    connections.push(computeConnInfo(connId, p1, side1, p2, side2, elbowOffsets[connId] ?? 0));
  }

  // Prune elbowOffsets for connections that no longer exist to prevent unbounded growth
  useEffect(() => {
    const activeIds = new Set(connections.map((c) => c.id));
    setElbowOffsets((prev) => {
      const pruned = Object.fromEntries(Object.entries(prev).filter(([k]) => activeIds.has(k)));
      return Object.keys(pruned).length === Object.keys(prev).length ? prev : pruned;
    });
  }); // intentionally no dep array — runs after every render so it tracks deletions immediately

  if (connections.length === 0) return null;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: canvasWidth,
        height: canvasHeight,
        overflow: 'visible',
        // Rendered before canvas elements in the DOM so zIndex: 1 is sufficient.
        // Child paths override pointerEvents individually for hit-testing.
        zIndex: 1,
        pointerEvents: 'none',
      }}
    >
      <defs>
        <marker id="gs-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,0 L8,4 L0,8 Z" fill="#6366f1" opacity="0.55" />
        </marker>
        <marker id="gs-arrow-active" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,0 L8,4 L0,8 Z" fill="#6366f1" opacity="0.9" />
        </marker>
      </defs>

      {connections.map(({ id, d, handlePoint, dragAxis }) => {
        const isActive = selectedConn === id || hoveredConn === id ||
          (isDragging && dragRef.current?.connId === id);
        return (
          <g key={id}>
            {/* Wide hit area — use a near-invisible stroke so pointer-events:'stroke' is reliable */}
            <path
              d={d}
              stroke="rgba(99,102,241,0.04)"
              strokeWidth={14}
              fill="none"
              strokeLinejoin="round"
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onPointerDown={(e) => handleHitPointerDown(e, id)}
              onMouseEnter={() => setHoveredConn(id)}
              onMouseLeave={() => !isDragging && setHoveredConn(null)}
            />

            {/* Visible line */}
            <path
              d={d}
              stroke="#6366f1"
              strokeWidth={isActive ? 2 : 1.5}
              strokeDasharray="6 4"
              strokeLinejoin="round"
              fill="none"
              opacity={isActive ? 0.8 : 0.45}
              markerEnd={isActive ? 'url(#gs-arrow-active)' : 'url(#gs-arrow)'}
              style={{ pointerEvents: 'none' }}
            />

            {/* Elbow drag handle — shown when hovered/selected/dragging */}
            {handlePoint && dragAxis && isActive && (
              <g>
                <circle
                  cx={handlePoint.x}
                  cy={handlePoint.y}
                  r={8}
                  fill="white"
                  stroke="#6366f1"
                  strokeWidth={2}
                  style={{
                    pointerEvents: 'all',
                    cursor: dragAxis === 'x' ? 'ew-resize' : 'ns-resize',
                    filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.2))',
                  }}
                  onPointerDown={(e) => handleHandlePointerDown(e, id, dragAxis)}
                />
                <circle
                  cx={handlePoint.x}
                  cy={handlePoint.y}
                  r={3.5}
                  fill="#6366f1"
                  style={{ pointerEvents: 'none' }}
                />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
