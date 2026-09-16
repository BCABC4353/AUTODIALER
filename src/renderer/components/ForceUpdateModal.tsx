import { Button, GlassPanel, SectionHeader } from '@ds/index.js';
import type { ForceUpdateState } from '@shared/types';

export function ForceUpdateModal({ state, onRestart }: { state: ForceUpdateState; onRestart: () => void }) {
  if (!state.active) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="force-update-title" className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-glass-veil backdrop-blur-glass p-6">
      <GlassPanel padding="lg" gap="sm" className="w-full max-w-md">
        <SectionHeader as="h2" size="eyebrow" id="force-update-title">
          Required update
        </SectionHeader>
        <p className="ds-smallcaps text-fluid-body text-content normal-case">
          {state.holding
            ? 'A call is live with the agent. The restart waits until it disconnects.'
            : `BCABC Autodialer will restart to install version ${state.version || 'the required release'}.`}
        </p>
        {state.message && <p className="ds-smallcaps text-fluid-label text-content-muted normal-case">{state.message}</p>}
        <div className="flex items-baseline gap-3">
          <span className="font-black leading-none tracking-tight text-content tabular-nums" style={{ fontSize: '3.5rem' }}>
            {state.holding ? '—' : state.secondsLeft}
          </span>
          <span className="text-fluid-label font-bold uppercase tracking-wider text-content-secondary">{state.holding ? 'waiting for the call' : 'seconds'}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-overlay">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${state.holding ? 100 : (state.secondsLeft / 30) * 100}%` }} />
        </div>
        <div className="flex justify-end">
          <Button variant="primary" size="md" onClick={onRestart} className="font-black uppercase">
            Restart now
          </Button>
        </div>
      </GlassPanel>
    </div>
  );
}
