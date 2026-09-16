import { useId, type CSSProperties } from 'react';
import { Tile } from './Tile';
import { enterVars, useChartEntry } from './chartEnter';

const VIEW_W = 100;
const VIEW_H = 44;

export interface TrendSeries {
  name: string;
  values: number[];
  color: string;
}

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const mag = 10 ** Math.floor(Math.log10(value));
  const norm = value / mag;
  const step = norm <= 2 ? 2 : norm <= 4 ? 4 : norm <= 5 ? 5 : norm <= 8 ? 8 : 10;
  return step * mag;
}

function polylineLength(points: { x: number; y: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1] as { x: number; y: number };
    const b = points[i] as { x: number; y: number };
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total > 0 ? Math.ceil(total) : 1;
}

export function AttemptsTrend({ title, sentence, labels, series, replayKey }: { title: string; sentence?: string; labels: string[]; series: TrendSeries[]; replayKey: string }) {
  const gradientId = useId();
  const entryClass = useChartEntry(series.length, replayKey);
  const peak = Math.max(0, ...series.flatMap((s) => s.values));
  const max = niceMax(peak);
  const ticks = [max, max / 2];
  const scaleX = (i: number) => (labels.length <= 1 ? 0 : (i / (labels.length - 1)) * VIEW_W);
  const scaleY = (v: number) => VIEW_H - (v / max) * VIEW_H * 0.92;
  const pathFor = (values: number[]) => values.map((v, i) => `${i === 0 ? 'M' : 'L'}${scaleX(i).toFixed(2)} ${scaleY(v).toFixed(2)}`).join(' ');
  const areaFor = (values: number[]) =>
    `M0,${VIEW_H} L${values.map((v, i) => `${scaleX(i).toFixed(2)},${scaleY(v).toFixed(2)}`).join(' L')} L${VIEW_W},${VIEW_H} Z`;
  const labelStep = Math.max(1, Math.ceil(labels.length / 6));
  return (
    <Tile title={title} sentence={sentence}>
      <div className={`ds-chart-plot relative min-h-0 flex-1 ${entryClass}`}>
        <span aria-hidden="true" className="ds-chart-backdrop" />
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          {ticks.map((t) => (
            <span key={t} className="ds-chart-rule" style={{ top: `${(scaleY(t) / VIEW_H) * 100}%` }} />
          ))}
        </span>
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-10 w-7">
          {ticks.map((t) => (
            <span
              key={t}
              className="ds-chart-label absolute right-0 -translate-y-1/2 pr-1 text-content-muted tabular-nums"
              style={{ top: `${(scaleY(t) / VIEW_H) * 100}%` }}
            >
              {t.toLocaleString('en-US')}
            </span>
          ))}
        </div>
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible pl-7" role="img" aria-label={title}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.name} id={`${gradientId}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.42" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {series.map((s, i) => (
            <path key={`a-${s.name}`} className="ds-chart-wash" style={enterVars(i, series.length)} d={areaFor(s.values)} fill={`url(#${gradientId}-${i})`} stroke="none" />
          ))}
          {series.map((s, i) => {
            const length = polylineLength(s.values.map((v, k) => ({ x: scaleX(k), y: scaleY(v) })));
            return (
              <path
                key={s.name}
                className="ds-chart-line"
                style={{ '--chart-draw-length': length, ...enterVars(i, series.length) } as CSSProperties}
                d={pathFor(s.values)}
                fill="none"
                stroke={s.color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
      </div>
      <div aria-hidden="true" className="ds-chart-label mt-1 flex shrink-0 items-center justify-between overflow-hidden pl-7 text-content-muted tabular-nums">
        {labels.filter((_, i) => i % labelStep === 0).map((label) => (
          <span key={label} className="truncate">
            {label}
          </span>
        ))}
      </div>
      <ul className="ds-chart-label mt-1 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 overflow-hidden">
        {series.map((s) => (
          <li key={s.name} className="flex min-w-0 items-center gap-1.5 text-content-muted">
            <span aria-hidden="true" className="inline-block h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="truncate">{s.name}</span>
          </li>
        ))}
      </ul>
    </Tile>
  );
}
