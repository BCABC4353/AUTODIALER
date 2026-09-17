import Database from 'better-sqlite3';
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { Attempt, Patient, ResultRow } from '../shared/types';
import { attemptCost, durationsFor } from '../shared/pricing';

const LEGACY_DIR = 'C:\\Users\\Brendan Cameron\\Desktop\\AUTODIALER';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS patients (
    run TEXT PRIMARY KEY,
    phone TEXT,
    patient TEXT,
    balance REAL,
    consent INTEGER NOT NULL DEFAULT 0,
    dnc INTEGER NOT NULL DEFAULT 0,
    tz TEXT
);

CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run TEXT NOT NULL,
    phone TEXT,
    attempted_at TEXT NOT NULL,
    contact_id TEXT,
    outcome TEXT,
    talk_seconds INTEGER,
    agent_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_attempts_run_attempted_at
    ON attempts (run, attempted_at);
`;

export function userDataFile(name: string): string {
  return path.join(app.getPath('userData'), name);
}

function importLegacyOnce(): void {
  const target = userDataFile('state.sqlite');
  if (fs.existsSync(target)) return;
  const legacy = path.join(LEGACY_DIR, 'state.sqlite');
  if (!fs.existsSync(legacy)) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(legacy, target);
  for (const suffix of ['-wal', '-shm']) {
    if (fs.existsSync(legacy + suffix)) fs.copyFileSync(legacy + suffix, target + suffix);
  }
  const campaign = path.join(LEGACY_DIR, 'campaign.json');
  const campaignTarget = userDataFile('campaign.json');
  if (fs.existsSync(campaign) && !fs.existsSync(campaignTarget)) fs.copyFileSync(campaign, campaignTarget);
}

export type Db = Database.Database;

export function openDb(): Db {
  importLegacyOnce();
  const file = userDataFile('state.sqlite');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  const columns = new Set((db.prepare('PRAGMA table_info(attempts)').all() as { name: string }[]).map((c) => c.name));
  if (!columns.has('dial_seconds')) db.exec('ALTER TABLE attempts ADD COLUMN dial_seconds INTEGER');
  if (!columns.has('answer_seconds')) db.exec('ALTER TABLE attempts ADD COLUMN answer_seconds INTEGER');
  if (!columns.has('agent_id')) db.exec('ALTER TABLE attempts ADD COLUMN agent_id TEXT');
  if (!columns.has('detail_json')) db.exec('ALTER TABLE attempts ADD COLUMN detail_json TEXT');
  if (!columns.has('analysis_json')) db.exec('ALTER TABLE attempts ADD COLUMN analysis_json TEXT');
  if (!columns.has('summary')) db.exec('ALTER TABLE attempts ADD COLUMN summary TEXT');
  return db;
}

export function attemptById(db: Db, id: number): Attempt | undefined {
  return db.prepare('SELECT * FROM attempts WHERE id=?').get(id) as Attempt | undefined;
}

export function saveDetail(db: Db, id: number, detailJson: string, agentId: string | null): void {
  db.prepare('UPDATE attempts SET detail_json=?, agent_id=? WHERE id=?').run(detailJson, agentId, id);
}

export function saveAnalysis(db: Db, id: number, analysisJson: string, summary: string | null, fillNote: boolean): void {
  db.prepare('UPDATE attempts SET analysis_json=?, summary=? WHERE id=?').run(analysisJson, summary, id);
  if (fillNote && summary) {
    db.prepare("UPDATE attempts SET agent_note=? WHERE id=? AND (agent_note IS NULL OR agent_note='')").run(summary, id);
  }
}

export function attemptsAwaitingAnalysis(db: Db, sinceUtcText: string): Attempt[] {
  return db
    .prepare(
      'SELECT * FROM attempts WHERE outcome IS NOT NULL AND contact_id IS NOT NULL AND agent_id IS NOT NULL ' +
        'AND attempted_at>=? AND (analysis_json IS NULL OR analysis_json LIKE \'%"status":"pending"%\' OR analysis_json LIKE \'%"characteristics":null%\') ORDER BY attempted_at',
    )
    .all(sinceUtcText) as Attempt[];
}

export function attemptsWithAgent(db: Db, sinceUtcText: string | null): Attempt[] {
  if (sinceUtcText === null) {
    return db.prepare('SELECT * FROM attempts WHERE agent_id IS NOT NULL ORDER BY attempted_at').all() as Attempt[];
  }
  return db
    .prepare('SELECT * FROM attempts WHERE agent_id IS NOT NULL AND attempted_at>=? ORDER BY attempted_at')
    .all(sinceUtcText) as Attempt[];
}

export interface PatientInput {
  run: string;
  phone: string | null;
  patient: string;
  balance: number | null;
  tz: string | null;
}

export function listPatients(db: Db): Patient[] {
  return db.prepare('SELECT * FROM patients WHERE consent=1 ORDER BY run').all() as Patient[];
}

export function replacePatients(db: Db, rows: PatientInput[]): { added: number; dropped: number } {
  const stmt = db.prepare(
    'INSERT INTO patients (run, phone, patient, balance, consent, dnc, tz) VALUES (?,?,?,?,1,0,?) ' +
      'ON CONFLICT(run) DO UPDATE SET phone=excluded.phone, patient=excluded.patient, ' +
      'balance=excluded.balance, tz=excluded.tz, consent=1',
  );
  const run = db.transaction((items: PatientInput[]) => {
    const before = new Set((db.prepare('SELECT run FROM patients WHERE consent=1').all() as { run: string }[]).map((r) => r.run));
    db.prepare('UPDATE patients SET consent=0').run();
    let added = 0;
    for (const r of items) {
      stmt.run(r.run, r.phone, r.patient, r.balance, r.tz);
      if (!before.has(r.run)) added += 1;
      before.delete(r.run);
    }
    return { added, dropped: before.size };
  });
  return run(rows);
}

export function toggleDnc(db: Db, run: string): void {
  db.prepare('UPDATE patients SET dnc = CASE dnc WHEN 1 THEN 0 ELSE 1 END WHERE run=?').run(run);
}

export function setDnc(db: Db, run: string, value: number): boolean {
  const before = db.prepare('SELECT dnc FROM patients WHERE run=?').get(run) as { dnc: number } | undefined;
  if (!before || before.dnc === value) return false;
  db.prepare('UPDATE patients SET dnc=? WHERE run=?').run(value, run);
  return true;
}

export function setAgentNote(db: Db, id: number, note: string): void {
  db.prepare('UPDATE attempts SET agent_note=? WHERE id=?').run(note, id);
}

export function attemptsSince(db: Db, run: string, sinceUtcText: string): number {
  const row = db
    .prepare('SELECT COUNT(*) AS n FROM attempts WHERE run=? AND attempted_at>=?')
    .get(run, sinceUtcText) as { n: number };
  return row.n;
}

export function lastAttempt(db: Db, run: string): Attempt | undefined {
  return db
    .prepare('SELECT * FROM attempts WHERE run=? ORDER BY attempted_at DESC, id DESC LIMIT 1')
    .get(run) as Attempt | undefined;
}

export function pendingAttempts(db: Db, sinceUtcText: string): Attempt[] {
  return db
    .prepare('SELECT * FROM attempts WHERE outcome IS NULL AND attempted_at>=? ORDER BY attempted_at, id')
    .all(sinceUtcText) as Attempt[];
}

export function openAttemptsBefore(db: Db, beforeUtcText: string): Attempt[] {
  return db
    .prepare('SELECT * FROM attempts WHERE outcome IS NULL AND attempted_at<? ORDER BY attempted_at, id')
    .all(beforeUtcText) as Attempt[];
}

export function insertAttempt(db: Db, run: string, phone: string, stamp: string): void {
  db.prepare('INSERT INTO attempts (run, phone, attempted_at) VALUES (?,?,?)').run(run, phone, stamp);
}

export function latestOpenAttempt(db: Db, run: string): Attempt | undefined {
  return db
    .prepare('SELECT * FROM attempts WHERE run=? AND outcome IS NULL ORDER BY attempted_at DESC, id DESC LIMIT 1')
    .get(run) as Attempt | undefined;
}

export function resolveAttempt(
  db: Db,
  id: number,
  contactId: string,
  outcome: string,
  talkSeconds: number | null,
  agentNote: string | null,
  dialSeconds: number | null,
  answerSeconds: number | null,
): void {
  db.prepare(
    'UPDATE attempts SET contact_id=?, outcome=?, talk_seconds=?, agent_note=?, dial_seconds=?, answer_seconds=? WHERE id=?',
  ).run(contactId, outcome, talkSeconds, agentNote, dialSeconds, answerSeconds, id);
}

export function expireAttempt(db: Db, id: number, outcome: string): void {
  db.prepare('UPDATE attempts SET outcome=? WHERE id=?').run(outcome, id);
}

export function patientByRun(db: Db, run: string): Patient | undefined {
  return db.prepare('SELECT * FROM patients WHERE run=?').get(run) as Patient | undefined;
}

type JoinedRow = Attempt & { patient: string | null; balance: number | null };

function priced(row: JoinedRow): ResultRow {
  if (!row.outcome) return { ...row, cost: 0, cost_estimated: false };
  const d = durationsFor(row.dial_seconds, row.answer_seconds, row.outcome, row.talk_seconds);
  return { ...row, cost: attemptCost(d), cost_estimated: d.estimated };
}

export function listResults(db: Db, limit = 500): ResultRow[] {
  return (
    db
      .prepare(
        'SELECT a.*, p.patient, p.balance FROM attempts a LEFT JOIN patients p ON p.run=a.run ' +
          'ORDER BY a.attempted_at DESC, a.id DESC LIMIT ?',
      )
      .all(limit) as JoinedRow[]
  ).map(priced);
}

export function allResults(db: Db): ResultRow[] {
  return (
    db
      .prepare(
        'SELECT a.*, p.patient, p.balance FROM attempts a LEFT JOIN patients p ON p.run=a.run ' +
          'ORDER BY a.attempted_at, a.id',
      )
      .all() as JoinedRow[]
  ).map(priced);
}

export function allAttempts(db: Db): Attempt[] {
  return db.prepare('SELECT * FROM attempts ORDER BY attempted_at, id').all() as Attempt[];
}

export function clearAttempts(db: Db): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM attempts').get() as { n: number };
  db.prepare('DELETE FROM attempts').run();
  return row.n;
}

export function attemptsSinceAll(db: Db, sinceUtcText: string): Attempt[] {
  return db
    .prepare('SELECT * FROM attempts WHERE attempted_at>=? ORDER BY attempted_at, id')
    .all(sinceUtcText) as Attempt[];
}
