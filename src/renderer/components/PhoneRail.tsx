import { useEffect, useRef, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, RefreshCw } from 'lucide-react';
import { Button, GlassPanel, PanelTitle } from '@ds/index.js';
import { CCP_PARTITION, CCP_URL } from '@shared/ccp';

const PAD_W = 390;
const PAD_H = 600;
const PANEL_HEADER = 36;
const WIDTH = PAD_W + 22;

export function PhoneRail({ visible }: { visible: boolean }) {
  const [open, setOpen] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLElement & { reload?: () => void }>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const done = () => setLoaded(true);
    el.addEventListener('did-finish-load', done);
    return () => el.removeEventListener('did-finish-load', done);
  }, []);

  const shown = visible && open;
  return (
    <aside
      aria-label="Phone"
      aria-hidden={!visible}
      className={`ds-ambient relative flex shrink-0 flex-col items-center justify-center overflow-hidden border-l border-glass-edge transition-[width] duration-motion-medium ease-motion-ease-out ${visible ? 'py-4 pr-4' : ''}`}
      style={{ width: !visible ? 0 : shown ? WIDTH : 44, borderLeftWidth: visible ? 1 : 0 }}
    >
      {visible && !open && (
        <Button variant="ghost" size="sm" aria-label="Show phone" onClick={() => setOpen(true)} className="absolute top-fluid-md">
          <PanelLeftClose size={14} />
        </Button>
      )}
      <GlassPanel
        padding="none"
        gap="none"
        className={`max-h-full w-full shrink-0 overflow-hidden ${shown ? '' : 'pointer-events-none absolute -left-[9999px] top-0 opacity-0'}`}
        style={{ height: PAD_H + PANEL_HEADER, width: PAD_W + 2 }}
      >
        <header className="relative flex shrink-0 items-center justify-center px-3" style={{ height: PANEL_HEADER }}>
          <PanelTitle>Phone</PanelTitle>
          <div className="absolute inset-y-0 right-2 flex items-center gap-1">
            <Button variant="ghost" size="sm" aria-label="Reload phone" onClick={() => ref.current?.reload?.()}>
              <RefreshCw size={13} />
            </Button>
            <Button variant="ghost" size="sm" aria-label="Hide phone" onClick={() => setOpen(false)}>
              <PanelLeftOpen size={14} />
            </Button>
          </div>
        </header>
        <div className="relative min-h-0 flex-1 bg-surface-base">
          {!loaded && (
            <div className="ds-smallcaps absolute inset-0 flex items-center justify-center text-fluid-label text-content-muted normal-case">
              Loading the phone…
            </div>
          )}
          <webview
            ref={ref as never}
            src={CCP_URL}
            partition={CCP_PARTITION}
            allowpopups="true"
            className="absolute inset-0"
            style={{ display: 'flex', width: '100%', height: '100%' }}
          />
        </div>
      </GlassPanel>
    </aside>
  );
}
