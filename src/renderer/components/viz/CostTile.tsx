import type { CostSummary } from '@shared/types';
import { RATES, formatCost } from '@shared/pricing';
import { Tile } from './Tile';

function minutes(value: number): string {
  return value.toFixed(1);
}

export function CostTile({ cost }: { cost: CostSummary | null }) {
  const c = cost ?? { today: 0, allTime: 0, attempts: 0, perAttempt: 0, perHuman: null, campaignMinutes: 0, answeredMinutes: 0, estimatedAttempts: 0 };
  const rateLine = `${formatCost(RATES.campaignPerMinute)}/min dialing + ${formatCost(RATES.voicePerMinute + RATES.telephonyPerMinute)}/min answered`;
  return (
    <Tile title="Cost" sentence="Amazon Connect spend, prorated per second.">
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-fluid-sm overflow-hidden">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="font-black leading-none tracking-tight text-content tabular-nums" style={{ fontSize: 'clamp(1.75rem, min(11cqi, 20cqh), 4rem)' }}>
            {formatCost(c.today)}
          </span>
          <span className="ds-smallcaps text-fluid-label font-bold uppercase tracking-wider text-content-secondary">today</span>
        </div>
        <ul className="ds-smallcaps flex min-h-0 flex-col gap-0.5 overflow-hidden">
          <li className="ds-chart-label leading-snug text-content-muted tabular-nums">
            {formatCost(c.perAttempt)} per call · {c.perHuman === null ? 'no human yet' : `${formatCost(c.perHuman)} per human reached`}
          </li>
          <li className="ds-chart-label leading-snug text-content-muted tabular-nums">
            {minutes(c.campaignMinutes)} min dialing · {minutes(c.answeredMinutes)} min answered · {formatCost(c.allTime)} all time
          </li>
          <li className="ds-chart-label leading-snug text-content-muted tabular-nums">
            {rateLine}
            {c.estimatedAttempts > 0 ? ` · ${c.estimatedAttempts} estimated` : ''}
          </li>
        </ul>
      </div>
    </Tile>
  );
}
