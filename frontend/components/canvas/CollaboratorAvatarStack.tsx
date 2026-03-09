'use client';

import React from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';

const MAX_VISIBLE = 4;

export default function CollaboratorAvatarStack() {
  const collaborators = useCanvasStore((s) => s.collaborators);

  if (collaborators.length === 0) return null;

  const visible = collaborators.slice(0, MAX_VISIBLE);
  const overflow = collaborators.length - MAX_VISIBLE;

  return (
    <div className="flex items-center">
      {visible.map((user, i) => (
        <div
          key={user.userId}
          title={user.displayName}
          className="flex items-center justify-center rounded-full text-white text-xs font-semibold border-2 border-white dark:border-gray-800"
          style={{
            width: 28,
            height: 28,
            background: user.color,
            marginLeft: i > 0 ? -8 : 0,
            zIndex: MAX_VISIBLE - i,
          }}
        >
          {user.displayName[0]?.toUpperCase() ?? '?'}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold border-2 border-white dark:border-gray-800"
          style={{ width: 28, height: 28, marginLeft: -8 }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
