/**
 * Pure mapping of a server push message type + role to an in-app route.
 * Kept dependency-free so it is unit-testable in Node.
 */
export function notificationRouteFor(type: string, role: string): string {
  const isOwner = role === 'tubewell_owner' || role === 'operator';
  if (type === 'session_started' || type === 'session_stopped' || type === 'water_started' || type === 'water_stopped' || type === 'water_ended') {
    return isOwner ? '/owner/sessions' : '/farmer/sessions';
  }
  if (type.startsWith('payment')) {
    return isOwner ? '/owner/payments' : '/farmer/payments';
  }
  if (type === 'notification') {
    return isOwner ? '/owner/notifications' : '/farmer/notifications';
  }
  if (type === 'water_request_new') {
    return isOwner ? '/owner/queue' : '/farmer/requests';
  }
  if (type === 'water_request_accepted' || type === 'water_request_rejected' || type === 'queue_position_changed' || type === 'queue_next' || type === 'queue_removed') {
    return isOwner ? '/owner/queue' : '/farmer/requests';
  }
  return isOwner ? '/owner/dashboard' : '/farmer/home';
}

export type PushPayloadLike = {
  data?: Record<string, unknown> | string;
};

/** Read the `type` field out of an incoming payload (string or object data). */
export function pushTypeOf(payload: PushPayloadLike, fallback = 'info'): string {
  const raw = payload?.data;
  if (!raw) return fallback;
  if (typeof raw === 'string') {
    try {
      return (JSON.parse(raw).type as string | undefined) || fallback;
    } catch {
      return fallback;
    }
  }
  return typeof raw.type === 'string' ? raw.type : fallback;
}