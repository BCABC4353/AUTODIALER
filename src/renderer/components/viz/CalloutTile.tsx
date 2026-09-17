import { Tile } from './Tile';

export function CalloutTile({
  title,
  sentence,
  value,
  label,
  lines,
}: {
  title: string;
  sentence?: string;
  value: string;
  label: string;
  lines: string[];
}) {
  return (
    <Tile title={title} sentence={sentence}>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-fluid-sm overflow-hidden">
        <div className="flex min-w-0 flex-col gap-1">
          {value === '—' ? (
            <span className="ds-smallcaps text-fluid-body font-bold text-content-subtle normal-case">nothing yet</span>
          ) : (
            <span
              className="font-black leading-none tracking-tight text-content tabular-nums"
              style={{ fontSize: 'clamp(2rem, min(14cqi, 22cqh), 5rem)' }}
            >
              {value}
            </span>
          )}
          <span className="ds-smallcaps text-fluid-label font-bold uppercase tracking-wider text-content-secondary">{label}</span>
        </div>
        <ul className="ds-smallcaps flex min-h-0 flex-col gap-0.5 overflow-hidden">
          {lines.map((line, i) => (
            <li key={i} className="ds-chart-label leading-snug text-content-muted">
              {line}
            </li>
          ))}
        </ul>
      </div>
    </Tile>
  );
}
