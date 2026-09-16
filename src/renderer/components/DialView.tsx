import { Phone, Square } from 'lucide-react';
import { Button, GlassPanel, PanelTitle, Pill } from '@ds/index.js';
import type { DialerStatus, LogLine, NowState, SessionStats } from '@shared/types';
import { OUTCOME_LABELS, OUTCOME_TONES } from '@shared/outcome';
import { ActionBar } from './ActionBar';
import { ActivityLog } from './ActivityLog';
import { NowCalling } from './NowCalling';
import { AttemptsTrend } from './viz/AttemptsTrend';
import { CalloutTile } from './viz/CalloutTile';
import { OutcomeBars } from './viz/OutcomeBars';

const OUTCOME_COLORS: Record<string, string> = {
  human: 'var(--chart-series-2)',
  voicemail: 'var(--chart-seq-4)',
  no_answer: 'var(--chart-series-1)',
  other: 'var(--chart-other)',
};

const STAT_ORDER = ['sent', 'human', 'voicemail', 'no_answer', 'other'] as const;

export function DialView({
  status,
  now,
  log,
  session,
  onStart,
  onStop,
}: {
  status: DialerStatus | null;
  now: NowState | null;
  log: LogLine[];
  session: SessionStats | null;
  onStart: () => void;
  onStop: () => void;
}) {
  const runState = status?.runState ?? 'stopped';
  const running = runState === 'running';
  const busy = runState === 'starting' || runState === 'stopping';
  const stats = status?.stats ?? { sent: 0, human: 0, voicemail: 0, no_answer: 0, other: 0 };
  const completed = session?.completed ?? 0;
  const human = session?.human ?? 0;
  const rate = completed > 0 ? Math.round((human / completed) * 100) : 0;
  const replayKey = `${session?.completed ?? 0}-${session?.sent ?? 0}`;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ActionBar
        left={
          running || busy ? (
            <Button
              variant="chrome-ctl"
              size="md"
              disabled={busy}
              onClick={onStop}
              className="border-chip-red-bd bg-chip-red-bg text-chip-red-fg hover:border-status-danger"
            >
              <Square size={12} />
              {runState === 'stopping' ? 'Stopping' : 'Stop dialing'}
            </Button>
          ) : (
            <Button variant="primary" size="md" onClick={onStart} className="font-black uppercase">
              <Phone size={13} />
              Start dialing
            </Button>
          )
        }
        right={
          <div className="flex items-center gap-1.5">
            {STAT_ORDER.map((key) => (
              <Pill key={key} tone={key === 'sent' ? 'blue' : OUTCOME_TONES[key]} size="sm" border>
                {key === 'sent' ? 'sent' : OUTCOME_LABELS[key]} {stats[key]}
              </Pill>
            ))}
          </div>
        }
      />
      <div className="ds-ambient view-enter flex min-h-0 flex-1 flex-col gap-fluid-sm p-fluid-md">
        <NowCalling now={now} running={running} />
        <GlassPanel padding="sm" gap="xs" className="h-[13.5rem] shrink-0">
          <header className="flex items-center justify-between">
            <PanelTitle>Today</PanelTitle>
            <span className="font-mono text-fluid-micro text-content-muted tabular-nums">{session ? `${session.sent} pushed` : ''}</span>
          </header>
          <div className="flex min-h-0 flex-1 gap-fluid-sm">
            <CalloutTile
              title="Contact rate"
              sentence="Humans reached out of completed calls."
              value={`${rate}%`}
              label="human answered"
              lines={[`${human} of ${completed} completed calls`, `${stats.sent} pushed this session`]}
            />
            <OutcomeBars
              title="Outcomes"
              sentence="Every completed attempt today by result."
              replayKey={replayKey}
              entries={(session?.outcomes ?? []).map((o) => ({ label: o.label, value: o.value, color: OUTCOME_COLORS[o.key] ?? 'var(--chart-other)' }))}
            />
            <AttemptsTrend
              title="Attempts"
              sentence="Pushes per hour across the last twelve hours."
              replayKey={replayKey}
              labels={session?.trend.labels ?? []}
              series={[
                { name: 'attempts', values: session?.trend.attempts ?? [], color: 'var(--chart-series-3)' },
                { name: 'human answered', values: session?.trend.human ?? [], color: 'var(--chart-series-2)' },
              ]}
            />
          </div>
        </GlassPanel>
        <ActivityLog lines={log} />
      </div>
    </div>
  );
}
