import type { ReactNode } from 'react';
import { Card } from '@ds/index.js';

export function Tile({ title, sentence, children }: { title: string; sentence?: string; children: ReactNode }) {
  return (
    <Card padding="sm" className="@container flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-hidden">
      <header className="flex min-w-0 shrink-0 flex-col gap-0.5">
        <h3 className="truncate text-fluid-body font-black uppercase tracking-wider text-content">{title}</h3>
        {sentence && <p className="ds-smallcaps truncate text-fluid-label text-content-muted normal-case">{sentence}</p>}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </Card>
  );
}
