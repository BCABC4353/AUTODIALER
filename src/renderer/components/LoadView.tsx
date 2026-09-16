import { RefreshCw, Upload } from 'lucide-react';
import { Button, GlassPanel, PanelTitle } from '@ds/index.js';
import type { Patient } from '@shared/types';
import { formatPhone } from '@shared/phone';
import { tzLabel } from '@shared/tz';
import { money, plural } from '../lib/format';
import { ActionBar } from './ActionBar';
import { BlankDash, DataTable, type Column } from './DataTable';

const COLUMNS: Column<Patient>[] = [
  { id: 'run', label: 'Run', width: '9rem', mono: true, cell: (p) => p.run },
  { id: 'patient', label: 'Patient', cell: (p) => p.patient || <BlankDash /> },
  {
    id: 'phone',
    label: 'Phone',
    width: '10rem',
    mono: true,
    cell: (p) => (p.phone ? formatPhone(p.phone) : <span className="text-status-danger">INVALID</span>),
  },
  { id: 'balance', label: 'Balance', width: '8rem', align: 'right', mono: true, cell: (p) => money(p.balance) || <BlankDash /> },
  { id: 'tz', label: 'Time zone', width: '10rem', cell: (p) => tzLabel(p.tz) },
  { id: 'dnc', label: 'DNC', width: '5rem', align: 'center', cell: (p) => (p.dnc ? <span className="text-accent-text">DNC</span> : '') },
];

export function LoadView({
  patients,
  onImport,
  onRefresh,
  onToggleDnc,
}: {
  patients: Patient[];
  onImport: () => void;
  onRefresh: () => void;
  onToggleDnc: (run: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ActionBar
        left={
          <>
            <Button variant="primary" size="chrome" onClick={onImport} className="font-black uppercase">
              <Upload size={13} />
              Open CSV
            </Button>
            <Button variant="refresh" size="chrome" onClick={onRefresh}>
              <RefreshCw size={13} />
              Refresh
            </Button>
            <span className="text-fluid-label font-bold text-content-muted tabular-nums">{plural(patients.length, 'patient')} loaded</span>
          </>
        }
        right={<span className="text-fluid-nano font-black uppercase tracking-wider text-content-muted">Right-click a row to toggle do not call</span>}
      />
      <div className="ds-ambient view-enter flex min-h-0 flex-1 flex-col p-fluid-md">
        <GlassPanel padding="sm" gap="xs" className="min-h-0 flex-1">
          <header className="flex items-center justify-between">
            <PanelTitle>Patients</PanelTitle>
          </header>
          <DataTable
            columns={COLUMNS}
            rows={patients}
            rowKey={(p) => p.run}
            rowClass={(p) => (p.dnc ? 'text-content-subtle' : !p.phone ? 'text-content-muted' : 'text-content-secondary')}
            onContextMenu={(p) => onToggleDnc(p.run)}
            empty={{ title: 'No patients loaded', description: 'Open a CSV with NAME, BALANCE, RUN NUMBER and PHONE columns.' }}
          />
        </GlassPanel>
      </div>
    </div>
  );
}
