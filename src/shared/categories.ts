export type CategoryEffect = 'dnc' | 'handled' | 'paid' | 'callback' | 'flag';

export interface CategoryRule {
  name: string;
  label: string;
  effect: CategoryEffect;
  note: string;
}

export const CATEGORY_RULES: CategoryRule[] = [
  { name: 'autodialer-payment-taken', label: 'payment taken', effect: 'paid', note: 'Payment taken on the call' },
  { name: 'autodialer-stop-calling', label: 'asked not to be called', effect: 'dnc', note: 'Asked not to be called' },
  { name: 'autodialer-wrong-number', label: 'wrong number', effect: 'dnc', note: 'Wrong number' },
  { name: 'autodialer-promised-to-pay', label: 'promised to pay', effect: 'handled', note: 'Promised to pay' },
  { name: 'autodialer-payment-plan', label: 'asked about a payment plan', effect: 'handled', note: 'Asked about a payment plan' },
  { name: 'autodialer-disputes-balance', label: 'disputes the balance', effect: 'handled', note: 'Disputes the balance' },
  { name: 'autodialer-callback-requested', label: 'asked for a callback', effect: 'callback', note: 'Asked for a callback' },
  { name: 'autodialer-wants-transfer', label: 'wants a supervisor or billing', effect: 'flag', note: 'Wants a supervisor or billing' },
  { name: 'autodialer-upset-patient', label: 'upset patient', effect: 'flag', note: 'Upset patient' },
  { name: 'autodialer-escalation', label: 'call turned negative', effect: 'flag', note: 'Call turned negative' },
  { name: 'autodialer-long-silence', label: 'long silence', effect: 'flag', note: 'Long silence on the call' },
  { name: 'autodialer-identity-not-verified', label: 'identity not verified', effect: 'flag', note: 'Identity not verified on the call' },
  { name: 'autodialer-live-upset', label: 'upset during the call', effect: 'flag', note: 'Upset during the call' },
];

export const HIDDEN_CATEGORIES = new Set(['autodialer-extract', 'autodialer-extract-acw']);

const BY_NAME = new Map(CATEGORY_RULES.map((r) => [r.name, r]));

export function categoryRule(name: string): CategoryRule | undefined {
  return BY_NAME.get(name);
}

export function categoryLabel(name: string): string {
  return BY_NAME.get(name)?.label ?? name.replace(/^autodialer-/, '').replace(/-/g, ' ');
}

export function categoryEffect(name: string): CategoryEffect | null {
  return BY_NAME.get(name)?.effect ?? null;
}
