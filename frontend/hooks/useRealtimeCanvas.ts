'use client';

import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { useCanvasStore } from '@/store/useCanvasStore';
import {
  getCanvasWebSocket,
  destroyCanvasWebSocket,
} from '@/lib/realtime/canvasWebSocket';

/**
 * Initialises the WebSocket connection for real-time canvas collaboration.
 * Subscribes to all server messages and dispatches to the Zustand store.
 * Returns a throttled `emitCursor` for passing to InfiniteCanvas.
 */
export function useRealtimeCanvas(
  canvasId: string,
  token: string | null,
  userId: string | null,
  isReadOnly: boolean
) {
  const storeRef = useRef(useCanvasStore.getState());
  useEffect(() => {
    return useCanvasStore.subscribe((s) => {
      storeRef.current = s;
    });
  }, []);

  useEffect(() => {
    if (!token || !userId) return;

    const store = useCanvasStore.getState();
    store.setMyUserId(userId);

    const ws = getCanvasWebSocket(canvasId, token);
    ws.connect();

    const unsubs: (() => void)[] = [];

    // canvas_state — full sync on join / reconnect
    unsubs.push(
      ws.on('canvas_state', (data) => {
        const s = useCanvasStore.getState();
        s.setElements(data.elements);
        s.setElementLocks(data.locks);
        // Map presence from server shape → CollaboratorState
        const mapped = (data.presence as any[]).map((p) => ({
          userId: p.user_id,
          displayName: p.display_name ?? `User-${(p.user_id as string).slice(0, 4)}`,
          color: p.color ?? '#4F46E5',
        }));
        s.setCollaborators(mapped);
      })
    );

    // presence_update
    unsubs.push(
      ws.on('presence_update', (data) => {
        const mapped = (data.users as any[]).map((p) => ({
          userId: p.user_id,
          displayName: p.display_name ?? `User-${(p.user_id as string).slice(0, 4)}`,
          color: p.color ?? '#4F46E5',
        }));
        useCanvasStore.getState().setCollaborators(mapped);
      })
    );

    // cursor_update
    unsubs.push(
      ws.on('cursor_update', (data) => {
        useCanvasStore.getState().updateCollaboratorCursor(data.user_id, {
          x: data.x,
          y: data.y,
        });
      })
    );

    // Lock events
    unsubs.push(
      ws.on('lock_granted', (data) => {
        useCanvasStore.getState().setElementLock(data.element_id, data.user_id);
      })
    );
    unsubs.push(
      ws.on('lock_denied', (data) => {
        // Update lock state so the UI shows it immediately.
        if (data.locked_by) {
          const s = useCanvasStore.getState();
          s.setElementLock(data.element_id, data.locked_by);
          const holder = s.collaborators.find((c) => c.userId === data.locked_by);
          const name = holder?.displayName ?? 'someone else';
          toast.warning(`Locked by ${name}`, { duration: 3000 });
        }
      })
    );
    unsubs.push(
      ws.on('lock_released', (data) => {
        useCanvasStore.getState().releaseElementLock(data.element_id);
      })
    );

    // Element sync
    unsubs.push(
      ws.on('element_moved', (data) => {
        // Don't overwrite local drag state
        if (storeRef.current.myLocks.has(data.element_id)) return;
        useCanvasStore.getState().updateElement(data.element_id, {
          position: data.position,
        });
      })
    );
    unsubs.push(
      ws.on('element_committed', (data) => {
        if (data.user_id === userId) return;
        useCanvasStore.getState().updateElement(data.element_id, {
          position: data.position,
          ...(data.size && { size: data.size }),
          ...(data.data !== undefined && { data: data.data }),
        });
      })
    );
    unsubs.push(
      ws.on('element_added', (data) => {
        useCanvasStore.getState().addElementFromRemote(data.element);
      })
    );
    unsubs.push(
      ws.on('element_removed', (data) => {
        useCanvasStore.getState().removeElement(data.element_id);
      })
    );
    unsubs.push(
      ws.on('element_updated', (data) => {
        useCanvasStore.getState().updateElement(data.element_id, data.updates);
      })
    );

    return () => {
      unsubs.forEach((u) => u());
      destroyCanvasWebSocket();
    };
  }, [canvasId, token, userId]);

  // Throttled cursor emit (50ms)
  const cursorPendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorLastSent = useRef(0);

  useEffect(() => {
    return () => {
      if (cursorPendingTimer.current) clearTimeout(cursorPendingTimer.current);
    };
  }, [canvasId, token, isReadOnly]);

  const emitCursor = useMemo(() => {
    return (x: number, y: number) => {
      if (isReadOnly || !token) return;
      const now = Date.now();
      const send = () => {
        cursorLastSent.current = Date.now();
        const ws = getCanvasWebSocket(canvasId, token);
        ws.sendCursorMove(x, y);
      };

      if (now - cursorLastSent.current >= 50) {
        send();
      } else {
        if (cursorPendingTimer.current) clearTimeout(cursorPendingTimer.current);
        cursorPendingTimer.current = setTimeout(send, 50 - (now - cursorLastSent.current));
      }
    };
  }, [canvasId, token, isReadOnly]);

  return { emitCursor };
}
