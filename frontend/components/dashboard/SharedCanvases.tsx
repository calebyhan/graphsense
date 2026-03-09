'use client';

import { Users } from 'lucide-react';
import { SharedCanvasCard } from '@/components/dashboard/CanvasCard';
import { useSharedCanvases } from '@/hooks/useCanvas';

export function SharedCanvases() {
  const { canvases, loading, error } = useSharedCanvases();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600 py-8 text-center">{error}</p>;
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Shared with Me</h2>

      {canvases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            No shared canvases yet. Ask someone to share a canvas link with you.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {canvases.map(canvas => (
            <SharedCanvasCard key={canvas.id} canvas={canvas} />
          ))}
        </div>
      )}
    </div>
  );
}
