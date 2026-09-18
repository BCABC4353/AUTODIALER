import type { CSSProperties, ReactNode } from 'react';
import { Tile } from './Tile';
import { enterVars, useChartEntry } from './chartEnter';

export interface BarEntry {
  label: string;
  value: number;
  color: string;
}

export function OutcomeBars({ title, sentence, right, entries, replayKey }: { title: string; sentence?: string; right?: ReactNode; entries: BarEntry[]; replayKey: string }) {
  const peak = Math.max(0, ...entries.map((e) => e.value));
  const entryClass = useChartEntry(entries.length, replayKey);
  return (
    <Tile title={title} sentence={sentence} right={right}>
      <div className={`ds-chart-plot relative min-h-0 flex-1 ${entryClass}`}>
        <span aria-hidden="true" className="ds-chart-backdrop" />
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          {[0.25, 0.5, 0.75].map((f) => (
            <span key={f} className="ds-chart-rule" style={{ top: `${f * 100}%` }} />
          ))}
        </span>
        <div aria-hidden="true" className="flex h-full items-end gap-fluid-xs pt-5">
          {entries.map((entry, i) => {
            const height = peak > 0 ? Math.max(2, (entry.value / peak) * 100) : 2;
            return (
              <div key={entry.label} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                <div className="relative flex h-full items-end justify-center">
                  <span
                    className="ds-chart-mark ds-chart-rise block w-full rounded-t-sm"
                    style={{ height: `${height}%`, '--chart-mark-c': entry.color, ...enterVars(i, entries.length) } as CSSProperties}
                  >
                    <span
                      className="ds-chart-pill ds-chart-label absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[calc(100%+3px)] whitespace-nowrap rounded-sm px-1 py-px text-content tabular-nums"
                      style={{ '--chart-pill-c': entry.color } as CSSProperties}
                    >
                      {entry.value.toLocaleString('en-US')}
                    </span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div aria-hidden="true" className="ds-chart-label mt-1 flex shrink-0 items-start gap-fluid-xs overflow-hidden text-content-muted">
        {entries.map((entry) => (
          <span key={entry.label} className="min-w-0 flex-1 truncate text-center leading-tight">
            {entry.label}
          </span>
        ))}
      </div>
    </Tile>
  );
}
