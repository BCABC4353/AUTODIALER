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

export function formatTripDate(value: string | undefined): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`;
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (us) {
    const year = (us[3] as string).length === 2 ? `20${us[3]}` : (us[3] as string);
    return `${(us[1] as string).padStart(2, '0')}/${(us[2] as string).padStart(2, '0')}/${year}`;
  }
  return text;
}

export function loadCsv(file: string): PatientInput[] {
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
  const out: PatientInput[] = [];
  for (const row of rows.slice(1)) {
    const run = col(row, layout.run).trim();
    if (!run) continue;
    const phone = normalizePhone(col(row, layout.phone));
    out.push({
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
  return out;
}

export function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}
