import { app } from 'electron';
import type { OutboundRequest } from '@aws-sdk/client-connectcampaignsv2';
import type { Contact } from '@aws-sdk/client-connect';
import {
  attemptsSince,
  attemptsSinceAll,
  clearAttempts,
  expireAttempt,
  insertAttempt,
  lastAttempt,
  latestOpenAttempt,
  listPatients,
  openAttemptsBefore,
  openDb,
  patientByRun,
  pendingAttempts,
  resolveAttempt,
  type Db,
} from './db';
import { Aws, buildRequest } from './aws';
import { evaluate, type DropReason } from '../shared/rules';
import { normalizePhone } from '../shared/phone';
import { outcomeKey, outcomeLabel, outcomeTone, EXPIRED_OUTCOME, HUMAN_OUTCOME, OUTCOME_LABELS } from '../shared/outcome';
import { clockStamp, toUtcText, parseUtcText } from '../shared/time';
import type {
  DialerEvent,
  DialerStatus,
  LogLine,
  NowState,
  Patient,
  RunState,
  SessionStats,
  Stats,
  Tone,
} from '../shared/types';

export const EXPIRY_MINUTES = 5;
export const PIPELINE_DEPTH = 2;
const TICK_MS = 10_000;
const POLL_MS = 2_000;
const STALE_MINUTES = 15;
const LOG_CAP = 600;
const NEXT_CACHE_MS = 10_000;

type Listener = (event: DialerEvent) => void;

const REASON_LABELS: Record<DropReason, [string, string]> = {
  consent: ['without consent', 'without consent'],
  dnc: ['on do not call', 'on do not call'],
  phone: ['with an invalid phone', 'with an invalid phone'],
  attempt_24h: ['called in the last 24 hours', 'called in the last 24 hours'],
  attempts_7d: ['at 3 attempts this week', 'at 3 attempts this week'],
  already_handled: ['already handled by an agent', 'already handled by an agent'],
  unknown_tz: ['with an unknown time zone', 'with an unknown time zone'],
  outside_hours: ['outside calling hours', 'outside calling hours'],
  same_block: ['waiting for a different time of day', 'waiting for a different time of day'],
};

function nobodyToCall(dropped: Record<string, number>): string {
  const parts = Object.entries(dropped)
    .sort((a, b) => b[1] - a[1])
    .map(([reason, n]) => `${n} ${REASON_LABELS[reason as DropReason]?.[n === 1 ? 0 : 1] ?? reason}`);
  return parts.length ? `nobody to call right now: ${parts.join(', ')}` : 'nobody to call: the patient list is empty';
}

function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function idleNow(): NowState {
  return { contactId: null, name: '—', run: '', balance: '', status: 'idle', tone: 'slate', kind: 'idle' };
}

