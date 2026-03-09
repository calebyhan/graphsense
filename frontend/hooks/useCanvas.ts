'use client';

import { useCallback, useEffect, useState } from 'react';
import { canvasAPI, Canvas, SharedCanvas, Collaborator } from '@/lib/api/backendClient';
import { useAuth } from '@/hooks/useAuth';

export function useMyCanvases() {
  const { session } = useAuth();
  const accessToken = session?.access_token;

  const [canvases, setCanvases] = useState<Canvas[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (token: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await canvasAPI.list(token);
      setCanvases(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (accessToken) fetch(accessToken);
    else setLoading(false);
  }, [fetch, accessToken]);

  const createCanvas = useCallback(async (name: string, description?: string) => {
    const canvas = await canvasAPI.create(name, description, accessToken);
    setCanvases(prev => [canvas, ...prev]);
    return canvas;
  }, [accessToken]);

  const deleteCanvas = useCallback(async (id: string) => {
    await canvasAPI.delete(id, accessToken);
    setCanvases(prev => prev.filter(c => c.id !== id));
  }, [accessToken]);

  return { canvases, loading, error, refresh: () => accessToken && fetch(accessToken), createCanvas, deleteCanvas };
}

export function useSharedCanvases() {
  const { session } = useAuth();
  const accessToken = session?.access_token;

  const [canvases, setCanvases] = useState<SharedCanvas[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (token: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await canvasAPI.listShared(token);
      setCanvases(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (accessToken) fetch(accessToken);
    else setLoading(false);
  }, [fetch, accessToken]);

  return { canvases, loading, error, refresh: () => accessToken && fetch(accessToken) };
}

export function useCanvasCollaborators(canvasId: string) {
  const { session } = useAuth();
  const accessToken = session?.access_token;

  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async (token: string) => {
    setLoading(true);
    try {
      const data = await canvasAPI.listCollaborators(canvasId, token);
      setCollaborators(data);
    } catch {
      // owner-only endpoint; silently ignore if not owner
    } finally {
      setLoading(false);
    }
  }, [canvasId]);

  useEffect(() => {
    if (accessToken) fetch(accessToken);
  }, [fetch, accessToken]);

  const removeCollaborator = useCallback(async (userId: string) => {
    await canvasAPI.removeCollaborator(canvasId, userId, accessToken);
    setCollaborators(prev => prev.filter(c => c.user_id !== userId));
  }, [canvasId, accessToken]);

  return { collaborators, loading, refresh: () => accessToken && fetch(accessToken), removeCollaborator };
}
