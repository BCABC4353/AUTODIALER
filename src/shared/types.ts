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
}

export interface ResultRow extends Attempt {
  patient: string | null;
  balance: number | null;
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
