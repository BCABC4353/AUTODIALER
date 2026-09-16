import { cva } from 'class-variance-authority';
import { cn } from './utils/cn';

const sectionVariants = cva('flex flex-col', {
  variants: {
    gap: {
      none: '',
      sm: 'gap-fluid-xs',
      md: 'gap-fluid-sm',
      lg: 'gap-fluid-md',
    },
  },
  defaultVariants: {
    gap: 'md',
  },
});

export function Section({ gap, heading, className, children, ...rest }) {
  return (
    <section className={cn(sectionVariants({ gap }), className)} {...rest}>
      {heading}
      {children}
    </section>
  );
}
