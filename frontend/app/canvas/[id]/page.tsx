'use client';

import { Suspense, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCanvasPermission } from '@/hooks/useCanvasPermission';
import { useRealtimeCanvas } from '@/hooks/useRealtimeCanvas';
import AutoVizAgent from '@/components/AutoVizAgent';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

function CanvasContent() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { user, session, loading: authLoading } = useAuth();
  const router = useRouter();
  const { permission, loading: permLoading, joinViaToken } = useCanvasPermission(id);

  // Real-time collaboration
  const { emitCursor } = useRealtimeCanvas(
    id,
    session?.access_token ?? null,
    user?.id ?? null,
    permission === 'view'
  );

  useEffect(() => {
    if (authLoading || permLoading) return;

    // Not logged in → redirect to auth, preserving full canvas URL as redirect target
    if (!user) {
      const redirectUrl = encodeURIComponent(`/canvas/${id}${token ? `?token=${token}` : ''}`);
      router.replace(`/auth/login?redirect=${redirectUrl}`);
      return;
    }

    // Logged in + token present + no permission yet → join via token
    if (token && permission === null) {
      joinViaToken(token).then(result => {
        if (result.error) {
          router.replace('/dashboard?error=invalid_token');
        } else {
          // Clean token from URL
          router.replace(`/canvas/${id}`, { scroll: false });
        }
      });
      return;
    }

    // Logged in, no token, no permission → access denied
    if (!token && permission === null) {
      router.replace('/dashboard?error=no_access');
    }
  }, [authLoading, permLoading, user, token, permission, id, router, joinViaToken]);

  const isReadOnly = permission === 'view';
  const isOwner = permission === 'owner';
  useKeyboardShortcuts(isReadOnly);

  if (authLoading || permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Still resolving (joining or redirecting)
  if (!permission) return null;

  return (
    <>
      {/* View-only banner */}
      {isReadOnly && (
        <div className="fixed top-0 inset-x-0 z-20 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-center text-sm text-amber-700 dark:text-amber-400">
          You have view-only access to this canvas. Export is still available.
        </div>
      )}

      <AutoVizAgent readOnly={isReadOnly} emitCursor={emitCursor} canvasId={id} isOwner={isOwner} />
    </>
  );
}

export default function CanvasPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CanvasContent />
    </Suspense>
  );
}
