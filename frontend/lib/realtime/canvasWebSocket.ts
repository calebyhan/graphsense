/**
 * Singleton WebSocket client for canvas real-time collaboration.
 * Not a React hook — plain class with event subscription.
 */

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

type MessageHandler = (data: any) => void;

class CanvasWebSocket {
  private ws: WebSocket | null = null;
  private canvasId: string;
  private token: string;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private listeners = new Map<string, Set<MessageHandler>>();
  private shouldReconnect = true;
  private messageQueue: object[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(canvasId: string, token: string) {
    this.canvasId = canvasId;
    this.token = token;
  }

  connect(): void {
    const state = this.ws?.readyState;
    if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NEXT_PUBLIC_BACKEND_URL
      ? new URL(process.env.NEXT_PUBLIC_BACKEND_URL).host
      : 'localhost:8000';
    const url = `${protocol}//${host}/ws/canvas/${this.canvasId}?token=${encodeURIComponent(this.token)}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      // Flush queued messages
      for (const msg of this.messageQueue) {
        this.ws?.send(JSON.stringify(msg));
      }
      this.messageQueue = [];
    };

    this.ws.onmessage = (event) => {
      let data: any;
      try {
        data = JSON.parse(event.data);
      } catch {
        // Malformed JSON from server — not actionable, skip silently.
        return;
      }
      const type = data.type as string;
      const handlers = this.listeners.get(type);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(data);
          } catch (err) {
            console.error('[CanvasWebSocket] Handler error for message type:', type, err);
          }
        }
      }
    };

    this.ws.onclose = () => {
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      }
    };

    this.ws.onerror = (event) => {
      console.error('[CanvasWebSocket] Connection error for canvas:', this.canvasId, event);
      // onclose will fire after this, triggering reconnect
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.listeners.clear();
    this.messageQueue = [];
  }

  send(message: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  on(type: string, handler: MessageHandler): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);
    return () => {
      this.listeners.get(type)?.delete(handler);
    };
  }

  // --- Typed convenience methods ---

  sendCursorMove(x: number, y: number): void {
    this.send({ type: 'cursor_move', x, y });
  }

  sendLockRequest(elementId: string): void {
    this.send({ type: 'element_lock_request', element_id: elementId });
  }

  sendLockRenew(elementId: string): void {
    this.send({ type: 'element_lock_renew', element_id: elementId });
  }

  sendUnlock(elementId: string): void {
    this.send({ type: 'element_unlock', element_id: elementId });
  }

  sendElementMove(elementId: string, position: Position): void {
    this.send({ type: 'element_move', element_id: elementId, position });
  }

  sendElementCommit(elementId: string, elementType: string, position: Position, size?: Size, data?: any): void {
    this.send({
      type: 'element_commit',
      element_id: elementId,
      id: elementId,
      element_type: elementType,
      position,
      ...(size && { size }),
      ...(data !== undefined && { data }),
    });
  }

  sendElementAdd(element: {
    id: string;
    type: string;
    position: Position;
    size: Size;
    data?: any;
    zIndex?: number;
  }): void {
    this.send({ type: 'element_add', element });
  }

  sendElementRemove(elementId: string): void {
    this.send({ type: 'element_remove', element_id: elementId });
  }

  sendElementUpdate(elementId: string, updates: Record<string, any>): void {
    this.send({ type: 'element_update', element_id: elementId, updates });
  }
}

// Singleton factory
let instance: CanvasWebSocket | null = null;

export function getCanvasWebSocket(canvasId: string, token: string): CanvasWebSocket {
  if (!instance || (instance as any).canvasId !== canvasId || (instance as any).token !== token) {
    instance?.disconnect();
    instance = new CanvasWebSocket(canvasId, token);
  }
  return instance;
}

/** Return the existing WS instance (or null if not connected). */
export function getActiveWebSocket(): CanvasWebSocket | null {
  return instance;
}

export function destroyCanvasWebSocket(): void {
  instance?.disconnect();
  instance = null;
}

export { CanvasWebSocket };
