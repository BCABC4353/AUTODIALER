export interface LocalTime {
  weekday: number;
  hour: number;
  minute: number;
  ymd: string;
}

const WEEKDAYS: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

export const CALLING_WINDOWS: Record<number, [number, number] | null> = {
  0: [9, 20],
  1: [9, 20],
  2: [9, 20],
  3: [9, 20],
  4: [9, 20],
  5: [10, 17],
  6: null,
};

export const HOUR_BLOCKS: [string, number, number][] = [
  ['morning', 9, 12],
  ['afternoon', 12, 16],
  ['evening', 16, 20],
];

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    formatters.set(tz, f);
  }
  return f;
}

export function localTime(date: Date, tz: string): LocalTime {
  const parts: Record<string, string> = {};
  for (const p of formatter(tz).formatToParts(date)) parts[p.type] = p.value;
  return {
    weekday: WEEKDAYS[parts.weekday ?? 'Mon'] ?? 0,
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    ymd: `${parts.year}${parts.month}${parts.day}`,
  };
}

export function inCallingWindow(local: LocalTime): boolean {
  const window = CALLING_WINDOWS[local.weekday];
  if (!window) return false;
  return window[0] <= local.hour && local.hour < window[1];
}

export function hourBlock(local: LocalTime): string | null {
  for (const [name, start, end] of HOUR_BLOCKS) {
    if (start <= local.hour && local.hour < end) return name;
  }
  return null;
}

export function toUtcText(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function parseUtcText(value: string | null | undefined): Date | null {
  if (!value) return null;
  const text = String(value).trim();
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(text) ? text : text + 'Z');
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLocal(utcText: string | null | undefined): string {
  const date = parseUtcText(utcText);
  if (!date) return utcText ?? '';
  const parts: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)) {
    parts[p.type] = p.value;
  }
  return `${parts.month} ${parts.day} ${parts.hour}:${parts.minute}`;
}

export function clockStamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
