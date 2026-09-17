import { useEffect, useRef, useState } from 'react';
import { Play, RefreshCw, X } from 'lucide-react';
import { Button, Pill, SectionHeader } from '@ds/index.js';
import type { CallCharacteristics, ResultDetail, ResultRow } from '@shared/types';
import { formatLocal } from '@shared/time';
import { outcomeLabel, outcomeTone } from '@shared/outcome';
import { categoryLabel, categoryRule } from '@shared/categories';

const EFFECT_TONE: Record<string, string> = { dnc: 'red', handled: 'emerald', callback: 'amber', flag: 'violet' };

function scoreTone(score: number | null): string {
  if (score === null) return 'text-content-muted';
  if (score >= 1.5) return 'text-chip-emerald-fg';
  if (score <= -1.5) return 'text-chip-org-fg';
  return 'text-content-secondary';
}

function QuarterTrend({ scores, label }: { scores: number[]; label: string }) {
  if (scores.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-fluid-micro font-black uppercase tracking-wider text-content-muted">{label}</span>
      <div className="flex h-8 items-end gap-1">
        {scores.map((s, i) => {
          const h = Math.max(8, (Math.abs(s) / 5) * 100);
          const color = s > 0.5 ? 'var(--chart-series-2)' : s < -0.5 ? 'var(--chart-series-1)' : 'var(--chart-series-4)';
          return <span key={i} title={`quarter ${i + 1}: ${s > 0 ? '+' : ''}${s}`} className="ds-chart-mark flex-1 rounded-t-sm" style={{ height: `${h}%`, '--chart-mark-c': color } as React.CSSProperties} />;
        })}
      </div>
    </div>
  );
}

