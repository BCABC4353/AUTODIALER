import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, GlassPanel, PanelTitle, SegmentedControl, Tooltip } from '@ds/index.js';
import type { AgentSummary, InsightScope, InsightsReport } from '@shared/types';
import { formatCost, RATES } from '@shared/pricing';
import { ActionBar } from './ActionBar';
import { BlankDash, DataTable, type Column } from './DataTable';
import { AttemptsTrend } from './viz/AttemptsTrend';
import { OutcomeBars } from './viz/OutcomeBars';
import { Tile } from './viz/Tile';

const SCOPES: { id: InsightScope; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: '7 days' },
  { id: 'all', label: 'All' },
];

const SENTIMENT_COLOR: Record<string, string> = {
  positive: 'var(--chart-series-2)',
  neutral: 'var(--chart-series-4)',
  mixed: 'var(--chart-seq-4)',
  negative: 'var(--chart-series-1)',
};

const NONE = '—';

function mmss(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function pct(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : NONE;
}

function signed(value: number | null): string {
  if (value === null) return NONE;
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
}

function share(value: number | null): string {
  return value === null ? NONE : `${Math.round(value * 100)}%`;
}

const AGENT_COLUMNS: Column<AgentSummary>[] = [
  { id: 'agent', label: 'Agent', cell: (a) => a.username },
  { id: 'calls', label: 'Calls', width: '6rem', align: 'right', mono: true, cell: (a) => a.calls },
  { id: 'humans', label: 'Humans', width: '6rem', align: 'right', mono: true, cell: (a) => a.humans },
  { id: 'talk', label: 'Talk', width: '7rem', align: 'right', mono: true, cell: (a) => mmss(a.talkSeconds) },
  { id: 'hold', label: 'Hold', width: '7rem', align: 'right', mono: true, cell: (a) => mmss(a.holdSeconds) },
  { id: 'acw', label: 'After call', width: '7rem', align: 'right', mono: true, cell: (a) => mmss(a.acwSeconds) },
  { id: 'avg', label: 'Avg talk', width: '7rem', align: 'right', mono: true, cell: (a) => (a.calls ? mmss(a.talkSeconds / a.calls) : <BlankDash />) },
  { id: 'quality', label: 'Audio', width: '6rem', align: 'right', mono: true, cell: (a) => (a.quality === null ? <BlankDash /> : a.quality.toFixed(2)) },
];

interface StatItem {
  label: string;
  value: string;
  sub: string;
  hint: string;
}

function Stat({ label, value, sub, hint }: StatItem) {
  const empty = value === NONE;
  return (
    <Tooltip content={hint} side="bottom" size="sm">
      <div className="flex min-w-0 flex-col justify-center gap-0.5 px-fluid-sm py-2">
        <span className={`truncate font-black leading-none tracking-tight tabular-nums ${empty ? 'text-fluid-heading text-content-subtle' : 'text-fluid-title text-content'}`}>{empty ? '–' : value}</span>
        <span className="ds-smallcaps truncate text-fluid-nano font-bold uppercase tracking-wider text-content-secondary">{label}</span>
        <span className="ds-chart-label truncate text-content-muted">{sub || ' '}</span>
      </div>
    </Tooltip>
  );
}

function RankList({ title, right, entries, empty, color = 'var(--chart-series-3)' }: { title: string; right?: ReactNode; entries: { label: string; value: number }[]; empty: string; color?: string }) {
  const max = Math.max(1, ...entries.map((e) => e.value));
  return (
    <Tile title={title} right={right}>
      {entries.length === 0 ? (
        <div className="ds-smallcaps flex flex-1 items-center justify-center rounded-md border border-dashed border-glass-edge px-3 py-2 text-center text-fluid-label text-content-muted normal-case">{empty}</div>
      ) : (
        <ul className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {entries.slice(0, 8).map((e) => (
            <li key={e.label} className="flex flex-col gap-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="ds-smallcaps truncate text-fluid-label text-content normal-case">{e.label}</span>
                <span className="font-mono text-fluid-nano text-content-muted tabular-nums">{e.value}</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-surface-overlay">
                <div className="ds-chart-mark h-full rounded-full" style={{ width: `${(e.value / max) * 100}%`, '--chart-mark-c': color } as CSSProperties} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Tile>
  );
}

function Facts({ title, right, rows }: { title: string; right?: ReactNode; rows: { label: string; value: string }[] }) {
  return (
    <Tile title={title} right={right}>
      <ul className="flex min-h-0 flex-1 flex-col justify-evenly overflow-hidden">
        {rows.map((row) => (
          <li key={row.label} className="flex items-baseline justify-between gap-3 border-b border-line py-0.5 last:border-b-0">
            <span className="ds-smallcaps truncate text-fluid-label text-content-muted normal-case">{row.label}</span>
            <span className={`shrink-0 font-mono text-fluid-label tabular-nums ${row.value === NONE ? 'text-content-subtle' : 'text-content'}`}>{row.value === NONE ? '–' : row.value}</span>
          </li>
        ))}
      </ul>
    </Tile>
  );
}

export function InsightsView({ resultsTick }: { resultsTick: number }) {
  const [scope, setScope] = useState<InsightScope>('today');
  const [report, setReport] = useState<InsightsReport | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (s: InsightScope) => {
    setLoading(true);
    try {
      setReport(await window.dialer.results.insights(s));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(scope);
  }, [scope, resultsTick]);

  const r = report;
  const key = `${scope}-${r?.calls ?? 0}-${r?.analysed ?? 0}`;
  const coverage = r ? `${r.detailed} of ${r.calls} calls with Connect detail · ${r.analysed} with a transcript` : '';
  const scopeWord = scope === 'today' ? 'today' : scope === 'week' ? 'this week' : 'all time';
  const cost = r?.cost ?? null;

  const stats: StatItem[] = r && cost
    ? [
        { label: 'calls', value: String(r.calls), sub: `${r.detailed} with detail · ${r.analysed} analysed`, hint: 'Completed attempts in the scope. Detail comes from the Connect contact record; analysed means Contact Lens produced a transcript.' },
        { label: 'contact rate', value: r.calls ? pct(r.humans, r.calls) : NONE, sub: `${r.humans} humans reached`, hint: 'Humans reached out of completed calls.' },
        { label: 'payments', value: String(r.payments), sub: r.humans ? `${pct(r.payments, r.humans)} of humans reached` : 'no humans reached yet', hint: 'Calls where a payment went through on the line, from the transcript categories.' },
        { label: 'handled', value: String(r.handled), sub: `${r.dncAdded} do not call · ${r.callbacks} callbacks`, hint: 'Paid, promised to pay, asked about a plan, or disputed the balance. Do not call counts patients who asked to stop or were a wrong number.' },
        { label: 'flagged', value: String(r.flagged.length), sub: 'Results tab, Flagged filter', hint: 'Calls that asked for a supervisor or billing, or tripped a Contact Lens rule. Each one also emails you.' },
        {
          label: `spend ${scopeWord}`,
          value: formatCost(cost.today),
          sub: `${cost.campaignMinutes.toFixed(1)} min dialing · ${cost.answeredMinutes.toFixed(1)} min answered`,
          hint: `Amazon Connect prorated per second: ${formatCost(RATES.campaignPerMinute)}/min while dialing, ${formatCost(RATES.voicePerMinute + RATES.telephonyPerMinute)}/min once answered, Contact Lens ${RATES.lensPerMinute ? formatCost(RATES.lensPerMinute) + '/min' : 'included'}. ${cost.estimatedAttempts ? `${cost.estimatedAttempts} calls estimated from their outcome.` : 'Every call priced from recorded durations.'}`,
        },
        { label: 'per call', value: cost.attempts ? formatCost(cost.perAttempt) : NONE, sub: `${cost.attempts} priced attempts`, hint: 'Average cost of one attempt.' },
        { label: 'per human', value: cost.perHuman === null ? NONE : formatCost(cost.perHuman), sub: `${formatCost(cost.allTime)} all time`, hint: 'Spend divided by humans reached.' },
        { label: 'per payment', value: cost.perPayment === null ? NONE : formatCost(cost.perPayment), sub: `${cost.payments} payments taken`, hint: 'Spend divided by payments taken.' },
        { label: 'sentiment', value: signed(r.avgCustomerSentiment), sub: r.avgRingSeconds === null ? '' : `${Math.round(r.avgRingSeconds)}s average ring`, hint: 'Average patient sentiment from Contact Lens, from -5 to +5.' },
      ]
    : [];

  const conversation = [
    { label: 'agent share of talk', value: share(r?.talkShareAgent ?? null) },
    { label: 'interruptions per call', value: r?.avgInterruptions === null || r?.avgInterruptions === undefined ? NONE : r.avgInterruptions.toFixed(1) },
    { label: 'silence', value: share(r?.avgNonTalkShare ?? null) },
    { label: 'agent pace', value: r?.avgAgentWpm === null || r?.avgAgentWpm === undefined ? NONE : `${Math.round(r.avgAgentWpm)} wpm` },
    { label: 'greeting before detection', value: r?.avgGreetingSeconds === null || r?.avgGreetingSeconds === undefined ? NONE : `${r.avgGreetingSeconds.toFixed(1)}s` },
    { label: 'average agent talk', value: r?.avgTalkSeconds === null || r?.avgTalkSeconds === undefined ? NONE : mmss(r.avgTalkSeconds) },
    { label: r?.qualityIssues[0] ? `audio, ${r.qualityIssues[0].label}` : 'audio score', value: r?.avgQuality === null || r?.avgQuality === undefined ? NONE : `${r.avgQuality.toFixed(2)} / 5` },
  ];

  return (
    <div className="@container/insights flex min-h-0 flex-1 flex-col">
      <ActionBar
        left={
          <>
            <SegmentedControl label="Scope" items={SCOPES.map((s) => ({ id: s.id, label: s.label, pressed: s.id === scope }))} onSelect={(id: InsightScope) => setScope(id)} />
            <Button variant="refresh" size="chrome" onClick={() => void load(scope)} disabled={loading}>
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </>
        }
        right={<span className="text-fluid-nano font-black uppercase tracking-wider text-content-muted">{coverage}</span>}
      />
      <div className="ds-ambient view-enter custom-scrollbar flex min-h-0 flex-1 flex-col gap-fluid-xs overflow-y-auto p-fluid-sm">
        <GlassPanel padding="none" gap="none" className="shrink-0 overflow-hidden">
          <div className="grid grid-cols-5 divide-x divide-line @[1180px]/insights:grid-cols-10">
            {stats.length === 0
              ? Array.from({ length: 10 }, (_, i) => <Stat key={i} label="" value={NONE} sub="" hint="" />)
              : stats.map((s) => <Stat key={s.label} {...s} />)}
          </div>
        </GlassPanel>

        <div className="flex h-[12.5rem] shrink-0 gap-fluid-xs">
          <div className="flex min-w-0 flex-[2]">
            <AttemptsTrend
              title="Volume"
              right={scope === 'today' ? 'per hour, last 12h' : scope === 'week' ? 'per day, last 7' : 'per day, last 30'}
              replayKey={key}
              labels={r?.trend.labels ?? []}
              series={[
                { name: 'attempts', values: r?.trend.attempts ?? [], color: 'var(--chart-series-3)' },
                { name: 'human', values: r?.trend.human ?? [], color: 'var(--chart-series-2)' },
                { name: 'payments', values: r?.trend.payments ?? [], color: 'var(--chart-series-1)' },
              ]}
            />
          </div>
          <OutcomeBars
            title="What answered"
            right={r ? `${r.calls} calls` : ''}
            replayKey={key}
            entries={(r?.amd ?? []).slice(0, 6).map((e) => ({ label: e.label, value: e.value, color: e.label.includes('human') ? 'var(--chart-series-2)' : e.label.includes('voicemail') ? 'var(--chart-seq-4)' : 'var(--chart-series-1)' }))}
          />
          <OutcomeBars
            title="Patient sentiment"
            right={r ? `${signed(r.avgCustomerSentiment)} avg` : ''}
            replayKey={key}
            entries={(r?.sentiment ?? []).map((e) => ({ label: e.label, value: e.value, color: SENTIMENT_COLOR[e.label] ?? 'var(--chart-other)' }))}
          />
        </div>

        <div className="flex h-[12.5rem] shrink-0 gap-fluid-xs">
          <RankList title="What was said" right={r ? `${r.analysed} transcripts` : ''} entries={r?.categories ?? []} empty="Categories appear once an agent call has been analysed." color="var(--chart-series-5)" />
          <RankList title="How calls ended" right={r ? `${r.detailed} with detail` : ''} entries={r?.disconnects ?? []} empty="No disconnect detail recorded yet." color="var(--chart-series-4)" />
          <Facts title="Conversation" right={r ? `${r.analysed} analysed` : ''} rows={conversation} />
        </div>

        <GlassPanel padding="sm" gap="xs" className="min-h-[9rem] flex-1">
          <header className="flex items-center justify-between">
            <PanelTitle>Agents</PanelTitle>
            <span className="font-mono text-fluid-micro text-content-muted tabular-nums">{r ? `${r.agents.length} agent${r.agents.length === 1 ? '' : 's'} ${scopeWord}` : ''}</span>
          </header>
          <DataTable columns={AGENT_COLUMNS} rows={r?.agents ?? []} rowKey={(a) => a.agentId} rowClass={() => 'text-content-secondary'} empty={{ title: 'No agent-handled calls in this scope', description: 'Talk, hold and after-call work appear once a patient reaches an agent.' }} />
        </GlassPanel>
      </div>
    </div>
  );
}
