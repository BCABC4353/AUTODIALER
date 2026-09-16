import { useEffect, useRef } from 'react';
import { GlassPanel, PanelTitle } from '@ds/index.js';
import type { LogLine } from '@shared/types';

const LEVEL_CLASS: Record<LogLine['level'], string> = {
  '': 'text-content-secondary',
  ok: 'text-status-success',
  err: 'text-status-danger',
};

export function ActivityLog({ lines }: { lines: LogLine[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [lines.length]);
  return (
    <GlassPanel padding="sm" gap="xs" className="min-h-0 flex-1">
      <header className="flex items-center justify-between">
        <PanelTitle>Activity</PanelTitle>
        <span className="font-mono text-fluid-micro text-content-muted tabular-nums">{lines.length} lines</span>
      </header>
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto rounded-md border border-glass-edge bg-surface-base/60 px-3 py-2 font-mono text-data-xs leading-relaxed">
        {lines.length === 0 && <div className="ds-smallcaps text-content-muted normal-case">Nothing yet. Start dialing to see pushes and outcomes here.</div>}
        {lines.map((line, i) => (
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
