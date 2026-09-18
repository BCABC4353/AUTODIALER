export type Tone = 'slate' | 'orange' | 'amber' | 'red' | 'emerald' | 'blue' | 'violet';

export type OutcomeKey = 'human' | 'voicemail' | 'no_answer' | 'other';

export interface Patient {
  run: string;
  phone: string | null;
  patient: string | null;
  balance: number | null;
  consent: number;
  dnc: number;
  tz: string | null;
  trip_date: string | null;
  schedule: string | null;
  event: string | null;
}

export interface Attempt {
  id: number;
  run: string;
  phone: string | null;
  attempted_at: string;
  contact_id: string | null;
  outcome: string | null;
  talk_seconds: number | null;
  agent_note: string | null;
  dial_seconds: number | null;
  answer_seconds: number | null;
  agent_id: string | null;
  detail_json: string | null;
  analysis_json: string | null;
  summary: string | null;
}

export interface ResultRow extends Attempt {
  patient: string | null;
  balance: number | null;
  cost: number;
  cost_estimated: boolean;
}

export interface ContactAgent {
  id: string;
  username: string | null;
  connectedAt: string | null;
  talkSeconds: number | null;
  holdSeconds: number;
  holdCount: number;
  acwSeconds: number | null;
  device: string | null;
}

export interface ContactDetail {
  contactId: string;
  campaignId: string | null;
  initiatedAt: string | null;
  ringStartAt: string | null;
  answeredAt: string | null;
  disconnectedAt: string | null;
  ringSeconds: number | null;
  answeredSeconds: number | null;
  greetingSeconds: number | null;
  amd: string | null;
  disconnectReason: string | null;
  agent: ContactAgent | null;
  quality: { agent: number | null; customer: number | null; issues: string[] };
  recordingLocation: string | null;
}

export interface TranscriptTurn {
  id: string;
  role: string;
  text: string;
  sentiment: string | null;
  at: string | null;
}

export interface SideMetric {
  agent: number | null;
  customer: number | null;
}

export interface CallCharacteristics {
  durationSeconds: number | null;
  talkSeconds: SideMetric;
  nonTalkSeconds: number | null;
  interruptions: { count: number; seconds: number; byAgent: number; byCustomer: number };
  wordsPerMinute: SideMetric;
  loudness: SideMetric;
  sentiment: SideMetric;
  sentimentByQuarter: { agent: number[]; customer: number[] };
  issues: string[];
  outcomes: string[];
  actionItems: string[];
}

export interface ExtractedFact {
  name: string;
  label: string;
  value: string;
}

export interface CallAnalysis {
  status: 'pending' | 'ready' | 'unavailable';
  transcript: TranscriptTurn[];
  categories: string[];
  summary: string | null;
  characteristics: CallCharacteristics | null;
  extracted: ExtractedFact[];
  actions: string[];
  fetchedAt: string;
}

export interface LiveLens {
  sentiment: string | null;
  lastLine: string;
  categories: string[];
}

export interface ResultDetail {
  id: number;
  detail: ContactDetail | null;
  analysis: CallAnalysis | null;
  note: string | null;
  recordingAvailable: boolean;
}

export interface AgentSummary {
  agentId: string;
  username: string;
  calls: number;
  humans: number;
  talkSeconds: number;
  holdSeconds: number;
  acwSeconds: number;
  quality: number | null;
}

export interface AgentReport {
  today: AgentSummary[];
  allTime: AgentSummary[];
}

export type InsightScope = 'today' | 'week' | 'all';

export interface InsightsReport {
  scope: InsightScope;
  calls: number;
  detailed: number;
  analysed: number;
  avgRingSeconds: number | null;
  avgGreetingSeconds: number | null;
  avgTalkSeconds: number | null;
  avgQuality: number | null;
  avgCustomerSentiment: number | null;
  avgInterruptions: number | null;
  avgNonTalkShare: number | null;
  avgAgentWpm: number | null;
  talkShareAgent: number | null;
  amd: { label: string; value: number }[];
  disconnects: { label: string; value: number }[];
  sentiment: { label: string; value: number }[];
  categories: { label: string; value: number }[];
  qualityIssues: { label: string; value: number }[];
  agents: AgentSummary[];
  humans: number;
  payments: number;
  handled: number;
  dncAdded: number;
  callbacks: number;
  flagged: FlaggedCall[];
  cost: CostSummary;
  trend: { labels: string[]; attempts: number[]; human: number[]; payments: number[] };
}

export interface CostSummary {
  today: number;
  allTime: number;
  attempts: number;
  perAttempt: number;
  perHuman: number | null;
  perPayment: number | null;
  payments: number;
  campaignMinutes: number;
  answeredMinutes: number;
  estimatedAttempts: number;
}

export interface FlaggedCall {
  id: number;
  run: string;
  patient: string | null;
  attemptedAt: string;
  flags: string[];
}

export interface Stats {
  sent: number;
  human: number;
  voicemail: number;
  no_answer: number;
  other: number;
}

export type RunState = 'stopped' | 'starting' | 'running' | 'stopping';

export interface NowState {
  contactId: string | null;
  name: string;
  run: string;
  balance: string;
  tripDate: string;
  schedule: string;
  event: string;
  sentiment: string | null;
  lastLine: string;
  status: string;
  tone: Tone;
  kind: 'live' | 'dialing' | 'next' | 'idle';
}

export interface LogLine {
  ts: string;
  text: string;
  level: '' | 'ok' | 'err';
}

export interface DialerStatus {
  runState: RunState;
  campaignState: string;
  campaignName: string;
  agentAvailable: boolean | null;
  stats: Stats;
  now: NowState;
  pending: number;
  version: string;
}

export interface SessionStats {
  outcomes: { key: OutcomeKey; label: string; value: number }[];
  completed: number;
  human: number;
  sent: number;
  trend: { labels: string[]; attempts: number[]; human: number[] };
  cost: CostSummary;
}

export interface ImportResult {
  file: string;
  rows: number;
  invalid: number;
}

export interface ForceUpdateState {
  active: boolean;
  secondsLeft: number;
  holding: boolean;
  message: string;
  version: string;
}

export type DialerEvent =
  | { type: 'log'; line: LogLine }
  | { type: 'now'; now: NowState }
  | { type: 'status'; status: DialerStatus }
  | { type: 'results' }
  | { type: 'patients' }
  | { type: 'error'; title: string; message: string }
  | { type: 'analysis'; id: number }
  | { type: 'update'; state: ForceUpdateState };

export interface DialerApi {
  patients: {
    list: () => Promise<Patient[]>;
    importCsv: () => Promise<ImportResult | null>;
    toggleDnc: (run: string) => Promise<void>;
  };
  dialer: {
    start: () => Promise<void>;
    stop: () => Promise<void>;
    status: () => Promise<DialerStatus>;
    log: () => Promise<LogLine[]>;
  };
  results: {
    list: () => Promise<ResultRow[]>;
    exportCsv: () => Promise<{ file: string; rows: number } | null>;
    clear: () => Promise<number>;
    session: () => Promise<SessionStats>;
    detail: (id: number) => Promise<ResultDetail>;
    recording: (id: number) => Promise<Uint8Array | null>;
    agents: () => Promise<AgentReport>;
    insights: (scope: InsightScope) => Promise<InsightsReport>;
  };
  app: {
    version: () => Promise<string>;
    restartNow: () => Promise<void>;
  };
  onEvent: (handler: (event: DialerEvent) => void) => () => void;
}

declare global {
  interface Window {
    dialer: DialerApi;
  }
}
