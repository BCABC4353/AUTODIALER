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
  const state = now ?? { name: '—', run: '', balance: '', status: 'idle', tone: 'slate' as const, kind: 'idle' as const };
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
          className="min-w-0 truncate font-black leading-[0.9] tracking-tight text-content"
          style={{ fontSize: 'clamp(1.75rem, 5cqi, 3.25rem)', fontVariationSettings: "'opsz' 72, 'wght' 900" }}
        >
          {state.name}
        </div>
        <div className="flex flex-wrap items-baseline gap-x-7 gap-y-1 font-mono text-fluid-heading tabular-nums">
          <span className="text-content-secondary">{state.run}</span>
          <span className="text-accent-text">{state.balance}</span>
        </div>
      </div>
    </GlassPanel>
  );
}
