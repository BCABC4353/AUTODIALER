import type { OutcomeKey, Tone } from './types';

export const HUMAN_OUTCOME = 'HUMAN_ANSWERED';
export const EXPIRED_OUTCOME = 'EXPIRED';

const NO_ANSWER = new Set([
  'EXPIRED',
  'NO_ANSWER',
  'AMD_UNANSWERED',
  'SIT_TONE_BUSY',
  'SIT_TONE_INVALID_NUMBER',
  'SIT_TONE_DETECTED',
  'AMD_ERROR',
]);

export function outcomeTone(outcome: string | null | undefined): Tone {
  if (!outcome) return 'slate';
  if (outcome === HUMAN_OUTCOME) return 'emerald';
  if (outcome.startsWith('VOICEMAIL')) return 'amber';
  if (NO_ANSWER.has(outcome)) return 'orange';
  return 'slate';
}

export function outcomeKey(outcome: string | null | undefined): OutcomeKey {
  const tone = outcomeTone(outcome);
  if (tone === 'emerald') return 'human';
  if (tone === 'amber') return 'voicemail';
  if (tone === 'orange') return 'no_answer';
  return 'other';
}

export function outcomeLabel(outcome: string | null | undefined): string {
  return (outcome || 'pending').replace(/_/g, ' ').toLowerCase();
}

export const OUTCOME_LABELS: Record<OutcomeKey, string> = {
  human: 'human',
  voicemail: 'voicemail',
  no_answer: 'no answer',
  other: 'other',
};

export const OUTCOME_TONES: Record<OutcomeKey, Tone> = {
  human: 'emerald',
  voicemail: 'amber',
  no_answer: 'orange',
  other: 'slate',
};
