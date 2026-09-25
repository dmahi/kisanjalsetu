import { io, type Socket } from 'socket.io-client';
import { API_ORIGIN, getEffectiveToken } from '../api/client';
import { useAuthStore } from '../store/auth.store';

export type SocketEventName =
  | 'waterStarted'
  | 'waterStopped'
  | 'timerTick'
  | 'waterRequestCreated'
  | 'waterRequestAccepted'
  | 'waterRequestRejected'
  | 'waterRequestCancelled'
  | 'waterQueueChanged'
  | 'waterTurnAlertSent'
  | 'waterTurnAlertStatus';

export interface WaterRequestSocketPayload {
  requestId: string;
  tubewellId: string;
  ownerId?: string | null;
  customerId: string;
  customerName?: string | null;
  fieldId?: string;
  fieldName?: string | null;
  cropName?: string | null;
  queuePosition?: number;
  rejectionReason?: string | null;
  note?: string | null;
  createdAt?: unknown;
}

export interface WaterTurnAlertSentPayload {
  alertId: string;
  tubewellId: string;
  targetCustomerId: string;
  farmerName?: string | null;
  tubewellName?: string | null;
  fieldName?: string | null;
  cropName?: string | null;
  responseDeadlineAt?: string | null;
  attemptNumber: number;
  maxAttempts: number;
  estimatedRemainingMinutes?: number;
  type?: string;
}

export interface WaterTurnAlertStatusPayload {
  alertId: string;
  tubewellId: string;
  ownerId?: string | null;
  targetCustomerId: string;
  farmerName?: string | null;
  tubewellName?: string | null;
  status: string;
  response?: string | null;
  type?: string;
}

export interface WaterSessionPayload {
  sessionId: string;
  tubewellId: string;
  tubewellName?: string;
  customerId: string;
  fieldId?: string;
  fieldName?: string;
  startTime?: unknown;
  endTime?: unknown;
  durationMinutes?: number;
  totalAmount?: number | string;
  ratePerHour?: number | string;
}

type EventHandler = (payload: any) => void;

/** Single shared socket instance (connect lazily, auth via JWT). */
let socket: Socket | null = null;
let connectPromise: Promise<Socket | null> | null = null;

const handlers = new Map<SocketEventName, Set<EventHandler>>();

function dispatch(name: SocketEventName, payload: any) {
  const set = handlers.get(name);
  if (!set) return;
  for (const h of set) {
    try {
      h(payload);
    } catch (err) {
      console.error(`[socket] handler error for ${name}`, err);
    }
  }
}

/** Subscribe to an event; returns an unsubscribe function. */
export function onSocketEvent(name: SocketEventName, handler: EventHandler): () => void {
  if (!handlers.has(name)) handlers.set(name, new Set());
  handlers.get(name)!.add(handler);
  return () => {
    handlers.get(name)?.delete(handler);
  };
}

function attachListeners(s: Socket) {
  s.on('waterStarted', (p) => dispatch('waterStarted', p));
  s.on('waterStopped', (p) => dispatch('waterStopped', p));
  s.on('timerTick', (p) => dispatch('timerTick', p));
  s.on('waterRequestCreated', (p) => dispatch('waterRequestCreated', p));
  s.on('waterRequestAccepted', (p) => dispatch('waterRequestAccepted', p));
  s.on('waterRequestRejected', (p) => dispatch('waterRequestRejected', p));
  s.on('waterRequestCancelled', (p) => dispatch('waterRequestCancelled', p));
  s.on('waterQueueChanged', (p) => dispatch('waterQueueChanged', p));
  s.on('waterTurnAlertSent', (p) => dispatch('waterTurnAlertSent', p));
  s.on('waterTurnAlertStatus', (p) => dispatch('waterTurnAlertStatus', p));
}

/**
 * Establish (or reuse) the "/water" socket connection authenticated with the
 * current JWT. Handles re-auth after login token rotation.
 */
export async function connectSocket(force = false): Promise<Socket | null> {
  if (socket && !force) {
    if (socket.connected) return socket;
    return socket;
  }

  const token = await getEffectiveToken();
  if (!token) return null;

  const url = `${API_ORIGIN}/water`;
  if (connectPromise) return connectPromise;

  connectPromise = new Promise<Socket | null>((resolve) => {
    const s = io(url, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 10000,
      timeout: 15000,
    });

    s.on('connect', () => {
      socket = s;
      resolve(s);
      connectPromise = null;
    });

    s.on('connect_error', (err) => {
      console.warn('[socket] connect_error', err?.message);
      // Allow a future connect attempt to create a fresh socket.
      if (!s.connected) {
        connectPromise = null;
        s.removeAllListeners();
        s.disconnect();
      }
    });

    s.on('disconnect', (reason) => {
      console.warn('[socket] disconnected', reason);
    });

    attachListeners(s);
  });

  return connectPromise;
}

/** Join a tubewell's room so this client receives tubewell-scoped events. */
export function joinTubewell(tubewellId: string): void {
  if (!tubewellId || !socket) return;
  socket.emit('joinTubewell', { tubewellId });
}

/** Disconnect and drop the shared instance (used on logout). */
export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  connectPromise = null;
  handlers.clear();
}

/** True if the socket is currently connected. */
export function isSocketConnected(): boolean {
  return Boolean(socket?.connected);
}