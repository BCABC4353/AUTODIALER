import { cva } from 'class-variance-authority';
import { cn } from './utils/cn';

const sectionHeaderVariants = cva(
  'font-black uppercase',
  {
    variants: {
      size: {
        sm: 'text-fluid-micro posture-tall:text-[0.6875rem] posture-wide:text-[0.6875rem]',
        md: 'text-fluid-nano posture-tall:text-[0.6875rem] posture-wide:text-[0.6875rem]',
        eyebrow: 'text-fluid-nano whitespace-nowrap',
        'eyebrow-lg': 'text-fluid-sm whitespace-nowrap',
      },
      tone: {
        muted: 'text-content-muted',
        bright: 'text-content-secondary',
        strong: 'text-content',
      },
      tracking: {
        wider: 'tracking-wider',
        widest: 'tracking-widest',
      },
    },
    defaultVariants: {
      size: 'md',
      tone: 'muted',
      tracking: 'wider',
    },
  },
);

export function SectionHeader({ as: Tag = 'h3', size, tone, tracking, number, right, className, children, ...rest }) {
  const content =
    number == null ? (
      children
    ) : (
      <>
        <span className="text-content-subtle">{number}</span>
        {' — '}
        {children}
      </>
    );
  if (right) {
    return (
      <div className="flex items-center gap-2 mb-3" {...rest}>
        <Tag className={cn(sectionHeaderVariants({ size, tone, tracking }), className)}>
          {content}
        </Tag>
        <div className="flex items-center gap-1">{right}</div>
      </div>
    );
  }
  return (
    <Tag className={cn(sectionHeaderVariants({ size, tone, tracking }), className)} {...rest}>
      {content}
    </Tag>
  );
}
