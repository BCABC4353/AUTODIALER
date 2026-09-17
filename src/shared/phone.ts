export function normalizePhone(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\bext\.?.*$/i, '');
  let digits = text.replace(/\D+/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (digits.length !== 10) return null;
  if (/^0+$/.test(digits)) return null;
  if ('01'.includes(digits[0] as string) || '01'.includes(digits[3] as string)) return null;
  return digits;
}

export function isPlaceholderPhone(value: unknown): boolean {
  const digits = String(value ?? '').replace(/\D+/g, '');
  return digits.length > 0 && /^0+$/.test(digits);
}

export function e164(digits: string): string {
  return '+1' + digits;
}

export function stripE164(value: string | null | undefined): string {
  const text = value ?? '';
  return text.startsWith('+1') ? text.slice(2) : text;
}

export function formatPhone(digits: string | null | undefined): string {
  if (!digits || digits.length !== 10) return 'INVALID';
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
