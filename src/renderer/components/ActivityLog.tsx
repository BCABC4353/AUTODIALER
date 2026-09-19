import { useEffect, useRef, useState } from 'react';
import { GlassPanel, PanelTitle, SegmentedControl } from '@ds/index.js';
import type { LogLine } from '@shared/types';

const LEVEL_CLASS: Record<LogLine['level'], string> = {
  '': 'text-content-secondary',
  ok: 'text-status-success',
  err: 'text-status-danger',
};

type Mode = 'calls' | 'all';

export function ActivityLog({ lines }: { lines: LogLine[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>('calls');
  const shown = mode === 'all' ? lines : lines.filter((l) => l.kind === 'call' || l.level === 'err');
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [shown.length, mode]);
  return (
    <GlassPanel padding="sm" gap="xs" className="min-h-0 flex-1">
      <header className="flex items-center justify-between gap-3">
        <PanelTitle>{mode === 'calls' ? 'Calls' : 'Everything'}</PanelTitle>
        <div className="flex items-center gap-3">
          <span className="font-mono text-fluid-micro text-content-muted tabular-nums">{shown.length} lines</span>
          <SegmentedControl
            label="Show"
            items={[
              { id: 'calls', label: 'Calls', pressed: mode === 'calls' },
              { id: 'all', label: 'Everything', pressed: mode === 'all' },
            ]}
            onSelect={(id: Mode) => setMode(id)}
          />
        </div>
      </header>
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto rounded-md border border-glass-edge bg-surface-base/60 px-3 py-2 font-mono text-data-xs leading-relaxed">
        {shown.length === 0 && (
          <div className="ds-smallcaps text-content-muted normal-case">
            {mode === 'calls' ? 'Nothing yet. Each call appears here as it happens: next up, ringing, answered, on the line, finished.' : 'Nothing yet.'}
          </div>
        )}
        {shown.map((line, i) => (
          <div key={`${line.ts}-${i}`} className="log-line flex gap-3 whitespace-pre-wrap break-words">
            <span className="shrink-0 text-fluid-micro text-content-muted tabular-nums">{line.ts}</span>
            <span className={LEVEL_CLASS[line.level]}>{line.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </GlassPanel>
  );
}
