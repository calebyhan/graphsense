'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, Link2, Users, Trash2 } from 'lucide-react';
import { canvasAPI, Canvas, Collaborator } from '@/lib/api/backendClient';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ShareDialogProps {
  canvasId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareDialog({ canvasId, isOpen, onClose }: ShareDialogProps) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [selectedPermission, setSelectedPermission] = useState<'view' | 'edit'>('view');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!isOpen || !accessToken) return;
    try {
      const [c, collabs] = await Promise.all([
        canvasAPI.get(canvasId, accessToken),
        canvasAPI.listCollaborators(canvasId, accessToken),
      ]);
      setCanvas(c);
      setCollaborators(collabs);
      if (c.has_share_link && c.share_permission && c.share_token) {
        setSelectedPermission(c.share_permission);
        // Populate the share URL from the token returned by the server so the
        // copy button works even when the dialog is opened in a new session.
        setShareUrl(`${window.location.origin}/canvas/${canvasId}?token=${c.share_token}`);
      } else {
        // Clear any stale share URL when there is no active link or token.
        setShareUrl(null);
      }
    } catch {
      // ignore
    }
  }, [canvasId, isOpen, accessToken]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result = await canvasAPI.generateShareLink(canvasId, selectedPermission, accessToken);
      const fullUrl = window.location.origin + result.share_url;
      setShareUrl(fullUrl);
      setCanvas(prev => prev ? { ...prev, has_share_link: true, share_permission: result.share_permission } : prev);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    setLoading(true);
    try {
      await canvasAPI.revokeShareLink(canvasId, accessToken);
      setShareUrl(null);
      setCanvas(prev => prev ? { ...prev, has_share_link: false, share_permission: null } : prev);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRemoveCollaborator = async (userId: string) => {
    await canvasAPI.removeCollaborator(canvasId, userId, accessToken);
    setCollaborators(prev => prev.filter(c => c.user_id !== userId));
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Share Canvas</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Permission selector + generate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Permission level
            </label>
            <div className="flex gap-2 mb-3">
              {(['view', 'edit'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setSelectedPermission(p)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    selectedPermission === p
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {p === 'view' ? 'View only' : 'Can edit'}
                </button>
              ))}
            </div>
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Link2 className="w-4 h-4 mr-2" />
              {canvas?.has_share_link ? 'Regenerate link' : 'Generate link'}
            </Button>
          </div>

          {/* Active link */}
          {shareUrl && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Active link
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 truncate"
                />
                <button
                  onClick={handleCopy}
                  disabled={!shareUrl}
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
                </button>
                <button
                  onClick={handleRevoke}
                  disabled={loading}
                  className="px-3 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Collaborators */}
          {collaborators.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Users className="w-3 h-3" />
                Collaborators ({collaborators.length})
              </p>
              <ul className="space-y-2">
                {collaborators.map(c => (
                  <li key={c.user_id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-800 dark:text-gray-200">
                        {c.email || c.user_id.slice(0, 8) + '...'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs capitalize">{c.permission}</Badge>
                      <button
                        onClick={() => handleRemoveCollaborator(c.user_id)}
                        className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
