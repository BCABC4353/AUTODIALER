import { useEffect, useState, type CSSProperties } from 'react';
import { GlassPanel, PanelTitle, Pill } from '@ds/index.js';
import type { NowState } from '@shared/types';
import { MarsLight } from './MarsLight';

export function NowCalling({ now, running }: { now: NowState | null; running: boolean }) {
  const [flashKey, setFlashKey] = useState(0);
  const contactId = now?.contactId ?? null;
  const live = now?.kind === 'live';
  useEffect(() => {
    if (contactId && live) setFlashKey((k) => k + 1);
  }, [contactId, live]);
  const state = now ?? { name: '—', run: '', balance: '', tripDate: '', schedule: '', event: '', status: 'idle', tone: 'slate' as const, kind: 'idle' as const };
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
        <PanelTitle>Now calling</PanelTitle>
        <div className="flex items-center gap-2">
          <Pill tone={state.tone} size="sm" intensity={state.kind === 'idle' ? 'subtle' : 'solid'} border={state.kind === 'idle'}>
            {state.status}
          </Pill>
          <MarsLight size={24} active={live || running} />
        </div>
      </header>
      <div className="flex min-w-0 flex-col gap-1 pb-1">
        <div
          className={`min-w-0 truncate font-black leading-[0.9] tracking-tight ${state.kind === 'idle' ? 'text-content-subtle' : 'text-content'}`}
          style={{ fontSize: 'clamp(1.75rem, 5cqi, 3.25rem)', fontVariationSettings: "'opsz' 72, 'wght' 900" }}
        >
          {state.kind === 'idle' ? 'No one on the line' : state.name}
        </div>
        <div className="flex flex-wrap items-baseline gap-x-7 gap-y-1 font-mono text-fluid-heading tabular-nums">
          <span className="text-content-secondary">{state.run}</span>
          <span className="text-accent-text">{state.balance}</span>
        </div>
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
      </div>
    </GlassPanel>
  );
}
