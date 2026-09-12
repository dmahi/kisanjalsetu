import { describe, expect, it } from 'vitest';
import { notificationRouteFor, pushTypeOf } from './deeplink';

describe('notificationRouteFor (deep-link mapping)', () => {
  it('routes water/session events to the right role section', () => {
    expect(notificationRouteFor('water_started', 'farmer')).toBe('/farmer/sessions');
    expect(notificationRouteFor('session_stopped', 'tubewell_owner')).toBe('/owner/sessions');
    expect(notificationRouteFor('water_started', 'operator')).toBe('/owner/sessions');
    expect(notificationRouteFor('water_ended', 'farmer')).toBe('/farmer/sessions');
  });

  it('routes water request and queue events to the queue/requests screens', () => {
    expect(notificationRouteFor('water_request_new', 'tubewell_owner')).toBe('/owner/queue');
    expect(notificationRouteFor('water_request_accepted', 'farmer')).toBe('/farmer/requests');
    expect(notificationRouteFor('water_request_rejected', 'farmer')).toBe('/farmer/requests');
    expect(notificationRouteFor('queue_position_changed', 'farmer')).toBe('/farmer/requests');
    expect(notificationRouteFor('queue_next', 'farmer')).toBe('/farmer/requests');
    expect(notificationRouteFor('queue_removed', 'farmer')).toBe('/farmer/requests');
  });

  it('routes water-turn alerts to the dedicated farmer alert screen / owner queue', () => {
    expect(notificationRouteFor('water_turn_alert', 'farmer')).toBe('/farmer/water-turn');
    expect(notificationRouteFor('water_turn_alert_retry', 'farmer')).toBe('/farmer/water-turn');
    expect(notificationRouteFor('water_turn_delayed', 'farmer')).toBe('/farmer/water-turn');
    expect(notificationRouteFor('water_turn_ready', 'farmer')).toBe('/farmer/water-turn');
    expect(notificationRouteFor('water_turn_alert', 'tubewell_owner')).toBe('/owner/queue');
    expect(notificationRouteFor('water_turn_no_response', 'tubewell_owner')).toBe('/owner/queue');
  });

  it('routes payment events to payments screens', () => {
    expect(notificationRouteFor('payment_request', 'tubewell_owner')).toBe('/owner/payments');
    expect(notificationRouteFor('payment_approved', 'farmer')).toBe('/farmer/payments');
  });

  it('routes explicit notification types to the notifications screen', () => {
    expect(notificationRouteFor('notification', 'farmer')).toBe('/farmer/notifications');
    expect(notificationRouteFor('notification', 'tubewell_owner')).toBe('/owner/notifications');
  });

  it('falls back to the role home for unknown types', () => {
    expect(notificationRouteFor('info', 'farmer')).toBe('/farmer/home');
    expect(notificationRouteFor('custom_event', 'tubewell_owner')).toBe('/owner/dashboard');
  });

  it('extracts the push type from object or serialized data', () => {
    expect(pushTypeOf({ data: { type: 'payment_approved' } })).toBe('payment_approved');
    expect(pushTypeOf({ data: JSON.stringify({ type: 'water_started' }) })).toBe('water_started');
    expect(pushTypeOf({ data: {}, })).toBe('info');
  });
});