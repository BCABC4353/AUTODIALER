import { cva } from 'class-variance-authority';
import { cn } from './utils/cn';
import { scChildren } from './utils/scText.jsx';

const loadingStateVariants = cva(
  'flex items-center justify-center',
  {
    variants: {
      size: {
        sm: 'text-fluid-label uppercase tracking-wider py-1 posture-tall:text-[max(0.6875rem,0.575rem_+_0.2cqi)] posture-wide:text-[max(0.6875rem,0.575rem_+_0.2cqi)]',
        md: 'flex-1 text-fluid-body',
      },
      tone: {
        muted: 'text-content-muted',
        subtle: 'text-content-subtle uppercase tracking-wider',
      },
    },
    defaultVariants: {
      size: 'md',
      tone: 'muted',
    },
  },
);

export function LoadingState({ size, tone, className, children, ...rest }) {
  const prose = (size ?? 'md') === 'md' && (tone ?? 'muted') !== 'subtle';
  const content = children ?? 'Loading…';
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        loadingStateVariants({ size, tone }),
        prose && 'ds-smallcaps normal-case',
        className,
      )}
      {...rest}
    >
      {prose ? scChildren(content, 'loading') : content}
    </div>
  );
}
