import type { ReactNode } from 'react';

export function ActionBar({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="z-30 flex h-[var(--chrome-filterbar-floor)] shrink-0 items-center justify-between gap-fluid-sm border-b border-glass-edge bg-glass-chrome px-fluid-md">
      <div className="flex min-w-0 items-center gap-fluid-sm">{left}</div>
      <div className="flex shrink-0 items-center gap-fluid-sm">{right}</div>
    </div>
  );
}
