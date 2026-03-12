'use client';

import React, { useRef } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';

function CursorIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
      <path
        d="M1 1L6 18L8.5 10.5L15 8.5L1 1Z"
        fill={color}
        stroke="white"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function CollaboratorCursors() {
  const collaborators = useCanvasStore((s) => s.collaborators);
  const viewport = useCanvasStore((s) => s.viewport);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1000,
        overflow: 'hidden',
      }}
    >
      {collaborators.map((user) => {
        if (!user.cursor) return null;

        // Convert world coords → screen coords using actual container dimensions,
        // matching the InfiniteCanvas content transform:
        //   translate(containerWidth/2, containerHeight/2) translate(vp.x, vp.y) scale(zoom)
        const containerWidth = containerRef.current?.clientWidth ?? 0;
        const containerHeight = containerRef.current?.clientHeight ?? 0;
        const screenX = user.cursor.x * viewport.zoom + viewport.x;
        const screenY = user.cursor.y * viewport.zoom + viewport.y;

        const finalX = screenX + containerWidth / 2;
        const finalY = screenY + containerHeight / 2;

        return (
          <div
            key={user.userId}
            style={{
              position: 'absolute',
              left: finalX,
              top: finalY,
              transform: 'translate(-2px, -2px)',
              transition: 'left 50ms linear, top 50ms linear',
              willChange: 'left, top',
            }}
          >
            <CursorIcon color={user.color} />
            <span
              style={{
                position: 'absolute',
                top: 18,
                left: 4,
                background: user.color,
                color: '#fff',
                fontSize: 11,
                padding: '1px 6px',
                borderRadius: 4,
                whiteSpace: 'nowrap',
                fontWeight: 500,
                lineHeight: '16px',
              }}
            >
              {user.displayName}
            </span>
          </div>
        );
      })}
    </div>
  );
}
