import fs from 'node:fs';
import { normalizePhone } from '../shared/phone';
import { tzForPhone } from '../shared/tz';
import type { PatientInput } from './db';

const COLUMNS = ['NAME', 'BALANCE', 'RUN NUMBER', 'PHONE'] as const;

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

export function loadCsv(file: string): PatientInput[] {
  const text = fs.readFileSync(file, 'utf8');
  const rows = parseCsv(text);
  const header = rows[0];
  if (!header) throw new Error('empty file');
  const index = new Map<string, number>();
  header.forEach((h, i) => index.set(h.trim().toUpperCase(), i));
  const missing = COLUMNS.filter((c) => !index.has(c));
  if (missing.length) throw new Error('missing columns: ' + missing.join(', '));
  const col = (row: string[], name: (typeof COLUMNS)[number]) => row[index.get(name) as number] ?? '';
  const out: PatientInput[] = [];
  for (const row of rows.slice(1)) {
    const run = col(row, 'RUN NUMBER').trim();
    if (!run) continue;
    const phone = normalizePhone(col(row, 'PHONE'));
    out.push({
      run,
      patient: col(row, 'NAME').trim(),
      balance: parseBalance(col(row, 'BALANCE')),
      phone,
      tz: tzForPhone(phone),
    });
  }
  return out;
}

export function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}
