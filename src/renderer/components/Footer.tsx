import type { DialerStatus } from '@shared/types';

function footerText(status: DialerStatus | null): string {
  if (!status) return 'connecting';
  if (status.runState === 'running') {
    const agent = status.agentAvailable === false ? 'no agent available, holding' : `${status.pending} queued`;
    return `campaign ${status.campaignState.toLowerCase()} · ${agent} · pipeline depth 2 · 5-minute expiry`;
  }
  if (status.runState === 'starting') return 'starting campaign';
  if (status.runState === 'stopping') return 'pausing campaign';
  return status.campaignState === 'unknown' ? 'ready' : `campaign ${status.campaignState.toLowerCase()}`;
}

export function Footer({ status }: { status: DialerStatus | null }) {
  return (
    <footer className="z-30 flex h-8 shrink-0 items-center justify-between border-t border-glass-edge bg-glass-header px-fluid-md font-mono text-fluid-micro text-content-muted">
      <span className="truncate">{footerText(status)}</span>
      <span className="shrink-0 tabular-nums">
        {status?.campaignName ? `${status.campaignName} · ` : ''}+1 (213) 934-4537 · us-west-2 · v{status?.version ?? ''}
      </span>
    </footer>
  );
}
