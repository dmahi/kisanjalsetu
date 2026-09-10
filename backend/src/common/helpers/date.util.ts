import { BadRequestException } from '@nestjs/common';

const MINUTES = 60;
const HOURS = 24;

/**
 * Server timestamps are stored as UTC ISO dates. Presentation/rounding uses
 * APP_TIMEZONE (default Asia/Kolkata). Durations are always exact minute counts.
 */
export function startOfDay(date: Date, tzOffsetMinutes = 330): Date {
  const shifted = new Date(date.getTime() - tzOffsetMinutes * MINUTES * 1000);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) +
      tzOffsetMinutes * MINUTES * 1000,
  );
}

export function endOfDay(date: Date, tzOffsetMinutes = 330): Date {
  const sod = startOfDay(date, tzOffsetMinutes);
  return new Date(sod.getTime() + HOURS * MINUTES * MINUTES * 1000 - 1);
}

export function minutesBetween(start: Date, end: Date): number {
  const minutes = Math.round((end.getTime() - start.getTime()) / (60 * 1000));
  if (minutes < 0) {
    throw new BadRequestException('End time must be after start time');
  }
  return minutes;
}

export function formatDurationMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}