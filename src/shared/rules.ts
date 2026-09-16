import type { Attempt, Patient } from './types';
import { normalizePhone } from './phone';
import { FALLBACK_TZ, tzForPhone } from './tz';
import { hourBlock, inCallingWindow, localTime, parseUtcText, type LocalTime } from './time';
import { HUMAN_OUTCOME } from './outcome';

export const MIN_HOURS_BETWEEN_ATTEMPTS = 24;
export const ATTEMPT_WINDOW_DAYS = 7;
export const MAX_ATTEMPTS_PER_WINDOW = 3;

export interface RuleContext {
  attemptsSince: (run: string, sinceUtcText: string) => number;
  lastAttempt: (run: string) => Attempt | undefined;
}

export type DropReason =
  | 'consent'
  | 'dnc'
  | 'phone'
  | 'attempt_24h'
  | 'attempts_7d'
  | 'already_handled'
  | 'unknown_tz'
  | 'outside_hours'
  | 'same_block';

function utcText(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function evaluate(
  patient: Patient,
  now: Date,
  ctx: RuleContext,
  options: { consentZero?: boolean; bypassHours?: boolean } = {},
): DropReason | null {
  const consent = options.consentZero ? 0 : patient.consent;
  if (consent !== 1) return 'consent';
  if (patient.dnc === 1) return 'dnc';
  const phone = normalizePhone(patient.phone);
  if (!phone) return 'phone';
  const dayAgo = new Date(now.getTime() - MIN_HOURS_BETWEEN_ATTEMPTS * 3600 * 1000);
  if (ctx.attemptsSince(patient.run, utcText(dayAgo)) > 0) return 'attempt_24h';
  const weekAgo = new Date(now.getTime() - ATTEMPT_WINDOW_DAYS * 86400 * 1000);
  if (ctx.attemptsSince(patient.run, utcText(weekAgo)) >= MAX_ATTEMPTS_PER_WINDOW) return 'attempts_7d';
  const last = ctx.lastAttempt(patient.run);
  if (last && last.outcome === HUMAN_OUTCOME && last.agent_note) return 'already_handled';
  const tz = patient.tz || tzForPhone(phone);
  let local: LocalTime;
  if (options.bypassHours) {
    local = localTime(now, tz || FALLBACK_TZ);
  } else {
    if (!tz) return 'unknown_tz';
    local = localTime(now, tz);
    if (!inCallingWindow(local)) return 'outside_hours';
  }
  if (last) {
    const previousAt = parseUtcText(last.attempted_at);
    if (previousAt) {
      const previous = localTime(previousAt, tz || FALLBACK_TZ);
      if (hourBlock(previous) === hourBlock(local)) return 'same_block';
    }
  }
  return null;
}
