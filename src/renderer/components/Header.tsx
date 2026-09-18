import { Moon, Phone, Square, Sun } from 'lucide-react';
import { Button, SegmentedControl } from '@ds/index.js';
import type { DialerStatus } from '@shared/types';
import { LOGO_SRC } from '../lib/logo';
import { useTheme } from '../lib/theme';
import { MarsLight } from './MarsLight';

export type View = 'load' | 'dial' | 'results' | 'insights';

const VIEWS: { id: View; label: string }[] = [
  { id: 'load', label: 'Load' },
  { id: 'dial', label: 'Dial' },
  { id: 'results', label: 'Results' },
  { id: 'insights', label: 'Insights' },
];

export function Header({
  view,
  onView,
  status,
  patientCount,
  onStart,
  onStop,
}: {
  view: View;
  onView: (view: View) => void;
  status: DialerStatus | null;
  patientCount: number;
  onStart: () => void;
  onStop: () => void;
}) {
  const { theme, toggle } = useTheme();
  const runState = status?.runState ?? 'stopped';
  const running = runState === 'running';
  const busy = runState === 'starting' || runState === 'stopping';
  const live = status?.now.kind === 'live';
  const active = live || running || runState === 'starting';
  return (
    <header className="@container/header z-40 shrink-0 border-b border-glass-edge bg-glass-header shadow-lg">
      <div className="flex h-[var(--chrome-header-floor)] items-center justify-between gap-fluid-sm px-fluid-md">
        <div className="flex min-w-0 items-center gap-fluid-sm">
          <div className="flex shrink-0 items-center gap-2 text-fluid-title font-black tracking-wider text-brand-wordmark">
            <img src={LOGO_SRC} alt="" className="h-[1em] w-auto" />
            <span>BCABC</span>
          </div>
          <div aria-hidden="true" className="h-5 w-px shrink-0 bg-line" />
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="text-fluid-nano font-black uppercase tracking-widest text-content">Autodialer</span>
            <span className="hidden truncate text-fluid-nano font-black uppercase tracking-wider text-content-muted @[720px]/header:inline">
              Patient claim follow-up
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-fluid-sm">
          <div className="flex items-center gap-2">
            <MarsLight size={22} active={Boolean(active)} />
            {running || busy ? (
              <Button
                variant="chrome-ctl"
                size="chrome"
                disabled={busy}
                onClick={onStop}
                className="border-chip-red-bd bg-chip-red-bg font-black uppercase text-chip-red-fg hover:border-status-danger"
              >
                <Square size={12} />
                {runState === 'stopping' ? 'Stopping' : runState === 'starting' ? 'Starting' : 'Stop dialing'}
              </Button>
            ) : (
              <Button variant="primary" size="chrome" onClick={onStart} className="font-black uppercase">
                <Phone size={13} />
                Start dialing
              </Button>
            )}
          </div>
          <div aria-hidden="true" className="h-5 w-px shrink-0 bg-line" />
          <SegmentedControl
            label="View"
            items={VIEWS.map((v) => ({ id: v.id, label: v.label, pressed: v.id === view }))}
            onSelect={(id: View) => onView(id)}
          />
          <div aria-hidden="true" className="hidden h-5 w-px shrink-0 bg-line @[900px]/header:block" />
          <div className="hidden whitespace-nowrap text-fluid-nano font-black uppercase tracking-wider text-content-muted tabular-nums @[900px]/header:block">
            Patients: <span className="text-content">{patientCount.toLocaleString('en-US')}</span>
          </div>
          <Button
            variant="secondary"
            size="chrome"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="shrink-0"
          >
            {theme === 'dark' ? <Moon /> : <Sun />}
          </Button>
        </div>
      </div>
    </header>
  );
}