export class Dialer {
  db: Db;
  private aws: Aws | null = null;
  private listeners = new Set<Listener>();
  runState: RunState = 'stopped';
  campaignState = 'unknown';
  agentAvailable: boolean | null = null;
  stats: Stats = { sent: 0, human: 0, voicemail: 0, no_answer: 0, other: 0 };
  private seen = new Set<string>();
  private lastOutcome = '';
  private liveWithAgent = false;
  private liveRuns = new Set<string>();
  private now: NowState = idleNow();
  private log: LogLine[] = [];
  private pushing = false;
  private polling = false;
  private holdingLogged = false;
  private lastNoEligible = '';
  private lastNowKey = '';
  private nextCache: { at: number; patient: Patient | null } = { at: 0, patient: null };
  private tickTimer: NodeJS.Timeout | null = null;
  private pollTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.db = openDb();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: DialerEvent): void {
    for (const l of this.listeners) l(event);
  }

  startLoops(): void {
    this.tickTimer = setInterval(() => void this.tick(), TICK_MS);
    this.pollTimer = setInterval(() => void this.poll(), POLL_MS);
    void this.probe();
  }

  private async probe(): Promise<void> {
    try {
      this.aws = this.aws ?? new Aws();
      this.campaignState = await this.aws.campaignState();
      this.logLine(`campaign ${this.aws.campaign.name} is ${this.campaignState.toLowerCase()}`);
    } catch (err) {
      this.aws = null;
      this.logLine(`AWS: ${err instanceof Error ? err.message : String(err)}`, 'err');
    }
    this.emitStatus();
  }

  stopLoops(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  logLine(text: string, level: LogLine['level'] = ''): void {
    const line: LogLine = { ts: clockStamp(), text, level };
    this.log.push(line);
    if (this.log.length > LOG_CAP) this.log.splice(0, this.log.length - LOG_CAP);
    this.emit({ type: 'log', line });
  }

  logLines(): LogLine[] {
    return this.log;
  }

  private describePatient(run: string, name?: string | null, balance?: number | null): string {
    const p = patientByRun(this.db, run);
    const label = name ?? p?.patient ?? '';
    const bal = balance ?? p?.balance ?? null;
    return `${run}  ${label}  ${money(bal)}`.trim();
  }

  status(): DialerStatus {
    return {
      runState: this.runState,
      campaignState: this.campaignState,
      campaignName: this.aws?.campaign.name ?? '',
      agentAvailable: this.agentAvailable,
      stats: { ...this.stats },
      now: this.now,
      pending: this.pendingCount(),
      version: app.getVersion(),
    };
  }

  private emitStatus(): void {
    this.emit({ type: 'status', status: this.status() });
  }

  isLiveWithAgent(): boolean {
    return this.liveWithAgent;
  }

  async start(): Promise<void> {
    if (this.runState !== 'stopped') return;
    this.runState = 'starting';
    this.emitStatus();
    try {
      this.aws = this.aws ?? new Aws();
      const state = await this.aws.ensureRunning();
      this.campaignState = state;
      if (state !== 'Running') {
        this.runState = 'stopped';
        this.emitStatus();
        this.fail('Campaign', `Campaign is ${state} and did not start.`);
        return;
      }
    } catch (err) {
      this.runState = 'stopped';
      this.emitStatus();
      this.fail('AWS', err instanceof Error ? err.message : String(err));
      return;
    }
    this.runState = 'running';
    if (this.aws.note) {
      this.logLine(this.aws.note);
      this.aws.note = null;
    }
    this.logLine('dialing started', 'ok');
    this.emitStatus();
    void this.tick();
  }

  async stop(): Promise<void> {
    if (this.runState === 'stopped' || this.runState === 'stopping') return;
    this.runState = 'stopping';
    this.emitStatus();
    if (this.aws) {
      await this.aws.pauseCampaign();
      try {
        this.campaignState = await this.aws.campaignState();
      } catch {
        this.campaignState = 'Paused';
      }
    }
    this.runState = 'stopped';
    this.lastNowKey = '';
    this.logLine('dialing paused');
    this.emitStatus();
  }

  async pauseForShutdown(): Promise<void> {
    if (this.runState === 'running' && this.aws) {
      this.runState = 'stopped';
      await this.aws.pauseCampaign();
    }
  }

  private fail(title: string, message: string): void {
    this.logLine(`${title}: ${message}`, 'err');
    this.emit({ type: 'error', title, message });
  }

  private pendingCount(): number {
    const since = toUtcText(new Date(Date.now() - EXPIRY_MINUTES * 60 * 1000));
    return pendingAttempts(this.db, since).length;
  }

  private ruleContext() {
    return {
      attemptsSince: (run: string, since: string) => attemptsSince(this.db, run, since),
      lastAttempt: (run: string) => lastAttempt(this.db, run),
    };
  }

  private nextEligible(now: Date): { patient: Patient | null; dropped: Record<string, number> } {
    const dropped: Record<string, number> = {};
    const ctx = this.ruleContext();
    for (const patient of listPatients(this.db)) {
      const reason = evaluate(patient, now, ctx);
      if (reason) {
        dropped[reason] = (dropped[reason] ?? 0) + 1;
        continue;
      }
      return { patient, dropped };
    }
    return { patient: null, dropped };
  }

  private cachedNext(): Patient | null {
    const at = Date.now();
    if (at - this.nextCache.at > NEXT_CACHE_MS) {
      this.nextCache = { at, patient: this.nextEligible(new Date()).patient };
    }
    return this.nextCache.patient;
  }

  requestTick(): void {
    this.nextCache.at = 0;
    void this.tick();
  }

  private async tick(): Promise<void> {
    if (this.runState !== 'running' || !this.aws || this.pushing) return;
    this.pushing = true;
    try {
      await this.pushBatch();
    } catch (err) {
      this.logLine(`push error: ${err instanceof Error ? err.message : String(err)}`, 'err');
    } finally {
      this.pushing = false;
    }
  }

  private async pushBatch(): Promise<void> {
    if (!this.aws) return;
    if (this.pendingCount() >= PIPELINE_DEPTH) return;
    const snapshot = await this.aws.agentSnapshot();
    this.agentAvailable = snapshot.reachable ? snapshot.available : null;
    if (!snapshot.available) {
      if (!this.holdingLogged) this.logLine('no agent is available on the queue, holding until one goes Available');
      this.holdingLogged = true;
      this.emitStatus();
      return;
    }
    if (this.holdingLogged) this.logLine('agent available, dialing resumes', 'ok');
    this.holdingLogged = false;
    const now = new Date();
    const { patient, dropped } = this.nextEligible(now);
    this.nextCache = { at: Date.now(), patient };
    if (!patient) {
      const text = nobodyToCall(dropped);
      if (text !== this.lastNoEligible) {
        this.lastNoEligible = text;
        this.logLine(text);
      }
      this.emitStatus();
      return;
    }
    this.lastNoEligible = '';
    const phone = normalizePhone(patient.phone) as string;
    const request: OutboundRequest = buildRequest(patient.run, phone, patient.patient, patient.balance, now, EXPIRY_MINUTES);
    const { accepted, failed } = await this.aws.send([request]);
    const tokens = new Set(accepted.map((a) => a.clientToken));
    const stamp = toUtcText(new Date());
    if (tokens.has(request.clientToken)) {
      insertAttempt(this.db, patient.run, '+1' + phone, stamp);
      this.stats.sent += 1;
      this.logLine(`calling  ${this.describePatient(patient.run, patient.patient, patient.balance)}`, 'ok');
    }
    for (const f of failed) {
      this.logLine(`could not queue  ${this.describePatient(patient.run, patient.patient, patient.balance)}  ${f.failureCode ?? ''}`, 'err');
    }
    this.nextCache.at = 0;
    this.emit({ type: 'results' });
    this.emitStatus();
  }

  private async poll(): Promise<void> {
    if (!this.aws || this.polling) return;
    this.polling = true;
    try {
      await this.pollContacts();
    } catch (err) {
      this.logLine(`poll error: ${err instanceof Error ? err.message : String(err)}`, 'err');
    } finally {
      this.polling = false;
    }
  }

  private async pollContacts(): Promise<void> {
    if (!this.aws) return;
    const snapshot = await this.aws.agentSnapshot();
    if (snapshot.reachable) this.agentAvailable = snapshot.available;
    const ids = [...snapshot.contactIds];
    for (const id of await this.aws.recentContactIds()) if (!ids.includes(id)) ids.push(id);
    let live: { id: string; contact: Contact; attrs: Record<string, string> } | null = null;
    const liveRuns = new Set<string>();
    for (const id of ids) {
      if (this.seen.has(id)) continue;
      let contact: Contact;
      try {
        contact = await this.aws.describe(id);
      } catch {
        continue;
      }
      const attrs = await this.aws.attributes(id);
      if (!contact.DisconnectTimestamp) {
        if (attrs.RUN) liveRuns.add(attrs.RUN);
        if (!live) live = { id, contact, attrs };
        continue;
      }
      this.recordOutcome(id, contact, attrs);
      this.seen.add(id);
    }
    this.liveRuns = liveRuns;
    this.expireStale();
    this.updateNow(live);
  }

  private expireStale(): void {
    const before = toUtcText(new Date(Date.now() - STALE_MINUTES * 60 * 1000));
    let expired = 0;
    for (const attempt of openAttemptsBefore(this.db, before)) {
      if (this.liveRuns.has(attempt.run)) continue;
      expireAttempt(this.db, attempt.id, EXPIRED_OUTCOME);
      this.stats.no_answer += 1;
      expired += 1;
      this.logLine(`gave up  ${this.describePatient(attempt.run)}  no call went out within ${STALE_MINUTES} minutes`);
    }
    if (expired) {
      this.emit({ type: 'results' });
      this.requestTick();
    }
  }

  private updateNow(live: { id: string; contact: Contact; attrs: Record<string, string> } | null): void {
    let next: NowState;
    this.liveWithAgent = false;
    if (live) {
      const withAgent = Boolean(live.contact.AgentInfo?.ConnectedToAgentTimestamp);
      this.liveWithAgent = withAgent;
      const amd = live.contact.AnsweringMachineDetectionStatus;
      const status = withAgent ? 'on the line' : (amd ?? 'ringing').replace(/_/g, ' ').toLowerCase();
      const patient = live.attrs.RUN ? patientByRun(this.db, live.attrs.RUN) : undefined;
      next = {
        contactId: live.id,
        name: live.attrs.PATIENT || patient?.patient || '?',
        run: live.attrs.RUN ? `RUN ${live.attrs.RUN}` : '',
        balance: live.attrs.BALANCE ? '$' + live.attrs.BALANCE : money(patient?.balance),
        status,
        tone: withAgent ? 'emerald' : 'orange',
        kind: 'live',
      };
    } else {
      const since = toUtcText(new Date(Date.now() - EXPIRY_MINUTES * 60 * 1000));
      const queued = pendingAttempts(this.db, since)[0];
      if (queued) {
        const patient = patientByRun(this.db, queued.run);
        next = {
          contactId: 'queued:' + queued.run,
          name: patient?.patient || queued.run,
          run: `RUN ${queued.run}`,
          balance: money(patient?.balance),
          status: 'dialing',
          tone: 'amber',
          kind: 'dialing',
        };
      } else {
        const upcoming = this.runState === 'running' ? this.cachedNext() : null;
        if (upcoming) {
          next = {
            contactId: 'next:' + upcoming.run,
            name: upcoming.patient || upcoming.run,
            run: `RUN ${upcoming.run}`,
            balance: money(upcoming.balance),
            status: 'up next',
            tone: 'slate',
            kind: 'next',
          };
        } else {
          const label = this.lastOutcome ? 'last ' + outcomeLabel(this.lastOutcome) : 'idle';
          const tone: Tone = this.lastOutcome ? outcomeTone(this.lastOutcome) : 'slate';
          next = { ...idleNow(), status: label, tone };
        }
      }
    }
    const changed =
      next.contactId !== this.now.contactId ||
      next.status !== this.now.status ||
      next.name !== this.now.name ||
      next.kind !== this.now.kind;
    this.now = next;
    if (changed) {
      this.emit({ type: 'now', now: next });
      this.narrate(next);
    }
  }

  private narrate(now: NowState): void {
    const key = `${now.kind}:${now.contactId ?? ''}:${now.status}`;
    if (key === this.lastNowKey) return;
    this.lastNowKey = key;
    const who = `${now.run.replace(/^RUN /, '')}  ${now.name}  ${now.balance}`.trim();
    if (now.kind === 'live') {
      if (now.status === 'on the line') this.logLine(`on the line  ${who}  talk now`, 'ok');
      else this.logLine(`${now.status}  ${who}`);
    } else if (now.kind === 'next') {
      this.logLine(`up next  ${who}`);
    }
  }

  private recordOutcome(contactId: string, contact: Contact, attrs: Record<string, string>): void {
    const run = attrs.RUN;
    if (!run) return;
    const outcome = contact.AnsweringMachineDetectionStatus || contact.DisconnectReason || 'UNKNOWN';
    let talk: number | null = null;
    const connected = contact.AgentInfo?.ConnectedToAgentTimestamp;
    if (connected && contact.DisconnectTimestamp) {
      talk = Math.floor((contact.DisconnectTimestamp.getTime() - connected.getTime()) / 1000);
    }
    const open = latestOpenAttempt(this.db, run);
    if (!open) return;
    const note = attrs.AGENT_NOTE || attrs.AgentNote || attrs.DISPOSITION_NOTE || attrs.DispositionNote || attrs.DISPOSITION || null;
    resolveAttempt(this.db, open.id, contactId, outcome, talk, note);
    this.lastOutcome = outcome;
    this.stats[outcomeKey(outcome)] += 1;
    const detail = talk ? `  ${talk}s on the line` : '';
    const verdict =
      outcomeKey(outcome) === 'voicemail'
        ? 'voicemail, moving on'
        : outcomeKey(outcome) === 'no_answer'
          ? 'no answer, moving on'
          : outcome === HUMAN_OUTCOME
            ? 'call finished'
            : `${outcomeLabel(outcome)}, moving on`;
    this.logLine(`${verdict}  ${this.describePatient(run, attrs.PATIENT)}${detail}`, outcome === HUMAN_OUTCOME ? 'ok' : '');
    this.nextCache.at = 0;
    this.emit({ type: 'results' });
    this.emitStatus();
    void this.tick();
  }

  clearHistory(): number {
    const n = clearAttempts(this.db);
    this.seen.clear();
    this.lastOutcome = '';
    this.lastNoEligible = '';
    this.stats = { sent: 0, human: 0, voicemail: 0, no_answer: 0, other: 0 };
    this.logLine(`cleared ${n} attempt records`);
    this.emit({ type: 'results' });
    this.emitStatus();
    this.requestTick();
    return n;
  }

  sessionStats(): SessionStats {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const today = attemptsSinceAll(this.db, toUtcText(dayStart));
    const counts = { human: 0, voicemail: 0, no_answer: 0, other: 0 };
    let completed = 0;
    for (const a of today) {
      if (!a.outcome) continue;
      completed += 1;
      counts[outcomeKey(a.outcome)] += 1;
    }
    const hours = 12;
    const now = new Date();
    const start = new Date(now.getTime());
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() - (hours - 1));
    const labels: string[] = [];
    const attempts: number[] = [];
    const human: number[] = [];
    for (let i = 0; i < hours; i += 1) {
      const h = new Date(start.getTime() + i * 3600 * 1000);
      labels.push(`${String(h.getHours()).padStart(2, '0')}:00`);
      attempts.push(0);
      human.push(0);
    }
    for (const a of attemptsSinceAll(this.db, toUtcText(start))) {
      const at = parseUtcText(a.attempted_at);
      if (!at) continue;
      const idx = Math.floor((at.getTime() - start.getTime()) / 3600000);
      if (idx < 0 || idx >= hours) continue;
      attempts[idx] = (attempts[idx] ?? 0) + 1;
      if (a.outcome === HUMAN_OUTCOME) human[idx] = (human[idx] ?? 0) + 1;
    }
    return {
      outcomes: (['human', 'voicemail', 'no_answer', 'other'] as const).map((key) => ({
        key,
        label: OUTCOME_LABELS[key],
        value: counts[key],
      })),
      completed,
      human: counts.human,
      sent: today.length,
      trend: { labels, attempts, human },
    };
  }
}
