'use client';

import React from 'react';
import { Lock } from 'lucide-react';
import { useCanvasStore } from '@/store/useCanvasStore';

export default function ElementLockOverlay() {
  const canvasElements = useCanvasStore((s) => s.canvasElements);
  const elementLocks = useCanvasStore((s) => s.elementLocks);
  const collaborators = useCanvasStore((s) => s.collaborators);
  const myUserId = useCanvasStore((s) => s.myUserId);

  return (
    <>
      {canvasElements.map((el) => {
        const lockHolder = elementLocks[el.id];
        if (!lockHolder || lockHolder === myUserId) return null;

        const holder = collaborators.find((c) => c.userId === lockHolder);
        const color = holder?.color ?? '#888';

        return (
          <div
            key={`lock-${el.id}`}
            style={{
              position: 'absolute',
              left: el.position.x,
              top: el.position.y,
              width: el.size.width,
              height: el.size.height,
              border: `2px solid ${color}`,
              borderRadius: 8,
              pointerEvents: 'none',
              zIndex: 999,
            }}
          >
            {/* Lock badge */}
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-white text-[10px] font-medium"
              style={{
                position: 'absolute',
                top: -12,
                right: -8,
                background: color,
                whiteSpace: 'nowrap',
              }}
            >
              <Lock size={10} />
              {holder?.displayName}
            </div>
          </div>
        );
      })}
    </>
  );
}
