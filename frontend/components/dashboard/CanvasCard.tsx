'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Share2, Trash2, Database, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Canvas, SharedCanvas, CanvasThumbnail } from '@/lib/api/backendClient';
import { ShareDialog } from '@/components/canvas/ShareDialog';
import { Avatar } from '@/components/ui/Avatar';
import { getAvatarColor } from '@/lib/utils/avatarColor';
import type { Profile } from '@/hooks/useProfile';

// ---------------------------------------------------------------------------
// Thumbnail preview
// ---------------------------------------------------------------------------

const ELEMENT_COLORS: Record<string, string> = {
  chart: '#6366f1',
  dataset: '#10b981',
  table: '#f59e0b',
  map: '#3b82f6',
  text: '#8b5cf6',
};


function ThumbnailPreview({ thumbnail }: { thumbnail: CanvasThumbnail }) {
  const { elements, bounds } = thumbnail;
  const rangeX = bounds.maxX - bounds.minX || 1;
  const rangeY = bounds.maxY - bounds.minY || 1;

  // Render into a 280×160 viewBox with 12% padding, uniform scale, centered
  const vw = 280;
  const vh = 160;
  const PAD = 0.12;
  const scale = Math.min(vw / (rangeX * (1 + 2 * PAD)), vh / (rangeY * (1 + 2 * PAD)));
  const contentW = rangeX * scale;
  const contentH = rangeY * scale;
  const offsetX = (vw - contentW) / 2;
  const offsetY = (vh - contentH) / 2;

  const toSvg = (el: CanvasThumbnail['elements'][0]) => ({
    x: offsetX + (el.x - bounds.minX) * scale,
    y: offsetY + (el.y - bounds.minY) * scale,
    w: el.w * scale,
    h: el.h * scale,
  });

  return (
    <div className="w-full rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 mb-3" style={{ aspectRatio: '7/4' }}>
      <svg viewBox={`0 0 ${vw} ${vh}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {elements.map((el, i) => {
          const { x, y, w, h } = toSvg(el);
          const color = ELEMENT_COLORS[el.type] ?? '#94a3b8';
          return (
            <g key={i}>
              <rect
                x={x + 2} y={y + 2} width={Math.max(w - 4, 4)} height={Math.max(h - 4, 4)}
                rx={3} fill={color} fillOpacity={0.15} stroke={color} strokeOpacity={0.6} strokeWidth={1.5}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function EmptyPreview() {
  return (
    <div className="w-full rounded-lg bg-gray-100 dark:bg-gray-700 mb-3 flex items-center justify-center" style={{ aspectRatio: '7/4' }}>
      <span className="text-xs text-gray-400 dark:text-gray-500">Empty canvas</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rename modal
// ---------------------------------------------------------------------------

function RenameDialog({
  currentName,
  onRename,
  onClose,
}: {
  currentName: string;
  onRename: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === currentName) { onClose(); return; }
    setSaving(true);
    setError(null);
    try {
      await onRename(trimmed);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to rename');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Rename canvas</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label htmlFor="canvas-rename-input" className="sr-only">Canvas name</label>
          <input
            id="canvas-rename-input"
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
              {saving ? 'Saving…' : 'Rename'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OwnedCanvasCard
// ---------------------------------------------------------------------------

interface OwnedCanvasCardProps {
  canvas: Canvas;
  onDelete: (id: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
}

export function OwnedCanvasCard({ canvas, onDelete, onRename }: OwnedCanvasCardProps) {
  const router = useRouter();
  const [shareOpen, setShareOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!confirm(`Delete "${canvas.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(canvas.id);
    } catch (e: any) {
      setDeleteError(e.message || 'Failed to delete canvas');
    } finally {
      setDeleting(false);
      setMenuOpen(false);
    }
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 hover:shadow-md transition-shadow flex flex-col">
        {canvas.thumbnail?.elements?.length ? (
          <ThumbnailPreview thumbnail={canvas.thumbnail} />
        ) : (
          <EmptyPreview />
        )}

        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">{canvas.name}</h3>
            {canvas.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{canvas.description}</p>
            )}
          </div>
          <div className="relative ml-2" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              aria-label="Canvas actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <MoreHorizontal className="w-4 h-4 text-gray-400" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-10 min-w-[140px]">
                <button
                  onClick={() => { setMenuOpen(false); setRenameOpen(true); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Pencil className="w-4 h-4" /> Rename
                </button>
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
        <div className="flex items-center gap-2 mt-auto">
          <Button
            size="sm"
            onClick={() => router.push(`/canvas/${canvas.id}`)}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            Open
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShareOpen(true)}>
            <Share2 className="w-3 h-3 mr-1" /> Share
          </Button>
        </div>

        {deleteError && <p className="text-xs text-red-500 mt-2">{deleteError}</p>}
        <p className="text-xs text-gray-400 mt-3">Updated {new Date(canvas.updated_at).toLocaleDateString()}</p>
      </div>

      <ShareDialog canvasId={canvas.id} isOpen={shareOpen} onClose={() => setShareOpen(false)} />
      {renameOpen && (
        <RenameDialog
          currentName={canvas.name}
          onRename={name => onRename(canvas.id, name)}
          onClose={() => setRenameOpen(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// SharedCanvasCard
// ---------------------------------------------------------------------------

interface SharedCanvasCardProps {
  canvas: SharedCanvas;
  ownerProfile?: Profile;
}

export function SharedCanvasCard({ canvas, ownerProfile }: SharedCanvasCardProps) {
  const router = useRouter();
  const ownerName = ownerProfile?.display_name ?? canvas.owner.email ?? canvas.owner.id.slice(0, 8) + '...';
  const ownerColor = ownerProfile?.avatar_color ?? getAvatarColor(canvas.owner.email ?? canvas.owner.id);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 hover:shadow-md transition-shadow flex flex-col">
      {canvas.thumbnail?.elements?.length ? (
        <ThumbnailPreview thumbnail={canvas.thumbnail} />
      ) : (
        <EmptyPreview />
      )}

      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white truncate">{canvas.name}</h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Avatar displayName={ownerName} avatarColor={ownerColor} size="sm" />
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{ownerName}</p>
          </div>
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
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white mt-auto"
      >
        Open
      </Button>

      <p className="text-xs text-gray-400 mt-3">Joined {new Date(canvas.joined_at).toLocaleDateString()}</p>
    </div>
  );
}
