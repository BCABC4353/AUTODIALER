import { cva } from 'class-variance-authority';
import { cn } from './utils/cn';
import { scChildren } from './utils/scText.jsx';

const emptyStateVariants = cva(
  'flex items-center justify-center text-center',
  {
    variants: {
      tone: {
        neutral: 'text-content-muted',
        secondary: 'text-content-secondary',
        success: 'text-status-success',
      },
      size: {
        sm: 'text-fluid-body flex-row gap-fluid-sm px-fluid-md py-fluid-sm',
        md: 'text-fluid-body flex-1 flex-col gap-fluid-sm py-fluid-xl',
      },
      variant: {
        emphasized: '',
        plain: '',
      },
    },
    defaultVariants: {
      tone: 'neutral',
      size: 'md',
      variant: 'emphasized',
    },
  },
);

const CHROME_FLOOR_LABEL =
  'posture-tall:text-[max(0.6875rem,0.575rem_+_0.2cqi)] posture-wide:text-[max(0.6875rem,0.575rem_+_0.2cqi)]';

const titleClasses = {
  emphasized: `text-fluid-label font-bold uppercase tracking-wider ${CHROME_FLOOR_LABEL}`,
  plain: 'ds-smallcaps text-fluid-body normal-case',
};

export function EmptyState({
  tone,
  size,
  variant = 'emphasized',
  icon,
  title,
  description,
  className,
  children,
  ...rest
}) {
  return (
    <div
      role="status"
      className={cn(emptyStateVariants({ tone, size, variant }), className)}
      {...rest}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <div className="flex flex-col items-center gap-fluid-xs">
        <span className={titleClasses[variant]}>
          {variant === 'plain' ? scChildren(title, 'empty-title') : title}
        </span>
        {description && (
          <span
            className={`ds-smallcaps text-fluid-label normal-case ${CHROME_FLOOR_LABEL}`}
          >
            {scChildren(description, 'empty-desc')}
          </span>
        )}
        {children && <div className="mt-fluid-xs">{children}</div>}
      </div>
    </div>
  );
}
