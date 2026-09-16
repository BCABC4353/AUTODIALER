import { cn } from './utils/cn';
import { scChildren } from './utils/scText.jsx';

export function ErrorState({
  title = 'Something went wrong.',
  description,
  className,
  children,
  ...rest
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex-1 flex flex-col items-center justify-center gap-fluid-sm text-status-danger text-fluid-body',
        className,
      )}
      {...rest}
    >
      <div className="text-fluid-label font-bold uppercase tracking-wider posture-tall:text-[max(0.6875rem,0.575rem_+_0.2cqi)] posture-wide:text-[max(0.6875rem,0.575rem_+_0.2cqi)]">
        {title}
      </div>
      {description && (
        <div className="ds-smallcaps text-fluid-label text-content-muted normal-case">
          {scChildren(description, 'error-desc')}
        </div>
      )}
      {children && <div className="mt-fluid-sm">{children}</div>}
    </div>
  );
}
