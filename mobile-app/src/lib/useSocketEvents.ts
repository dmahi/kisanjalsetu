import { useEffect } from 'react';
import {
  onSocketEvent,
  type SocketEventName,
} from './socket';

/**
 * Subscribe a callback to a socket event for the lifetime of the component.
 * The handler ref is always current, so the effect only re-subscribes when
 * the event name changes.
 */
export function useSocketEvent(name: SocketEventName, handler: (payload: any) => void): void {
  useEffect(() => {
    return onSocketEvent(name, handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
}