function Characteristics({ ch }: { ch: CallCharacteristics }) {
  const agentTalk = ch.talkSeconds.agent ?? 0;
  const patientTalk = ch.talkSeconds.customer ?? 0;
  const total = agentTalk + patientTalk;
  const agentShare = total > 0 ? Math.round((agentTalk / total) * 100) : null;
  return (
    <section className="flex flex-col gap-2">
      <SectionHeader as="h4" size="eyebrow">
        Conversation
      </SectionHeader>
      {agentShare !== null && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-fluid-micro font-black uppercase tracking-wider text-content-muted">
            <span>agent {agentShare}%</span>
            <span>patient {100 - agentShare}%</span>
          </div>
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-overlay">
            <span className="h-full" style={{ width: `${agentShare}%`, background: 'var(--chart-series-3)' }} />
            <span className="h-full flex-1" style={{ background: 'var(--chart-seq-4)' }} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-x-3 gap-y-2">
        <Fact label="Sentiment" value={ch.sentiment.customer === null ? '—' : `${ch.sentiment.customer > 0 ? '+' : ''}${ch.sentiment.customer}`} tone={scoreTone(ch.sentiment.customer)} />
        <Fact label="Agent tone" value={ch.sentiment.agent === null ? '—' : `${ch.sentiment.agent > 0 ? '+' : ''}${ch.sentiment.agent}`} tone={scoreTone(ch.sentiment.agent)} />
        <Fact label="Silence" value={ch.nonTalkSeconds === null ? '—' : `${ch.nonTalkSeconds}s`} />
        <Fact label="Interruptions" value={`${ch.interruptions.count} (${ch.interruptions.byAgent} agent)`} tone={ch.interruptions.count > 2 ? 'text-chip-amber-fg' : undefined} />
        <Fact label="Pace" value={ch.wordsPerMinute.agent === null && ch.wordsPerMinute.customer === null ? '—' : `${ch.wordsPerMinute.agent ?? '–'} / ${ch.wordsPerMinute.customer ?? '–'} wpm`} />
        <Fact label="Loudness" value={ch.loudness.agent === null && ch.loudness.customer === null ? '—' : `${ch.loudness.agent ?? '–'} / ${ch.loudness.customer ?? '–'}`} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <QuarterTrend scores={ch.sentimentByQuarter.customer} label="patient sentiment by quarter" />
        <QuarterTrend scores={ch.sentimentByQuarter.agent} label="agent sentiment by quarter" />
      </div>
      {(ch.issues.length > 0 || ch.outcomes.length > 0 || ch.actionItems.length > 0) && (
        <ul className="ds-smallcaps flex flex-col gap-1 text-fluid-label normal-case">
          {ch.issues.map((t, i) => (
            <li key={`i${i}`} className="text-chip-org-fg">
              issue · {t}
            </li>
          ))}
          {ch.outcomes.map((t, i) => (
            <li key={`o${i}`} className="text-chip-emerald-fg">
              outcome · {t}
            </li>
          ))}
          {ch.actionItems.map((t, i) => (
            <li key={`a${i}`} className="text-chip-blue-fg">
              action · {t}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const SENTIMENT_CLASS: Record<string, string> = {
  POSITIVE: 'text-chip-emerald-fg',
  NEGATIVE: 'text-chip-org-fg',
  MIXED: 'text-chip-amber-fg',
  NEUTRAL: 'text-content-secondary',
};

function seconds(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${value}s`;
}

function clock(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour12: false });
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <SectionHeader as="span" size="eyebrow">
        {label}
      </SectionHeader>
      <span className={`truncate font-mono text-fluid-label font-bold tabular-nums ${tone ?? 'text-content'}`}>{value}</span>
    </div>
  );
}

export function CallDetail({ row, analysisTick, onClose }: { row: ResultRow; analysisTick: number; onClose: () => void }) {
  const [detail, setDetail] = useState<ResultDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioState, setAudioState] = useState<'idle' | 'loading' | 'missing' | 'error'>('idle');
  const urlRef = useRef<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setDetail(await window.dialer.results.detail(row.id));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setDetail(null);
    setAudioState('idle');
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setAudioUrl(null);
    void load();
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id, analysisTick]);

  const playRecording = async () => {
    setAudioState('loading');
    try {
      const bytes = await window.dialer.results.recording(row.id);
      if (!bytes) {
        setAudioState('missing');
        return;
      }
      const blob = new Blob([new Uint8Array(bytes)], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      setAudioUrl(url);
      setAudioState('idle');
    } catch {
      setAudioState('error');
    }
  };

  const d = detail?.detail ?? null;
  const analysis = detail?.analysis ?? null;
  const summary = analysis?.summary ?? detail?.note ?? null;

  return (
    <div className="custom-scrollbar flex min-h-0 w-[26rem] shrink-0 flex-col gap-fluid-sm overflow-y-auto rounded-md border border-line bg-surface-base p-fluid-sm">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-fluid-body font-black uppercase tracking-wider text-content">{row.patient || row.run}</div>
          <div className="font-mono text-fluid-nano text-content-muted tabular-nums">
            {row.run} · {formatLocal(row.attempted_at)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Pill tone={outcomeTone(row.outcome)} size="sm" intensity="solid">
            {outcomeLabel(row.outcome)}
          </Pill>
          <Button variant="ghost" size="sm" aria-label="Refresh detail" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button variant="ghost" size="sm" aria-label="Close detail" onClick={onClose}>
            <X size={13} />
          </Button>
        </div>
      </header>

      {!d && (
        <div className="ds-smallcaps text-fluid-label text-content-muted normal-case">
          {loading ? 'Reading the contact from Connect…' : 'No contact record for this attempt.'}
        </div>
      )}

      {d && (
        <div className="grid grid-cols-3 gap-x-3 gap-y-2">
          <Fact label="Dialed" value={clock(d.initiatedAt)} />
          <Fact label="Answered" value={clock(d.answeredAt)} />
          <Fact label="Ended" value={clock(d.disconnectedAt)} />
          <Fact label="Ring" value={seconds(d.ringSeconds)} />
          <Fact label="Greeting" value={seconds(d.greetingSeconds)} />
          <Fact label="Answered for" value={seconds(d.answeredSeconds)} />
          <Fact label="AMD" value={d.amd ? d.amd.replace(/_/g, ' ').toLowerCase() : '—'} />
          <Fact label="Ended by" value={d.disconnectReason ? d.disconnectReason.replace(/_/g, ' ').toLowerCase() : '—'} />
          <Fact label="Audio" value={d.quality.agent === null && d.quality.customer === null ? '—' : `${d.quality.agent ?? '–'} / ${d.quality.customer ?? '–'}`} tone={d.quality.issues.length ? 'text-chip-amber-fg' : undefined} />
          {d.agent && (
            <>
              <Fact label="Agent" value={d.agent.username ?? d.agent.id.slice(0, 8)} tone="text-chip-emerald-fg" />
              <Fact label="Talk" value={seconds(d.agent.talkSeconds)} />
              <Fact label="Hold" value={`${d.agent.holdSeconds}s ×${d.agent.holdCount}`} />
              <Fact label="After call" value={seconds(d.agent.acwSeconds)} />
              <Fact label="Device" value={d.agent.device ?? '—'} />
            </>
          )}
          {d.quality.issues.length > 0 && <Fact label="Audio issues" value={d.quality.issues.join(', ').replace(/_/g, ' ').toLowerCase()} tone="text-chip-amber-fg" />}
        </div>
      )}

      {d?.agent && (
        <section className="flex flex-col gap-2">
          <SectionHeader as="h4" size="eyebrow">
            Recording
          </SectionHeader>
          {audioUrl ? (
            <audio controls autoPlay src={audioUrl} className="w-full" />
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="gradient-blue" size="chrome" onClick={() => void playRecording()} disabled={audioState === 'loading'} className="font-black uppercase">
                <Play size={12} />
                {audioState === 'loading' ? 'Fetching' : 'Play recording'}
              </Button>
              {audioState === 'missing' && <span className="ds-smallcaps text-fluid-label text-content-muted normal-case">No recording in the bucket yet.</span>}
              {audioState === 'error' && <span className="ds-smallcaps text-fluid-label text-status-danger normal-case">Could not fetch the recording.</span>}
            </div>
          )}
        </section>
      )}

      {d?.agent && (
        <section className="flex flex-col gap-2">
          <SectionHeader as="h4" size="eyebrow">
            Summary
          </SectionHeader>
          {summary ? (
            <p className="ds-smallcaps text-fluid-label leading-relaxed text-content normal-case">{summary}</p>
          ) : (
            <p className="ds-smallcaps text-fluid-label text-content-muted normal-case">
              {analysis?.status === 'unavailable' ? 'Contact Lens produced nothing for this call.' : 'Waiting for Contact Lens; usually a few minutes after the call ends.'}
            </p>
          )}
          {analysis && analysis.categories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {analysis.categories.map((c) => (
                <Pill key={c} tone={EFFECT_TONE[categoryRule(c)?.effect ?? ''] ?? 'violet'} size="sm" intensity={analysis.actions.includes(c) ? 'solid' : 'subtle'} border={!analysis.actions.includes(c)}>
                  {categoryLabel(c)}
                </Pill>
              ))}
            </div>
          )}
        </section>
      )}

      {analysis?.characteristics && <Characteristics ch={analysis.characteristics} />}

      {analysis && analysis.transcript.length > 0 && (
        <section className="flex min-h-0 flex-col gap-2">
          <SectionHeader as="h4" size="eyebrow">
            Transcript
          </SectionHeader>
          <ol className="flex flex-col gap-1.5">
            {analysis.transcript.map((t) => (
              <li key={t.id} className="flex gap-2">
                <span className={`shrink-0 font-mono text-fluid-micro font-bold uppercase tabular-nums ${t.role === 'AGENT' ? 'text-chip-blue-fg' : 'text-chip-amber-fg'}`}>
                  {t.role === 'AGENT' ? 'agent' : t.role === 'CUSTOMER' ? 'patient' : t.role.toLowerCase()}
                </span>
                <span className={`ds-smallcaps min-w-0 text-fluid-label leading-snug normal-case ${SENTIMENT_CLASS[t.sentiment ?? 'NEUTRAL'] ?? 'text-content-secondary'}`}>{t.text}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
