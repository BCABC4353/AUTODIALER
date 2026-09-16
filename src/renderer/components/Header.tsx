import { Pill, SegmentedControl } from '@ds/index.js';
import type { DialerStatus, Tone } from '@shared/types';
import { LOGO_SRC } from '../lib/logo';
import { MarsLight } from './MarsLight';

export type View = 'load' | 'dial' | 'results';

const VIEWS: { id: View; label: string }[] = [
  { id: 'load', label: 'Load' },
  { id: 'dial', label: 'Dial' },
  { id: 'results', label: 'Results' },
];

function stateChip(status: DialerStatus | null): { label: string; tone: Tone; solid: boolean } {
  const run = status?.runState ?? 'stopped';
  if (run === 'running') return { label: 'running', tone: 'emerald', solid: true };
  if (run === 'starting' || run === 'stopping') return { label: run, tone: 'amber', solid: true };
  return { label: 'stopped', tone: 'slate', solid: false };
}

export function Header({
  view,
  onView,
  status,
  patientCount,
}: {
  view: View;
  onView: (view: View) => void;
  status: DialerStatus | null;
  patientCount: number;
}) {
  const chip = stateChip(status);
  const live = status?.now.kind === 'live';
  const active = live || status?.runState === 'running' || status?.runState === 'starting';
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
            <Pill tone={chip.tone} size="sm" intensity={chip.solid ? 'solid' : 'subtle'} border={!chip.solid}>
              {chip.label}
            </Pill>
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
        </div>
      </div>
    </header>
  );
}
