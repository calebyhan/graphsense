'use client';

import React from 'react';
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

  return (
    <div
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

        // Convert world coords → screen coords
        // screen = world * zoom + viewport.offset + canvasCenter
        // (canvasCenter is handled by the parent container's CSS centering)
        const screenX = user.cursor.x * viewport.zoom + viewport.x;
        const screenY = user.cursor.y * viewport.zoom + viewport.y;

        // Offset by half the container (matches InfiniteCanvas centering transform)
        const finalX = screenX + (typeof window !== 'undefined' ? window.innerWidth / 2 : 0);
        const finalY = screenY + (typeof window !== 'undefined' ? window.innerHeight / 2 : 0);

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
