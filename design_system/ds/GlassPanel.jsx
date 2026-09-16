import { forwardRef } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from './utils/cn';

const glassPanelVariants = cva(
  [
    'ds-glass ds-glass-pane ds-glass-refract shadow-glass-rail',
    'rounded-lg border border-glass-edge flex flex-col',
  ].join(' '),
  {
    variants: {
      padding: {
        none: 'p-0',
        xs: 'px-4 pt-2 pb-3',
        sm: 'px-4 py-3',
        md: 'p-3',
        lg: 'p-4',
      },
      gap: {
        none: 'gap-0',
        xs: 'gap-1',
        sm: 'gap-2',
      },
    },
    defaultVariants: {
      padding: 'lg',
      gap: 'sm',
    },
  },
);

export const GlassPanel = forwardRef(function GlassPanel(
  { padding, gap, as: Tag = 'div', className, children, ...rest },
  ref,
) {
  return (
    <Tag ref={ref} className={cn(glassPanelVariants({ padding, gap }), className)} {...rest}>
      {children}
    </Tag>
  );
});
