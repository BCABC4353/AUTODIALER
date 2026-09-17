import { app } from 'electron';
import type { OutboundRequest } from '@aws-sdk/client-connectcampaignsv2';
import type { Contact } from '@aws-sdk/client-connect';
import {
  allAttempts,
  attemptById,
  attemptsAwaitingAnalysis,
  attemptsSince,
  attemptsSinceAll,
  attemptsWithAgent,
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
  saveAnalysis,
  saveDetail,
  setAgentNote,
  setDnc,
  type Db,
} from './db';
import { Aws, buildRequest } from './aws';
import { buildDetail, fallbackSummary, fetchAnalysis, fetchCharacteristics, fetchRecording, findRecordingKey, keyFromLocation } from './insights';
import { categoryEffect, categoryLabel, categoryRule } from '../shared/categories';
import { evaluate, type DropReason } from '../shared/rules';
import { normalizePhone } from '../shared/phone';
import { outcomeKey, outcomeLabel, outcomeTone, EXPIRED_OUTCOME, HUMAN_OUTCOME, OUTCOME_LABELS } from '../shared/outcome';
import { clockStamp, toUtcText, parseUtcText } from '../shared/time';
import { attemptCost, durationsFor } from '../shared/pricing';
import type {
  AgentReport,
  AgentSummary,
  Attempt,
  CallAnalysis,
  CallCharacteristics,
  ContactDetail,
  CostSummary,
  DialerEvent,
  DialerStatus,
  FlaggedCall,
  InsightScope,
  InsightsReport,
  ResultDetail,
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
const ANALYSIS_POLL_MS = 60_000;
const ANALYSIS_MIN_AGE_MS = 2 * 60_000;
const ANALYSIS_GIVE_UP_MS = 60 * 60_000;

function parseJson<T>(text: string | null | undefined): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function tally(map: Map<string, number>, key: string, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

function ranked(map: Map<string, number>): { label: string; value: number }[] {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function emptyCharacteristics(): CallCharacteristics {
  return {
    durationSeconds: null,
    talkSeconds: { agent: null, customer: null },
    nonTalkSeconds: null,
    interruptions: { count: 0, seconds: 0, byAgent: 0, byCustomer: 0 },
    wordsPerMinute: { agent: null, customer: null },
    loudness: { agent: null, customer: null },
    sentiment: { agent: null, customer: null },
    sentimentByQuarter: { agent: [], customer: [] },
    issues: [],
    outcomes: [],
    actionItems: [],
  };
}

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
  return { contactId: null, name: '—', run: '', balance: '', tripDate: '', schedule: '', event: '', status: 'idle', tone: 'slate', kind: 'idle' };
}

function patientFacts(patient: Patient | undefined | null): Pick<NowState, 'tripDate' | 'schedule' | 'event'> {
  return { tripDate: patient?.trip_date ?? '', schedule: patient?.schedule ?? '', event: patient?.event ?? '' };
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
  private analysisTimer: NodeJS.Timeout | null = null;
  private analysing = false;

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
    this.analysisTimer = setInterval(() => void this.analysisSweep(), ANALYSIS_POLL_MS);
    void this.probe();
    setTimeout(() => void this.analysisSweep(), 15_000);
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
    if (this.analysisTimer) clearInterval(this.analysisTimer);
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
    const request: OutboundRequest = buildRequest(patient.run, phone, patient.patient, patient.balance, now, EXPIRY_MINUTES, patient.trip_date);
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
        ...patientFacts(patient),
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
          ...patientFacts(patient),
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
            ...patientFacts(upcoming),
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
    const ended = contact.DisconnectTimestamp;
    const started = contact.InitiationTimestamp;
    const answered = contact.ConnectedToSystemTimestamp;
    const dialSeconds = ended && started ? Math.max(0, Math.round((ended.getTime() - started.getTime()) / 1000)) : null;
    const answerSeconds = ended && answered ? Math.max(0, Math.round((ended.getTime() - answered.getTime()) / 1000)) : dialSeconds === null ? null : 0;
    resolveAttempt(this.db, open.id, contactId, outcome, talk, note, dialSeconds, answerSeconds);
    void this.captureDetail(open.id, contact);
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

  private async captureDetail(id: number, contact: Contact): Promise<ContactDetail | null> {
    try {
      const detail = await buildDetail(contact);
      saveDetail(this.db, id, JSON.stringify(detail), detail.agent?.id ?? null);
      return detail;
    } catch (err) {
      this.logLine(`call detail: ${err instanceof Error ? err.message : String(err)}`, 'err');
      return null;
    }
  }

  private async analysisSweep(): Promise<void> {
    if (this.analysing) return;
    this.analysing = true;
    try {
      const since = toUtcText(new Date(Date.now() - 24 * 3600 * 1000));
      for (const attempt of attemptsAwaitingAnalysis(this.db, since)) {
        const at = parseUtcText(attempt.attempted_at);
        const age = at ? Date.now() - at.getTime() : Infinity;
        if (age < ANALYSIS_MIN_AGE_MS) continue;
        await this.refreshAnalysis(attempt, age > ANALYSIS_GIVE_UP_MS);
      }
    } catch (err) {
      this.logLine(`analysis: ${err instanceof Error ? err.message : String(err)}`, 'err');
    } finally {
      this.analysing = false;
    }
  }

  private async refreshAnalysis(attempt: Attempt, giveUp: boolean): Promise<CallAnalysis | null> {
    if (!attempt.contact_id) return null;
    const previous = parseJson<CallAnalysis>(attempt.analysis_json);
    const analysis = previous?.status === 'ready' ? previous : await fetchAnalysis(attempt.contact_id);
    if (analysis.status === 'pending' && !giveUp) return analysis;
    if (analysis.status === 'pending') analysis.status = 'unavailable';
    if (analysis.status === 'ready' && !analysis.characteristics) {
      try {
        const file = await fetchCharacteristics(attempt.contact_id, parseUtcText(attempt.attempted_at));
        if (file) {
          analysis.characteristics = file.characteristics;
          if (!analysis.summary && file.summary) analysis.summary = file.summary;
          for (const c of file.categories) if (!analysis.categories.includes(c)) analysis.categories.push(c);
        } else if (giveUp) {
          analysis.characteristics = emptyCharacteristics();
        }
      } catch (err) {
        this.logLine(`analysis file: ${err instanceof Error ? err.message : String(err)}`, 'err');
      }
    }
    const firstReady = analysis.status === 'ready' && previous?.status !== 'ready';
    const summary = analysis.status === 'ready' ? fallbackSummary(analysis) : null;
    if (analysis.status === 'ready') analysis.actions = this.applyCategories(attempt, analysis, summary);
    saveAnalysis(this.db, attempt.id, JSON.stringify(analysis), summary, true);
    if (firstReady) {
      this.logLine(`transcript ready  ${this.describePatient(attempt.run)}${summary ? '  ' + summary : ''}`, 'ok');
      this.nextCache.at = 0;
    }
    this.emit({ type: 'analysis', id: attempt.id });
    this.emit({ type: 'results' });
    return analysis;
  }

  private applyCategories(attempt: Attempt, analysis: CallAnalysis, summary: string | null): string[] {
    const done = new Set(analysis.actions ?? []);
    const actions = [...done];
    const who = this.describePatient(attempt.run);
    let handledNote: string | null = null;
    for (const name of analysis.categories) {
      const rule = categoryRule(name);
      if (!rule || done.has(name)) continue;
      actions.push(name);
      if (rule.effect === 'dnc') {
        const changed = setDnc(this.db, attempt.run, 1);
        this.logLine(`${rule.label}  ${who}${changed ? '  marked do not call' : ''}`, 'ok');
        handledNote = handledNote ?? rule.note;
        this.emit({ type: 'patients' });
      } else if (rule.effect === 'paid') {
        handledNote = rule.note;
        this.logLine(`payment taken  ${who}`, 'ok');
      } else if (rule.effect === 'handled') {
        handledNote = handledNote ?? rule.note;
        this.logLine(`${rule.label}  ${who}  no further calls`, 'ok');
      } else if (rule.effect === 'callback') {
        this.logLine(`${rule.label}  ${who}  stays on the list`);
      } else {
        this.logLine(`${rule.label}  ${who}  flagged for review`);
      }
    }
    if (handledNote) {
      const current = attemptById(this.db, attempt.id)?.agent_note ?? '';
      if (!current || current === summary) setAgentNote(this.db, attempt.id, summary ? `${handledNote}. ${summary}` : handledNote);
    }
    return actions;
  }

  async resultDetail(id: number): Promise<ResultDetail> {
    const attempt = attemptById(this.db, id);
    if (!attempt) return { id, detail: null, analysis: null, note: null, recordingAvailable: false };
    let detail = parseJson<ContactDetail>(attempt.detail_json);
    if (!detail && attempt.contact_id && this.aws) {
      try {
        detail = await this.captureDetail(id, await this.aws.describe(attempt.contact_id));
      } catch {
        detail = null;
      }
    }
    let analysis = parseJson<CallAnalysis>(attempt.analysis_json);
    const agentId = detail?.agent?.id ?? attempt.agent_id;
    if (agentId && (!analysis || analysis.status === 'pending')) {
      const at = parseUtcText(attempt.attempted_at);
      const age = at ? Date.now() - at.getTime() : Infinity;
      if (age >= ANALYSIS_MIN_AGE_MS) analysis = (await this.refreshAnalysis({ ...attempt, agent_id: agentId }, age > ANALYSIS_GIVE_UP_MS)) ?? analysis;
    }
    const fresh = attemptById(this.db, id) ?? attempt;
    return {
      id,
      detail,
      analysis,
      note: fresh.agent_note ?? null,
      recordingAvailable: Boolean(detail?.recordingLocation) || Boolean(agentId),
    };
  }

  async recordingBytes(id: number): Promise<Uint8Array | null> {
    const attempt = attemptById(this.db, id);
    if (!attempt?.contact_id) return null;
    const detail = parseJson<ContactDetail>(attempt.detail_json);
    let key = detail?.recordingLocation ? keyFromLocation(detail.recordingLocation) : null;
    if (!key) {
      key = await findRecordingKey(attempt.contact_id, parseUtcText(attempt.attempted_at));
      if (!key) return null;
      if (detail) {
        detail.recordingLocation = key;
        saveDetail(this.db, id, JSON.stringify(detail), detail.agent?.id ?? attempt.agent_id);
      }
    }
    return fetchRecording(key);
  }

  private agentSummaries(attempts: Attempt[]): AgentSummary[] {
    const groups = new Map<string, AgentSummary & { qualities: number[] }>();
    for (const a of attempts) {
      const detail = parseJson<ContactDetail>(a.detail_json);
      const agent = detail?.agent;
      const agentId = agent?.id ?? a.agent_id;
      if (!agentId) continue;
      let g = groups.get(agentId);
      if (!g) {
        g = { agentId, username: agent?.username ?? agentId.slice(0, 8), calls: 0, humans: 0, talkSeconds: 0, holdSeconds: 0, acwSeconds: 0, quality: null, qualities: [] };
        groups.set(agentId, g);
      }
      g.calls += 1;
      if (a.outcome === HUMAN_OUTCOME) g.humans += 1;
      g.talkSeconds += agent?.talkSeconds ?? a.talk_seconds ?? 0;
      g.holdSeconds += agent?.holdSeconds ?? 0;
      g.acwSeconds += agent?.acwSeconds ?? 0;
      if (detail?.quality.agent !== null && detail?.quality.agent !== undefined) g.qualities.push(detail.quality.agent);
    }
    return [...groups.values()]
      .map(({ qualities, ...g }) => ({ ...g, quality: average(qualities) }))
      .sort((a, b) => b.calls - a.calls);
  }

  agentReport(): AgentReport {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    return {
      today: this.agentSummaries(attemptsWithAgent(this.db, toUtcText(dayStart))),
      allTime: this.agentSummaries(attemptsWithAgent(this.db, null)),
    };
  }

  insights(scope: InsightScope): InsightsReport {
    let since: string | null = null;
    if (scope === 'today') {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      since = toUtcText(d);
    } else if (scope === 'week') {
      since = toUtcText(new Date(Date.now() - 7 * 86400 * 1000));
    }
    const attempts = since ? attemptsSinceAll(this.db, since) : allAttempts(this.db);
    const rings: number[] = [];
    const greetings: number[] = [];
    const talks: number[] = [];
    const qualities: number[] = [];
    const amd = new Map<string, number>();
    const disconnects = new Map<string, number>();
    const sentiment = new Map<string, number>();
    const categories = new Map<string, number>();
    const issues = new Map<string, number>();
    const customerScores: number[] = [];
    const interruptionCounts: number[] = [];
    const nonTalkShares: number[] = [];
    const agentWpms: number[] = [];
    const agentTalkShares: number[] = [];
    const flagged: FlaggedCall[] = [];
    let detailed = 0;
    let analysed = 0;
    let calls = 0;
    let humans = 0;
    let payments = 0;
    let handled = 0;
    let dncAdded = 0;
    let callbacks = 0;
    for (const a of attempts) {
      if (!a.outcome) continue;
      calls += 1;
      if (a.outcome === HUMAN_OUTCOME) humans += 1;
      tally(amd, outcomeLabel(a.outcome));
      const detail = parseJson<ContactDetail>(a.detail_json);
      if (detail) {
        detailed += 1;
        if (detail.ringSeconds !== null) rings.push(detail.ringSeconds);
        if (detail.greetingSeconds !== null) greetings.push(detail.greetingSeconds);
        if (detail.agent?.talkSeconds !== null && detail.agent?.talkSeconds !== undefined) talks.push(detail.agent.talkSeconds);
        if (detail.quality.agent !== null) qualities.push(detail.quality.agent);
        if (detail.quality.customer !== null) qualities.push(detail.quality.customer);
        if (detail.disconnectReason) tally(disconnects, detail.disconnectReason.replace(/_/g, ' ').toLowerCase());
        for (const issue of detail.quality.issues) tally(issues, issue.replace(/_/g, ' ').toLowerCase());
      } else if (a.talk_seconds !== null) {
        talks.push(a.talk_seconds);
      }
      const analysis = parseJson<CallAnalysis>(a.analysis_json);
      if (analysis?.status === 'ready') {
        analysed += 1;
        for (const turn of analysis.transcript) {
          if (turn.role === 'CUSTOMER' && turn.sentiment) tally(sentiment, turn.sentiment.toLowerCase());
        }
        const flags: string[] = [];
        let paid = false;
        let wasHandled = false;
        let wasDnc = false;
        let wasCallback = false;
        for (const c of analysis.categories) {
          tally(categories, categoryLabel(c));
          const effect = categoryEffect(c);
          if (effect === 'paid') paid = true;
          else if (effect === 'handled') wasHandled = true;
          else if (effect === 'dnc') wasDnc = true;
          else if (effect === 'callback') wasCallback = true;
          else if (effect === 'flag') flags.push(categoryLabel(c));
        }
        if (paid) payments += 1;
        if (wasHandled || paid) handled += 1;
        if (wasDnc) dncAdded += 1;
        if (wasCallback) callbacks += 1;
        if (flags.length) flagged.push({ id: a.id, run: a.run, patient: patientByRun(this.db, a.run)?.patient ?? null, attemptedAt: a.attempted_at, flags });
        const ch = analysis.characteristics;
        if (ch) {
          if (ch.sentiment.customer !== null) customerScores.push(ch.sentiment.customer);
          interruptionCounts.push(ch.interruptions.count);
          if (ch.durationSeconds && ch.nonTalkSeconds !== null) nonTalkShares.push(ch.nonTalkSeconds / ch.durationSeconds);
          if (ch.wordsPerMinute.agent !== null) agentWpms.push(ch.wordsPerMinute.agent);
          const a = ch.talkSeconds.agent ?? 0;
          const c = ch.talkSeconds.customer ?? 0;
          if (a + c > 0) agentTalkShares.push(a / (a + c));
        }
      }
    }
    return {
      scope,
      calls,
      detailed,
      analysed,
      avgRingSeconds: average(rings),
      avgGreetingSeconds: average(greetings),
      avgTalkSeconds: average(talks),
      avgQuality: average(qualities),
      avgCustomerSentiment: average(customerScores),
      avgInterruptions: average(interruptionCounts),
      avgNonTalkShare: average(nonTalkShares),
      avgAgentWpm: average(agentWpms),
      talkShareAgent: average(agentTalkShares),
      amd: ranked(amd),
      disconnects: ranked(disconnects),
      sentiment: ranked(sentiment),
      categories: ranked(categories),
      qualityIssues: ranked(issues),
      agents: this.agentSummaries(attempts.filter((a) => a.agent_id)),
      humans,
      payments,
      handled,
      dncAdded,
      callbacks,
      flagged: flagged.sort((x, y) => y.attemptedAt.localeCompare(x.attemptedAt)).slice(0, 40),
      cost: this.costSummary(attempts),
      trend: this.trendFor(attempts, scope),
    };
  }

  private trendFor(attempts: Attempt[], scope: InsightScope): InsightsReport['trend'] {
    const daily = scope !== 'today';
    const buckets = daily ? (scope === 'week' ? 7 : 30) : 12;
    const span = daily ? 86400_000 : 3600_000;
    const start = new Date();
    if (daily) {
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - (buckets - 1));
    } else {
      start.setMinutes(0, 0, 0);
      start.setHours(start.getHours() - (buckets - 1));
    }
    const labels: string[] = [];
    const counts = { attempts: [] as number[], human: [] as number[], payments: [] as number[] };
    for (let i = 0; i < buckets; i += 1) {
      const t = new Date(start.getTime() + i * span);
      labels.push(daily ? `${t.getMonth() + 1}/${t.getDate()}` : `${String(t.getHours()).padStart(2, '0')}:00`);
      counts.attempts.push(0);
      counts.human.push(0);
      counts.payments.push(0);
    }
    for (const a of attempts) {
      const at = parseUtcText(a.attempted_at);
      if (!at) continue;
      const idx = Math.floor((at.getTime() - start.getTime()) / span);
      if (idx < 0 || idx >= buckets) continue;
      counts.attempts[idx] = (counts.attempts[idx] ?? 0) + 1;
      if (a.outcome === HUMAN_OUTCOME) counts.human[idx] = (counts.human[idx] ?? 0) + 1;
      const analysis = parseJson<CallAnalysis>(a.analysis_json);
      if (analysis?.categories.some((c) => categoryEffect(c) === 'paid')) counts.payments[idx] = (counts.payments[idx] ?? 0) + 1;
    }
    return { labels, ...counts };
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
      cost: this.costSummary(today),
    };
  }

  private costSummary(scoped: Attempt[]): CostSummary {
    let allTime = 0;
    for (const a of allAttempts(this.db)) {
      if (!a.outcome) continue;
      allTime += attemptCost(durationsFor(a.dial_seconds, a.answer_seconds, a.outcome, a.talk_seconds), undefined, Boolean(a.agent_id));
    }
    let total = 0;
    let attempts = 0;
    let human = 0;
    let payments = 0;
    let campaignSeconds = 0;
    let answeredSeconds = 0;
    let estimated = 0;
    for (const a of scoped) {
      if (!a.outcome) continue;
      const d = durationsFor(a.dial_seconds, a.answer_seconds, a.outcome, a.talk_seconds);
      const cost = attemptCost(d, undefined, Boolean(a.agent_id));
      attempts += 1;
      total += cost;
      campaignSeconds += d.dialSeconds;
      answeredSeconds += d.answerSeconds;
      if (d.estimated) estimated += 1;
      if (a.outcome === HUMAN_OUTCOME) human += 1;
      const analysis = parseJson<CallAnalysis>(a.analysis_json);
      if (analysis?.categories.some((c) => categoryEffect(c) === 'paid')) payments += 1;
    }
    return {
      today: total,
      allTime,
      attempts,
      perAttempt: attempts ? total / attempts : 0,
      perHuman: human ? total / human : null,
      perPayment: payments ? total / payments : null,
      payments,
      campaignMinutes: campaignSeconds / 60,
      answeredMinutes: answeredSeconds / 60,
      estimatedAttempts: estimated,
    };
  }
}
