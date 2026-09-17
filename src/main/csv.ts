import fs from 'node:fs';
import { normalizePhone } from '../shared/phone';
import { tzForPhone } from '../shared/tz';
import type { PatientInput } from './db';

const LAYOUTS: { name: string; run: string; patient: string; phone: string; balance: string; tripDate?: string; schedule?: string; event?: string }[] = [
  { name: 'dataflow', run: 'RUN', patient: 'PATIENT', phone: 'HOME PHONE', balance: 'BALANCE', tripDate: 'TRIP DATE', schedule: 'SCHEDULE', event: 'EVENT' },
  { name: 'template', run: 'RUN NUMBER', patient: 'NAME', phone: 'PHONE', balance: 'BALANCE' },
];

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  while (i < src.length) {
    const ch = src[i] as string;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export function parseBalance(value: string | undefined): number | null {
  let text = String(value ?? '').replace(/\$/g, '').replace(/,/g, '').trim();
  if (text.startsWith('(') && text.endsWith(')')) text = '-' + text.slice(1, -1);
  if (text === '') return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function calendarDate(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
}

export function formatTripDate(value: string | undefined): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\D|$)/);
  if (iso) return calendarDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:\D|$)/);
  if (us) {
    const year = (us[3] as string).length === 2 ? 2000 + Number(us[3]) : Number(us[3]);
    return calendarDate(year, Number(us[1]), Number(us[2]));
  }
  return null;
}

export interface LoadResult {
  rows: PatientInput[];
  duplicates: number;
}

export function loadCsv(file: string): LoadResult {
  const text = fs.readFileSync(file, 'utf8');
  const rows = parseCsv(text);
  const header = rows[0];
  if (!header) throw new Error('empty file');
  const index = new Map<string, number>();
  header.forEach((h, i) => index.set(h.trim().toUpperCase(), i));
  const layout = LAYOUTS.find((l) => [l.run, l.patient, l.phone, l.balance].every((c) => index.has(c)));
  if (!layout) {
    throw new Error('unrecognised columns; expected RUN, PATIENT, HOME PHONE, BALANCE (or NAME, BALANCE, RUN NUMBER, PHONE)');
  }
  const col = (row: string[], name: string | undefined) => (name === undefined ? '' : (row[index.get(name) as number] ?? ''));
  const out = new Map<string, PatientInput>();
  let duplicates = 0;
  for (const row of rows.slice(1)) {
    const run = col(row, layout.run).trim();
    if (!run) continue;
    if (out.has(run)) duplicates += 1;
    const phone = normalizePhone(col(row, layout.phone));
    out.set(run, {
      run,
      patient: col(row, layout.patient).trim(),
      balance: parseBalance(col(row, layout.balance)),
      phone,
      tz: tzForPhone(phone),
      tripDate: formatTripDate(col(row, layout.tripDate)),
      schedule: col(row, layout.schedule).trim() || null,
      event: col(row, layout.event).trim() || null,
    });
  }
  return { rows: [...out.values()], duplicates };
}

export function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}
