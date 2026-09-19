import { useEffect, useState, type CSSProperties } from 'react';
import { GlassPanel, PanelTitle, Pill } from '@ds/index.js';
import type { NowState } from '@shared/types';
import { outcomeLabel } from '@shared/outcome';
import { MarsLight } from './MarsLight';

const SENTIMENT_TONE: Record<string, { label: string; tone: 'emerald' | 'amber' | 'red' | 'slate' }> = {
  POSITIVE: { label: 'patient positive', tone: 'emerald' },
  NEUTRAL: { label: 'patient neutral', tone: 'slate' },
  MIXED: { label: 'patient mixed', tone: 'amber' },
  NEGATIVE: { label: 'patient negative', tone: 'red' },
};

const CONNECTING: NowState = {
  contactId: null,
  name: '—',
  run: '',
  balance: '',
  tripDate: '',
  schedule: '',
  event: '',
  sentiment: null,
  lastLine: '',
  headline: 'Connecting to the dialer',
  subline: '',
  since: null,
  agent: null,
  last: null,
  status: 'idle',
  tone: 'slate',
  kind: 'idle',
};

function elapsed(since: string | null, now: number): string | null {
  if (!since) return null;
  const s = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function NowCalling({ now, running }: { now: NowState | null; running: boolean }) {
  const [flashKey, setFlashKey] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const state = now ?? CONNECTING;
  const live = state.kind === 'live';
  const focused = state.kind !== 'idle';
  const contactId = state.contactId;
  useEffect(() => {
    if (contactId && live) setFlashKey((k) => k + 1);
  }, [contactId, live]);
  useEffect(() => {
    if (!state.since) return undefined;
    setClock(Date.now());
    const id = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [state.since]);
  const timer = elapsed(state.since, clock);
  const mood = state.sentiment ? (SENTIMENT_TONE[state.sentiment] ?? null) : null;
  const facts = [
    { label: 'Trip', value: state.tripDate },
    { label: 'Schedule', value: state.schedule },
    { label: 'Event', value: state.event },
  ].filter((f) => f.value);
  return (
    <GlassPanel padding="sm" gap="xs" className="@container/now relative shrink-0 overflow-hidden">
      <div key={flashKey} className={flashKey > 0 ? 'now-flash pointer-events-none absolute inset-0 rounded-lg' : 'hidden'} aria-hidden="true" />
      <div className="ds-row-marker absolute inset-y-3 left-0" data-marker={live ? '1' : undefined} style={{ '--row-marker-c': 'var(--accent)' } as CSSProperties} />
      <header className="flex items-center justify-between gap-2">
        <PanelTitle>Now</PanelTitle>
        <div className="flex items-center gap-2">
          {mood && (
            <Pill tone={mood.tone} size="sm" intensity="subtle" border>
              {mood.label}
            </Pill>
          )}
          <Pill tone={state.tone} size="sm" intensity={focused ? 'solid' : 'subtle'} border={!focused}>
            {timer ? `${state.status} · ${timer}` : state.status}
          </Pill>
          <MarsLight size={24} active={live || running} />
        </div>
      </header>
      <div className="flex min-w-0 flex-col gap-1 pb-1">
        <div
          className={`min-w-0 truncate font-black leading-[0.95] tracking-tight ${focused ? 'text-content' : 'text-content-subtle'}`}
          style={{ fontSize: 'clamp(1.6rem, 4.5cqi, 3rem)', fontVariationSettings: "'opsz' 72, 'wght' 900" }}
        >
          {state.headline}
        </div>
        {focused && (state.run || state.balance) && (
          <div className="flex flex-wrap items-baseline gap-x-7 gap-y-1 font-mono text-fluid-heading tabular-nums">
            <span className="text-content-secondary">{state.run}</span>
            <span className="text-accent-text">{state.balance}</span>
          </div>
        )}
        {state.subline && <p className="ds-smallcaps truncate text-fluid-label text-content-muted normal-case">{state.subline}</p>}
        {state.lastLine && (
          <p className="ds-smallcaps truncate text-fluid-label text-content-secondary normal-case">
            <span className="mr-2 font-mono text-fluid-micro font-bold uppercase text-chip-amber-fg">patient</span>
            {state.lastLine}
          </p>
        )}
        {facts.length > 0 && (
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 pt-1">
            {facts.map((f) => (
              <span key={f.label} className="flex items-baseline gap-2">
                <span className="text-fluid-nano font-black uppercase tracking-wider text-content-muted">{f.label}</span>
                <span className={`text-fluid-label font-bold text-content-secondary ${f.label === 'Trip' ? 'font-mono tabular-nums' : ''}`}>{f.value}</span>
              </span>
            ))}
          </div>
        )}
        {!live && state.last && (
          <p className="ds-smallcaps truncate pt-1 font-mono text-fluid-micro text-content-muted normal-case tabular-nums">
            last call · {state.last.name} · {outcomeLabel(state.last.outcome)} · {state.last.at}
          </p>
        )}
      </div>
    </GlassPanel>
  );
}
