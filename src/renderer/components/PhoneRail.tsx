import { useEffect, useRef, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, RefreshCw } from 'lucide-react';
import { Button, GlassPanel, PanelTitle } from '@ds/index.js';
import { CCP_PARTITION, CCP_URL } from '@shared/ccp';

const WIDTH = 412;

export function PhoneRail() {
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

  return (
    <aside
      aria-label="Phone"
      className="ds-ambient flex shrink-0 flex-col border-l border-glass-edge py-fluid-md pr-fluid-md transition-[width] duration-motion-medium ease-motion-ease-out"
      style={{ width: open ? WIDTH : 44 }}
    >
      {open ? (
        <GlassPanel padding="none" gap="none" className="min-h-0 flex-1 overflow-hidden">
          <header className="relative flex items-center justify-center px-3 py-2">
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
      ) : (
        <Button variant="ghost" size="sm" aria-label="Show phone" onClick={() => setOpen(true)} className="self-start">
          <PanelLeftClose size={14} />
        </Button>
      )}
    </aside>
  );
}
