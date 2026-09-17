import { outcomeKey } from './outcome';

export interface Rates {
  campaignPerMinute: number;
  voicePerMinute: number;
  telephonyPerMinute: number;
  perCall: number;
}

export const RATES: Rates = {
  campaignPerMinute: 0.045,
  voicePerMinute: 0.038,
  telephonyPerMinute: 0.0048,
  perCall: 0,
};

export const RATE_LABELS: { key: keyof Rates; label: string; unit: string; source: string }[] = [
  { key: 'campaignPerMinute', label: 'campaign minute', unit: 'from dial start', source: 'billed USW2-ai-high-volume-traffic-end-customer-mins' },
  { key: 'voicePerMinute', label: 'voice minute', unit: 'from answer', source: 'billed USW2-ai-end-customer-mins' },
  { key: 'telephonyPerMinute', label: 'telephony minute', unit: 'US outbound', source: 'published rate, not yet on the bill' },
  { key: 'perCall', label: 'per call', unit: 'attempt', source: 'billed USW2-ai-Outbound-Campaigns-Voice-calls' },
];

export interface Durations {
  dialSeconds: number;
  answerSeconds: number;
  estimated: boolean;
}

export function estimateDurations(outcome: string | null | undefined, talkSeconds: number | null | undefined): Durations {
  const talk = talkSeconds ?? 0;
  switch (outcomeKey(outcome)) {
    case 'human':
      return { dialSeconds: 25 + talk + 8, answerSeconds: talk + 8, estimated: true };
    case 'voicemail':
      return { dialSeconds: 45, answerSeconds: 30, estimated: true };
    case 'no_answer':
      return { dialSeconds: 20, answerSeconds: 0, estimated: true };
    default:
      return { dialSeconds: 20, answerSeconds: 10, estimated: true };
  }
}

export function durationsFor(
  dialSeconds: number | null | undefined,
  answerSeconds: number | null | undefined,
  outcome: string | null | undefined,
  talkSeconds: number | null | undefined,
): Durations {
  if (dialSeconds !== null && dialSeconds !== undefined) {
    return { dialSeconds, answerSeconds: answerSeconds ?? 0, estimated: false };
  }
  return estimateDurations(outcome, talkSeconds);
}

export function attemptCost(d: Durations, rates: Rates = RATES): number {
  return (
    rates.perCall +
    (d.dialSeconds / 60) * rates.campaignPerMinute +
    (d.answerSeconds / 60) * (rates.voicePerMinute + rates.telephonyPerMinute)
  );
}

export function formatCost(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value >= 1) return '$' + value.toFixed(2);
  return '$' + value.toFixed(3);
}
