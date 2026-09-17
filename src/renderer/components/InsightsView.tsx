import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, GlassPanel, PanelTitle, SegmentedControl } from '@ds/index.js';
import type { AgentSummary, InsightScope, InsightsReport } from '@shared/types';
import { ActionBar } from './ActionBar';
import { BlankDash, DataTable, type Column } from './DataTable';
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

function RankList({ title, sentence, entries, empty }: { title: string; sentence: string; entries: { label: string; value: number }[]; empty: string }) {
  const max = Math.max(1, ...entries.map((e) => e.value));
  return (
    <Tile title={title} sentence={sentence}>
      {entries.length === 0 ? (
        <div className="ds-smallcaps flex flex-1 items-center justify-center rounded-md border border-dashed border-glass-edge px-3 py-2 text-fluid-label text-content-muted normal-case">{empty}</div>
      ) : (
        <ul className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
          {entries.slice(0, 8).map((e) => (
            <li key={e.label} className="flex flex-col gap-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="ds-smallcaps truncate text-fluid-label text-content normal-case">{e.label}</span>
                <span className="font-mono text-fluid-nano text-content-muted tabular-nums">{e.value}</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-surface-overlay">
                <div className="ds-chart-mark h-full rounded-full" style={{ width: `${(e.value / max) * 100}%`, '--chart-mark-c': 'var(--chart-series-3)' } as React.CSSProperties} />
              </div>
            </li>
          ))}
        </ul>
      )}
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
  const coverage = r ? `${r.detailed} of ${r.calls} calls with Connect detail, ${r.analysed} with a transcript` : '';
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
        <GlassPanel padding="sm" gap="xs" className="h-[15rem] shrink-0">
          <header className="flex items-center justify-between">
            <PanelTitle>Calls</PanelTitle>
          </header>
          <div className="flex min-h-0 flex-1 gap-fluid-sm">
            <CalloutTile
              title="Ring to answer"
              sentence="Average seconds from ring start to pickup."
              value={r?.avgRingSeconds === null || r?.avgRingSeconds === undefined ? '—' : `${r.avgRingSeconds.toFixed(0)}s`}
              label="average ring"
              lines={[
                r?.avgGreetingSeconds === null || r?.avgGreetingSeconds === undefined ? 'no greeting timings yet' : `${r.avgGreetingSeconds.toFixed(1)}s average greeting before AMD decided`,
                r?.avgTalkSeconds === null || r?.avgTalkSeconds === undefined ? 'no agent talk time yet' : `${mmss(r.avgTalkSeconds)} average agent talk time`,
              ]}
            />
            <CalloutTile
              title="Audio quality"
              sentence="Connect's 0 to 5 score across both sides."
              value={r?.avgQuality === null || r?.avgQuality === undefined ? '—' : r.avgQuality.toFixed(2)}
              label="average score"
              lines={r?.qualityIssues.length ? r.qualityIssues.slice(0, 3).map((q) => `${q.value}× ${q.label}`) : ['no audio issues flagged']}
            />
            <OutcomeBars title="Outcomes" sentence="Machine-detection verdicts across the scope." replayKey={`${scope}-${r?.calls ?? 0}`} entries={(r?.amd ?? []).slice(0, 6).map((e) => ({ label: e.label, value: e.value, color: e.label.includes('human') ? 'var(--chart-series-2)' : e.label.includes('voicemail') ? 'var(--chart-seq-4)' : 'var(--chart-series-1)' }))} />
            <OutcomeBars title="Sentiment" sentence="Patient turns by Contact Lens sentiment." replayKey={`${scope}-${r?.analysed ?? 0}`} entries={(r?.sentiment ?? []).map((e) => ({ label: e.label, value: e.value, color: SENTIMENT_COLOR[e.label] ?? 'var(--chart-other)' }))} />
            <CalloutTile
              title="Conversation"
              sentence="Patient sentiment score, -5 to +5, and how calls flow."
              value={r?.avgCustomerSentiment === null || r?.avgCustomerSentiment === undefined ? '—' : `${r.avgCustomerSentiment > 0 ? '+' : ''}${r.avgCustomerSentiment.toFixed(1)}`}
              label="patient sentiment"
              lines={[
                r?.talkShareAgent === null || r?.talkShareAgent === undefined ? 'no talk-share data yet' : `agent talks ${Math.round(r.talkShareAgent * 100)}% of the time`,
                r?.avgInterruptions === null || r?.avgInterruptions === undefined ? '' : `${r.avgInterruptions.toFixed(1)} interruptions per call`,
                r?.avgNonTalkShare === null || r?.avgNonTalkShare === undefined ? '' : `${Math.round(r.avgNonTalkShare * 100)}% silence`,
                r?.avgAgentWpm === null || r?.avgAgentWpm === undefined ? '' : `agent pace ${Math.round(r.avgAgentWpm)} words per minute`,
              ].filter(Boolean)}
            />
          </div>
        </GlassPanel>

        <GlassPanel padding="sm" gap="xs" className="h-[14rem] shrink-0">
          <header className="flex items-center justify-between">
            <PanelTitle>What was said</PanelTitle>
          </header>
          <div className="flex min-h-0 flex-1 gap-fluid-sm">
            <RankList title="Categories" sentence="Contact Lens rules matched on transcripts." entries={r?.categories ?? []} empty="No categories yet. Define rules in Contact Lens and they will count here." />
            <RankList title="How calls ended" sentence="Disconnect reason from the contact record." entries={r?.disconnects ?? []} empty="No disconnect detail recorded yet." />
          </div>
        </GlassPanel>

        <GlassPanel padding="sm" gap="xs" className="min-h-[14rem] flex-1">
          <header className="flex items-center justify-between">
            <PanelTitle>Agents</PanelTitle>
          </header>
          <DataTable columns={AGENT_COLUMNS} rows={r?.agents ?? []} rowKey={(a) => a.agentId} rowClass={() => 'text-content-secondary'} empty={{ title: 'No agent-handled calls in this scope', description: 'Talk, hold and after-call-work appear once a patient reaches an agent.' }} />
        </GlassPanel>
      </div>
    </div>
  );
}
