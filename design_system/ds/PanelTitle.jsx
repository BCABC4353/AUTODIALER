import { SectionHeader } from './SectionHeader.jsx';
import { cn } from './utils/cn';

const PANEL_TITLE_CLASS = 'ds-smallcaps normal-case text-content-muted';

export function PanelTitle({ className, children, ...rest }) {
  return (
    <SectionHeader size="eyebrow-lg" className={cn(PANEL_TITLE_CLASS, className)} {...rest}>
      {children}
    </SectionHeader>
  );
}
