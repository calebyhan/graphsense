'use client';

import { useMemo, useState } from 'react';
import { Plus, FolderOpen, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OwnedCanvasCard } from '@/components/dashboard/CanvasCard';
import { useMyCanvases } from '@/hooks/useCanvas';
import { Canvas } from '@/lib/api/backendClient';

type SortKey = 'updated' | 'name_asc' | 'name_desc';

function sortCanvases(canvases: Canvas[], sort: SortKey): Canvas[] {
  return [...canvases].sort((a, b) => {
    if (sort === 'name_asc') return a.name.localeCompare(b.name);
    if (sort === 'name_desc') return b.name.localeCompare(a.name);
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

function CreateCanvasDialog({ onCreated }: { onCreated: (name: string, desc?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreated(name.trim(), description.trim() || undefined);
    setName('');
    setDescription('');
    setOpen(false);
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
        <Plus className="w-4 h-4 mr-2" /> New Canvas
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">New Canvas</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            autoFocus
            placeholder="Canvas name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
              Create
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function MyCanvases() {
  const { canvases, loading, error, createCanvas, deleteCanvas, renameCanvas } = useMyCanvases();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('updated');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? canvases.filter(c =>
          c.name.toLowerCase().includes(q) ||
          (c.description?.toLowerCase().includes(q) ?? false)
        )
      : canvases;
    return sortCanvases(list, sort);
  }, [canvases, query, sort]);

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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">My Canvases</h2>
        <CreateCanvasDialog onCreated={(name, desc) => createCanvas(name, desc)} />
      </div>

      {canvases.length > 0 && (
        <div className="flex gap-2 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="search"
              placeholder="Search canvases…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="updated">Last updated</option>
            <option value="name_asc">Name A → Z</option>
            <option value="name_desc">Name Z → A</option>
          </select>
        </div>
      )}

      {canvases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">No canvases yet</p>
          <CreateCanvasDialog onCreated={(name, desc) => createCanvas(name, desc)} />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-12 text-center">
          No canvases match &ldquo;{query}&rdquo;
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(canvas => (
            <OwnedCanvasCard
              key={canvas.id}
              canvas={canvas}
              onDelete={deleteCanvas}
              onRename={renameCanvas}
            />
          ))}
        </div>
      )}
    </div>
  );
}
