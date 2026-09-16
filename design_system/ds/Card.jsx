import { forwardRef } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from './utils/cn';

const cardVariants = cva(
  'ds-card bg-surface-base border rounded-lg',
  {
    variants: {
      tone: {
        default: 'border-line',
        warning: 'border-amber-500/30',
        danger: 'border-safety-orange/30',
        success: 'border-emerald-500/30',
      },
      padding: {
        none: 'p-0',
        xs: 'p-fluid-xs',
        sm: 'p-fluid-sm',
        md: 'p-fluid-md',
        lg: 'p-fluid-lg',
      },
    },
    defaultVariants: {
      tone: 'default',
      padding: 'md',
    },
  },
);

export const Card = forwardRef(function Card(
  { tone, padding, className, children, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={cn(cardVariants({ tone, padding }), className)} {...rest}>
      {children}
    </div>
  );
});
