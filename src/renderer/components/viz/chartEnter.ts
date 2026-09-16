import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { prefersReducedMotion } from '@design/ds/utils/reducedMotion.js';

const ENTER_MS = 460;
const STAGGER_MS = 26;
const STAGGER_BUDGET_MS = 320;
const CLEAR_PAD_MS = 90;

export function staggerMs(index: number, count: number): number {
  const per = count > 1 ? Math.min(STAGGER_MS, STAGGER_BUDGET_MS / (count - 1)) : STAGGER_MS;
  return Math.round(Math.max(0, index) * per);
}

export function enterVars(index: number, count: number): CSSProperties {
  return { '--chart-enter-delay': `${staggerMs(index, count)}ms` } as CSSProperties;
}

export function useChartEntry(markCount: number, replayKey: string): string {
  const [playing, setPlaying] = useState(false);
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (last.current === replayKey) return undefined;
    last.current = replayKey;
    if (prefersReducedMotion()) return undefined;
    setPlaying(true);
    const timer = window.setTimeout(() => setPlaying(false), ENTER_MS + staggerMs(markCount, markCount) + CLEAR_PAD_MS);
    return () => window.clearTimeout(timer);
  }, [markCount, replayKey]);
  return playing ? 'ds-chart-enter' : '';
}
