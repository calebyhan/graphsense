'use client';

import { useCallback, useEffect, useState } from 'react';
import { canvasAPI } from '@/lib/api/backendClient';
import { useAuth } from '@/hooks/useAuth';

type Permission = 'owner' | 'edit' | 'view' | null;

interface UseCanvasPermissionResult {
  permission: Permission;
  loading: boolean;
  joinViaToken: (token: string) => Promise<{ error: string | null }>;
  refetch: () => void;
}

export function useCanvasPermission(canvasId: string): UseCanvasPermissionResult {
  const { session } = useAuth();
  const accessToken = session?.access_token;

  const [permission, setPermission] = useState<Permission>(null);
  const [loading, setLoading] = useState(true);

  const fetchPermission = useCallback(async (token: string) => {
    if (!canvasId) return;
    setLoading(true);
    try {
      const canvas = await canvasAPI.get(canvasId, token);
      setPermission((canvas.permission as Permission) ?? null);
    } catch {
      setPermission(null);
    } finally {
      setLoading(false);
    }
  }, [canvasId]);

  useEffect(() => {
    if (accessToken) {
      fetchPermission(accessToken);
    }
  }, [fetchPermission, accessToken]);

  const joinViaToken = useCallback(async (token: string): Promise<{ error: string | null }> => {
    try {
      const result = await canvasAPI.join(token);
      setPermission(result.permission as Permission);
      return { error: null };
    } catch (e: any) {
      return { error: e.message || 'Invalid or expired share token' };
    }
  }, []);

  return {
    permission,
    loading,
    joinViaToken,
    refetch: () => { if (accessToken) fetchPermission(accessToken); },
  };
}
