import { triggerHapticNotification } from './haptics';

export interface CalendarEventData {
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  durationMinutes: number;
}

/**
 * Add Water Turn slot to device calendar by generating standard .ics calendar invite / Web Calendar link
 */
export async function addWaterTurnToCalendar(data: CalendarEventData): Promise<boolean> {
  void triggerHapticNotification('success');
  const start = new Date(data.startTime);
  const end = new Date(start.getTime() + data.durationMinutes * 60 * 1000);

  const formatDate = (date: Date) =>
    date.toISOString().replace(/-|:|\.\d+/g, '');

  const title = encodeURIComponent(data.title);
  const details = encodeURIComponent(data.description || 'Tubewell water turn reminder - KisanJalSetu');
  const location = encodeURIComponent(data.location || 'Farm Field');

  /* 1. Try Google Calendar Web Intent link (works on Android & Desktop) */
  const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatDate(start)}/${formatDate(end)}&details=${details}&location=${location}`;

  /* 2. Create iCalendar .ics blob for iOS / Native Calendar app */
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KisanJalSetu//WaterTurn//EN',
    'BEGIN:VEVENT',
    `SUMMARY:${data.title}`,
    `DESCRIPTION:${data.description || 'Tubewell water session reminder'}`,
    `LOCATION:${data.location || ''}`,
    `DTSTART:${formatDate(start)}`,
    `DTEND:${formatDate(end)}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Water Turn Reminder (15 mins before)',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  try {
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `water_turn_${start.getTime()}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    window.open(gcalUrl, '_blank');
    return true;
  }
}
