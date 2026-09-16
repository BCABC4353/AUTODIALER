import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DialerEvent,
  DialerStatus,
  ForceUpdateState,
  LogLine,
  NowState,
  Patient,
  ResultRow,
  SessionStats,
} from '@shared/types';
import { chimeConnected, chimeDone, chimeRinging } from '../lib/chime';

export interface DialerState {
  status: DialerStatus | null;
  now: NowState | null;
  log: LogLine[];
  patients: Patient[];
  results: ResultRow[];
  session: SessionStats | null;
  update: ForceUpdateState | null;
  error: { title: string; message: string } | null;
  dismissError: () => void;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  importCsv: () => Promise<void>;
  toggleDnc: (run: string) => Promise<void>;
  refreshPatients: () => Promise<void>;
  refreshResults: () => Promise<void>;
  exportCsv: () => Promise<void>;
  clearHistory: () => Promise<void>;
}

const LOG_CAP = 600;

export function useDialer(): DialerState {
  const api = window.dialer;
  const [status, setStatus] = useState<DialerStatus | null>(null);
  const [now, setNow] = useState<NowState | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [session, setSession] = useState<SessionStats | null>(null);
  const [update, setUpdate] = useState<ForceUpdateState | null>(null);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const resultsTimer = useRef<number | null>(null);
  const lastLive = useRef<{ id: string | null; onLine: boolean }>({ id: null, onLine: false });

  const announce = (next: NowState) => {
    const prev = lastLive.current;
    if (next.kind === 'live') {
      const onLine = next.status === 'on the line';
      if (next.contactId !== prev.id) chimeRinging();
      if (onLine && !prev.onLine) chimeConnected();
      lastLive.current = { id: next.contactId, onLine };
      return;
    }
    if (prev.id !== null) chimeDone();
    lastLive.current = { id: null, onLine: false };
  };

  const refreshPatients = useCallback(async () => setPatients(await api.patients.list()), [api]);
  const refreshResults = useCallback(async () => {
    const [rows, stats] = await Promise.all([api.results.list(), api.results.session()]);
    setResults(rows);
    setSession(stats);
  }, [api]);

  useEffect(() => {
    void api.dialer.status().then((s) => {
      setStatus(s);
      setNow(s.now);
    });
    void api.dialer.log().then(setLog);
    void refreshPatients();
    void refreshResults();
    const scheduleResults = () => {
      if (resultsTimer.current !== null) return;
      resultsTimer.current = window.setTimeout(() => {
        resultsTimer.current = null;
        void refreshResults();
      }, 250);
    };
    const off = api.onEvent((event: DialerEvent) => {
      switch (event.type) {
        case 'log':
          setLog((prev) => {
            const next = [...prev, event.line];
            return next.length > LOG_CAP ? next.slice(next.length - LOG_CAP) : next;
          });
          break;
        case 'now':
          setNow(event.now);
          announce(event.now);
          break;
        case 'status':
          setStatus(event.status);
          setNow(event.status.now);
          announce(event.status.now);
          break;
        case 'results':
          scheduleResults();
          break;
        case 'patients':
          void refreshPatients();
          break;
        case 'error':
          setError({ title: event.title, message: event.message });
          break;
        case 'update':
          setUpdate(event.state);
          break;
      }
    });
    const clock = window.setInterval(() => void refreshResults(), 60_000);
    return () => {
      off();
      window.clearInterval(clock);
      if (resultsTimer.current !== null) window.clearTimeout(resultsTimer.current);
    };
  }, [api, refreshPatients, refreshResults]);

  const start = useCallback(() => api.dialer.start(), [api]);
  const stop = useCallback(() => api.dialer.stop(), [api]);
  const importCsv = useCallback(async () => {
    try {
      await api.patients.importCsv();
    } catch (err) {
      setError({ title: 'CSV', message: err instanceof Error ? err.message : String(err) });
    }
  }, [api]);
  const toggleDnc = useCallback((run: string) => api.patients.toggleDnc(run), [api]);
  const exportCsv = useCallback(async () => {
    await api.results.exportCsv();
  }, [api]);
  const clearHistory = useCallback(async () => {
    await api.results.clear();
  }, [api]);

  return {
    status,
    now,
    log,
    patients,
    results,
    session,
    update,
    error,
    dismissError: () => setError(null),
    start,
    stop,
    importCsv,
    toggleDnc,
    refreshPatients,
    refreshResults,
    exportCsv,
    clearHistory,
  };
}
