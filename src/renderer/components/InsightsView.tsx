import { useEffect, useState, type CSSProperties } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, GlassPanel, PanelTitle, Pill, SegmentedControl } from '@ds/index.js';
import type { AgentSummary, FlaggedCall, InsightScope, InsightsReport } from '@shared/types';
import { formatCost, RATES } from '@shared/pricing';
import { formatLocal } from '@shared/time';
import { ActionBar } from './ActionBar';
import { BlankDash, DataTable, type Column } from './DataTable';
import { AttemptsTrend } from './viz/AttemptsTrend';
import { CalloutTile } from './viz/CalloutTile';
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

function mmss(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function num(value: number | null | undefined, digits = 0, suffix = ''): string {
  return value === null || value === undefined ? '—' : `${value.toFixed(digits)}${suffix}`;
}

function pct(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—';
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

const FLAG_COLUMNS: Column<FlaggedCall>[] = [
  { id: 'when', label: 'When', width: '9rem', mono: true, cell: (f) => formatLocal(f.attemptedAt) },
  { id: 'run', label: 'Run', width: '8rem', mono: true, cell: (f) => f.run },
  { id: 'patient', label: 'Patient', width: '16rem', cell: (f) => f.patient || <BlankDash /> },
  {
    id: 'flags',
    label: 'Flags',
    cell: (f) => (
      <span className="flex flex-wrap gap-1">
        {f.flags.map((x) => (
          <Pill key={x} tone="violet" size="sm" border>
            {x}
          </Pill>
        ))}
      </span>
    ),
  },
];

function RankList({ title, sentence, entries, empty, color = 'var(--chart-series-3)' }: { title: string; sentence: string; entries: { label: string; value: number }[]; empty: string; color?: string }) {
  const max = Math.max(1, ...entries.map((e) => e.value));
  return (
    <Tile title={title} sentence={sentence}>
      {entries.length === 0 ? (
        <div className="ds-smallcaps flex flex-1 items-center justify-center rounded-md border border-dashed border-glass-edge px-3 py-2 text-center text-fluid-label text-content-muted normal-case">{empty}</div>
      ) : (
        <ul className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
          {entries.slice(0, 10).map((e) => (
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

function Section({ title, right, height, children }: { title: string; right?: string; height: string; children: React.ReactNode }) {
  return (
    <GlassPanel padding="sm" gap="xs" className={`${height} shrink-0`}>
      <header className="flex items-center justify-between">
        <PanelTitle>{title}</PanelTitle>
        {right && <span className="font-mono text-fluid-micro text-content-muted tabular-nums">{right}</span>}
      </header>
      <div className="flex min-h-0 flex-1 gap-fluid-sm">{children}</div>
    </GlassPanel>
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
      <div className="ds-ambient view-enter custom-scrollbar flex min-h-0 flex-1 flex-col gap-fluid-sm overflow-y-auto p-fluid-md">
        <Section title="Outcomes" right={r ? `${r.calls} calls ${scopeWord}` : ''} height="h-[16rem]">
          <CalloutTile
            title="Contact rate"
            sentence="Humans reached out of completed calls."
            value={r && r.calls ? pct(r.humans, r.calls) : '—'}
            label="human answered"
            lines={[`${r?.humans ?? 0} of ${r?.calls ?? 0} completed calls`, `${r?.callbacks ?? 0} asked for a callback`]}
          />
          <CalloutTile
            title="Payments"
            sentence="Calls where a payment went through on the line."
            value={r ? String(r.payments) : '—'}
            label="payments taken"
            lines={[
              r && r.humans ? `${pct(r.payments, r.humans)} of humans reached` : 'no humans reached yet',
              `${r?.handled ?? 0} handled: paid, promised, plan or dispute`,
              `${r?.dncAdded ?? 0} added to do not call by what they said`,
            ]}
          />
          <OutcomeBars
            title="Machine detection"
            sentence="What answered, across the scope."
            replayKey={key}
            entries={(r?.amd ?? []).slice(0, 6).map((e) => ({ label: e.label, value: e.value, color: e.label.includes('human') ? 'var(--chart-series-2)' : e.label.includes('voicemail') ? 'var(--chart-seq-4)' : 'var(--chart-series-1)' }))}
          />
          <AttemptsTrend
            title="Volume"
            sentence={scope === 'today' ? 'Per hour across the last twelve hours.' : scope === 'week' ? 'Per day across the last seven days.' : 'Per day across the last thirty days.'}
            replayKey={key}
            labels={r?.trend.labels ?? []}
            series={[
              { name: 'attempts', values: r?.trend.attempts ?? [], color: 'var(--chart-series-3)' },
              { name: 'human', values: r?.trend.human ?? [], color: 'var(--chart-series-2)' },
              { name: 'payments', values: r?.trend.payments ?? [], color: 'var(--chart-series-1)' },
            ]}
          />
        </Section>

        <Section title="Cost" right={cost ? `${formatCost(cost.today)} ${scopeWord} · ${formatCost(cost.allTime)} all time` : ''} height="h-[13rem]">
          <CalloutTile
            title="Spend"
            sentence="Amazon Connect, prorated per second at the billed AI-tier rates."
            value={cost ? formatCost(cost.today) : '—'}
            label={scopeWord}
            lines={[
              `${cost?.campaignMinutes.toFixed(1) ?? '0.0'} min dialing · ${cost?.answeredMinutes.toFixed(1) ?? '0.0'} min answered`,
              `${formatCost(RATES.campaignPerMinute)}/min dialing + ${formatCost(RATES.voicePerMinute + RATES.telephonyPerMinute)}/min answered, Contact Lens ${RATES.lensPerMinute ? formatCost(RATES.lensPerMinute) + '/min' : 'included'}`,
              cost?.estimatedAttempts ? `${cost.estimatedAttempts} calls estimated from outcome` : 'every call priced from recorded durations',
            ]}
          />
          <CalloutTile title="Per call" sentence="Average cost of one attempt." value={cost ? formatCost(cost.perAttempt) : '—'} label="per attempt" lines={[`${cost?.attempts ?? 0} priced attempts`]} />
          <CalloutTile title="Per human" sentence="Spend divided by humans reached." value={cost?.perHuman === null || cost?.perHuman === undefined ? '—' : formatCost(cost.perHuman)} label="per human reached" lines={[`${r?.humans ?? 0} humans reached`]} />
          <CalloutTile title="Per payment" sentence="Spend divided by payments taken." value={cost?.perPayment === null || cost?.perPayment === undefined ? '—' : formatCost(cost.perPayment)} label="per payment" lines={[`${cost?.payments ?? 0} payments taken`]} />
        </Section>

        <Section title="Conversation" right={r ? `${r.analysed} analysed` : ''} height="h-[16rem]">
          <CalloutTile
            title="Patient sentiment"
            sentence="Contact Lens score from -5 to +5."
            value={r?.avgCustomerSentiment === null || r?.avgCustomerSentiment === undefined ? '—' : `${r.avgCustomerSentiment > 0 ? '+' : ''}${r.avgCustomerSentiment.toFixed(1)}`}
            label="average"
            lines={[
              r?.talkShareAgent === null || r?.talkShareAgent === undefined ? 'no talk-share data yet' : `agent talks ${Math.round(r.talkShareAgent * 100)}% of the time`,
              r?.avgInterruptions === null || r?.avgInterruptions === undefined ? '' : `${r.avgInterruptions.toFixed(1)} interruptions per call`,
              r?.avgNonTalkShare === null || r?.avgNonTalkShare === undefined ? '' : `${Math.round(r.avgNonTalkShare * 100)}% silence`,
              r?.avgAgentWpm === null || r?.avgAgentWpm === undefined ? '' : `agent pace ${Math.round(r.avgAgentWpm)} words per minute`,
            ].filter(Boolean)}
          />
          <OutcomeBars title="Sentiment" sentence="Patient turns by Contact Lens sentiment." replayKey={key} entries={(r?.sentiment ?? []).map((e) => ({ label: e.label, value: e.value, color: SENTIMENT_COLOR[e.label] ?? 'var(--chart-other)' }))} />
          <RankList title="What was said" sentence="Category rules matched on transcripts." entries={r?.categories ?? []} empty="No matches yet. Categories appear once an agent call has been analysed." color="var(--chart-series-5)" />
          <CalloutTile
            title="Ring and quality"
            sentence="Seconds to pickup and Connect's audio score."
            value={num(r?.avgRingSeconds, 0, 's')}
            label="average ring"
            lines={[
              r?.avgGreetingSeconds === null || r?.avgGreetingSeconds === undefined ? 'no greeting timings yet' : `${r.avgGreetingSeconds.toFixed(1)}s greeting before AMD decided`,
              r?.avgTalkSeconds === null || r?.avgTalkSeconds === undefined ? 'no agent talk time yet' : `${mmss(r.avgTalkSeconds)} average agent talk`,
              r?.avgQuality === null || r?.avgQuality === undefined ? 'no audio scores yet' : `audio ${r.avgQuality.toFixed(2)} of 5${r.qualityIssues.length ? `, ${r.qualityIssues[0]?.label}` : ''}`,
            ]}
          />
        </Section>

        <Section title="Needs a look" right={r ? `${r.flagged.length} flagged` : ''} height="h-[16rem]">
          <DataTable columns={FLAG_COLUMNS} rows={r?.flagged ?? []} rowKey={(f) => String(f.id)} rowClass={() => 'text-content-secondary'} empty={{ title: 'Nothing flagged', description: 'Upset patients, supervisor requests, long silences, sentiment drops and unverified identity land here. Each one also emails you.' }} />
          <div className="flex w-[22rem] shrink-0 flex-col">
            <RankList title="How calls ended" sentence="Disconnect reason from the contact record." entries={r?.disconnects ?? []} empty="No disconnect detail recorded yet." color="var(--chart-series-4)" />
          </div>
        </Section>

        <GlassPanel padding="sm" gap="xs" className="min-h-[13rem] flex-1">
          <header className="flex items-center justify-between">
            <PanelTitle>Agents</PanelTitle>
          </header>
          <DataTable columns={AGENT_COLUMNS} rows={r?.agents ?? []} rowKey={(a) => a.agentId} rowClass={() => 'text-content-secondary'} empty={{ title: 'No agent-handled calls in this scope', description: 'Talk, hold and after-call-work appear once a patient reaches an agent.' }} />
        </GlassPanel>
      </div>
    </div>
  );
}
