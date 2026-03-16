'use client';

import { useMemo, useState } from 'react';
import { Users, Search } from 'lucide-react';
import { SharedCanvasCard } from '@/components/dashboard/CanvasCard';
import { useSharedCanvases } from '@/hooks/useCanvas';
import { useProfiles } from '@/hooks/useProfile';
import { SharedCanvas } from '@/lib/api/backendClient';

type SortKey = 'updated' | 'name_asc' | 'name_desc';

function sortCanvases(canvases: SharedCanvas[], sort: SortKey): SharedCanvas[] {
  return [...canvases].sort((a, b) => {
    if (sort === 'name_asc') return a.name.localeCompare(b.name);
    if (sort === 'name_desc') return b.name.localeCompare(a.name);
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

export function SharedCanvases() {
  const { canvases, loading, error } = useSharedCanvases();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('updated');

  const ownerIds = useMemo(() => canvases.map(c => c.owner.id), [canvases]);
  const { profiles } = useProfiles(ownerIds);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? canvases.filter(c => c.name.toLowerCase().includes(q))
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
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Shared with Me</h2>

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
          <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            No shared canvases yet. Ask someone to share a canvas link with you.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-12 text-center">
          No canvases match &ldquo;{query}&rdquo;
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(canvas => (
            <SharedCanvasCard
              key={canvas.id}
              canvas={canvas}
              ownerProfile={profiles[canvas.owner.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
