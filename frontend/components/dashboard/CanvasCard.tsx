'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Share2, Trash2, Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Canvas, SharedCanvas } from '@/lib/api/backendClient';
import { ShareDialog } from '@/components/canvas/ShareDialog';

interface OwnedCanvasCardProps {
  canvas: Canvas;
  onDelete: (id: string) => Promise<void>;
}

export function OwnedCanvasCard({ canvas, onDelete }: OwnedCanvasCardProps) {
  const router = useRouter();
  const [shareOpen, setShareOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete "${canvas.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await onDelete(canvas.id);
    } finally {
      setDeleting(false);
      setMenuOpen(false);
    }
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 hover:shadow-md transition-shadow">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">{canvas.name}</h3>
            {canvas.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{canvas.description}</p>
            )}
          </div>
          <div className="relative ml-2">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <MoreHorizontal className="w-4 h-4 text-gray-400" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-10 min-w-[140px]">
                <button
                  onClick={() => { setMenuOpen(false); setShareOpen(true); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Share2 className="w-4 h-4" /> Share
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 mb-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Database className="w-3 h-3" />
            {canvas.dataset_count} dataset{canvas.dataset_count !== 1 ? 's' : ''}
          </span>
          {canvas.has_share_link && (
            <Badge variant="secondary" className="text-xs capitalize">
              {canvas.share_permission} link active
            </Badge>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => router.push(`/canvas/${canvas.id}`)}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            Open
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShareOpen(true)}
          >
            <Share2 className="w-3 h-3 mr-1" /> Share
          </Button>
        </div>

        <p className="text-xs text-gray-400 mt-3">
          Updated {new Date(canvas.updated_at).toLocaleDateString()}
        </p>
      </div>

      <ShareDialog canvasId={canvas.id} isOpen={shareOpen} onClose={() => setShareOpen(false)} />
    </>
  );
}

interface SharedCanvasCardProps {
  canvas: SharedCanvas;
}

export function SharedCanvasCard({ canvas }: SharedCanvasCardProps) {
  const router = useRouter();

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white truncate">{canvas.name}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            by {canvas.owner.email || canvas.owner.id.slice(0, 8) + '...'}
          </p>
        </div>
        <Badge
          variant={canvas.permission === 'edit' ? 'default' : 'secondary'}
          className="ml-2 capitalize text-xs"
        >
          {canvas.permission}
        </Badge>
      </div>

      <div className="flex items-center gap-3 mb-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <Database className="w-3 h-3" />
          {canvas.dataset_count} dataset{canvas.dataset_count !== 1 ? 's' : ''}
        </span>
      </div>

      <Button
        size="sm"
        onClick={() => router.push(`/canvas/${canvas.id}`)}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
      >
        Open
      </Button>

      <p className="text-xs text-gray-400 mt-3">
        Joined {new Date(canvas.joined_at).toLocaleDateString()}
      </p>
    </div>
  );
}
