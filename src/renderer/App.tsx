import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@ds/index.js';
import { DialView } from './components/DialView';
import { Footer } from './components/Footer';
import { ForceUpdateModal } from './components/ForceUpdateModal';
import { Header, type View } from './components/Header';
import { LoadView } from './components/LoadView';
import { PhoneRail } from './components/PhoneRail';
import { ResultsView } from './components/ResultsView';
import { useDialer } from './state/useDialer';

export function App() {
  const [view, setView] = useState<View>('dial');
  const d = useDialer();
  return (
    <div className="@container/app flex h-full flex-col bg-surface-deep text-content">
      <Header view={view} onView={setView} status={d.status} patientCount={d.patients.length} />
      {d.error && (
        <div role="alert" className="animate-slide-in-top z-30 flex items-center justify-between gap-3 border-b border-glass-edge bg-conflict-wash px-fluid-md py-2">
          <span className="ds-smallcaps min-w-0 truncate text-fluid-label text-content normal-case">
            <span className="font-black uppercase tracking-wider text-accent-text">{d.error.title}</span>
            {' · '}
            {d.error.message}
          </span>
          <Button variant="ghost" size="sm" onClick={d.dismissError} aria-label="Dismiss">
            <X size={14} />
          </Button>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {view === 'load' && (
            <LoadView key="load" patients={d.patients} onImport={() => void d.importCsv()} onRefresh={() => void d.refreshPatients()} onToggleDnc={(run) => void d.toggleDnc(run)} />
          )}
          {view === 'dial' && (
            <DialView key="dial" status={d.status} now={d.now} log={d.log} session={d.session} onStart={() => void d.start()} onStop={() => void d.stop()} />
          )}
          {view === 'results' && (
            <ResultsView key="results" results={d.results} onRefresh={() => void d.refreshResults()} onExport={() => void d.exportCsv()} onClear={() => void d.clearHistory()} />
          )}
        </main>
        <PhoneRail />
      </div>
      <Footer status={d.status} />
      {d.update && <ForceUpdateModal state={d.update} onRestart={() => void window.dialer.app.restartNow()} />}
    </div>
  );
}
