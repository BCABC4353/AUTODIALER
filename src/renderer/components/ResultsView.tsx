import { Download, RefreshCw, Trash2 } from 'lucide-react';
import { Button, GlassPanel, PanelTitle } from '@ds/index.js';
import type { ResultRow } from '@shared/types';
import { formatPhone, stripE164 } from '@shared/phone';
import { formatLocal } from '@shared/time';
import { outcomeLabel, outcomeTone } from '@shared/outcome';
import { formatCost } from '@shared/pricing';
import { plural } from '../lib/format';
import { ActionBar } from './ActionBar';
import { BlankDash, DataTable, type Column } from './DataTable';

const TONE_TEXT: Record<string, string> = {
  emerald: 'text-chip-emerald-fg',
  amber: 'text-chip-amber-fg',
  orange: 'text-chip-org-fg',
  slate: 'text-content-secondary',
};

const COLUMNS: Column<ResultRow>[] = [
  { id: 'attempted', label: 'Attempted', width: '9rem', mono: true, cell: (r) => formatLocal(r.attempted_at) },
  { id: 'run', label: 'Run', width: '8rem', mono: true, cell: (r) => r.run },
  { id: 'patient', label: 'Patient', cell: (r) => r.patient || <BlankDash /> },
  { id: 'phone', label: 'Phone', width: '10rem', mono: true, cell: (r) => formatPhone(stripE164(r.phone)) },
  {
    id: 'outcome',
    label: 'Outcome',
    width: '11rem',
    cell: (r) => <span className={r.outcome ? TONE_TEXT[outcomeTone(r.outcome)] : 'text-content-muted'}>{outcomeLabel(r.outcome)}</span>,
  },
  { id: 'talk', label: 'Talk', width: '5rem', align: 'right', mono: true, cell: (r) => (r.talk_seconds === null ? <BlankDash /> : `${r.talk_seconds}s`) },
  { id: 'dial', label: 'Dial', width: '5rem', align: 'right', mono: true, cell: (r) => (r.dial_seconds === null ? <BlankDash /> : `${r.dial_seconds}s`) },
  {
    id: 'cost',
    label: 'Cost',
    width: '6rem',
    align: 'right',
    mono: true,
    cell: (r) => (r.outcome ? <span title={r.cost_estimated ? 'estimated from the outcome; durations were not recorded' : undefined}>{formatCost(r.cost)}{r.cost_estimated ? '*' : ''}</span> : <BlankDash />),
  },
  { id: 'contact', label: 'Contact', width: '20rem', mono: true, cell: (r) => r.contact_id || <BlankDash /> },
];

export function ResultsView({
  results,
  onRefresh,
  onExport,
  onClear,
}: {
  results: ResultRow[];
  onRefresh: () => void;
  onExport: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ActionBar
        left={
          <>
            <Button variant="refresh" size="chrome" onClick={onRefresh}>
              <RefreshCw size={13} />
              Refresh
            </Button>
            <Button variant="gradient-blue" size="chrome" onClick={onExport} className="font-black uppercase">
              <Download size={13} />
              Export CSV
            </Button>
            <span className="text-fluid-label font-bold text-content-muted tabular-nums">
              {plural(results.length, 'attempt')} · {formatCost(results.reduce((sum, r) => sum + (r.outcome ? r.cost : 0), 0))} shown
            </span>
          </>
        }
        right={
          <Button
            variant="chrome-ctl"
            size="chrome"
            onClick={onClear}
            className="border-chip-red-bd bg-chip-red-bg text-chip-red-fg hover:border-status-danger"
          >
            <Trash2 size={13} />
            Clear history
          </Button>
        }
      />
      <div className="ds-ambient view-enter flex min-h-0 flex-1 flex-col p-fluid-md">
        <GlassPanel padding="sm" gap="xs" className="min-h-0 flex-1">
          <header className="flex items-center justify-between">
            <PanelTitle>Attempts</PanelTitle>
          </header>
          <DataTable
            columns={COLUMNS}
            rows={results}
            rowKey={(r) => String(r.id)}
            rowClass={() => 'text-content-secondary'}
            empty={{ title: 'No attempts yet', description: 'Start dialing and outcomes will land here as calls disconnect.' }}
          />
        </GlassPanel>
      </div>
    </div>
  );
}
