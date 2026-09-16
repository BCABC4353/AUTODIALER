import { forwardRef } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from './utils/cn';

const CHROME_CTL = [
  'ds-chrome-ctl border bg-surface-raised text-content-muted border-line',
  'hover:border-line-strong',
  'font-black uppercase active:scale-[0.98]',
].join(' ');

const buttonVariants = cva(
  [
    'ds-button inline-flex items-center justify-center gap-2 rounded tracking-wider',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'aria-disabled:opacity-50 aria-disabled:cursor-not-allowed',
    'whitespace-nowrap',
    'ds-touch-halo',
    '[&_svg]:size-[1em]',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: [
          'bg-accent hover:bg-accent-strong text-accent-fg shadow-sm font-bold',
          'disabled:bg-accent-disabled disabled:text-accent-disabled-fg disabled:shadow-none',
          'aria-disabled:bg-accent-disabled aria-disabled:text-accent-disabled-fg aria-disabled:shadow-none',
          'disabled:opacity-100 aria-disabled:opacity-100',
        ].join(' '),
        secondary:
          'bg-surface-raised hover:bg-surface-overlay text-content-secondary border border-line font-bold',
        ghost: 'bg-transparent text-content-muted hover:text-content hover:bg-surface-overlay font-bold',
        toggle:
          'text-content-muted font-black uppercase active:shadow-[inset_0_1px_2px_var(--edge-inset)]',
        chip: 'ds-chip font-black uppercase rounded-md',
        'gradient-blue': 'ds-button-gradient ds-button-gradient-blue font-bold',
        'gradient-amber': 'ds-button-gradient ds-button-gradient-amber font-bold',
        'gradient-emerald': 'ds-button-gradient ds-button-gradient-emerald font-bold',
        'gradient-violet': 'ds-button-gradient ds-button-gradient-violet font-bold',
        'chrome-ctl': CHROME_CTL,
        refresh: `${CHROME_CTL} active:bg-btn-refresh-bg active:text-btn-refresh-fg active:border-btn-refresh-bd`,
        reprocess: `${CHROME_CTL} aria-pressed:bg-btn-reprocess-bg aria-pressed:text-btn-reprocess-fg aria-pressed:border-btn-reprocess-bd`,
        advisor: `${CHROME_CTL} aria-pressed:bg-btn-advisor-bg aria-pressed:text-btn-advisor-fg aria-pressed:border-btn-advisor-bd`,
      },
      size: {
        sm: 'px-fluid-ctl-2 py-fluid-ctl-1 text-fluid-nano',
        md: 'px-fluid-ctl-3 py-fluid-ctl-15 text-fluid-label',
        lg: 'px-fluid-ctl-4 py-fluid-ctl-2 text-fluid-sm rounded-lg',
        cta: 'px-fluid-md py-2.5 text-fluid-body rounded-lg',
        chrome: 'px-fluid-ctl-3 py-0 text-fluid-nano rounded h-[var(--filter-ctl-h)]',
        chip: 'px-[var(--chip-pad-inline)] py-[var(--chip-pad-block)] text-[length:var(--chip-font-size)] leading-[var(--chip-line-height)]',
      },
      pressed: {
        true: 'shadow-lg bg-white text-black',
        false: '',
      },
    },
    compoundVariants: [
      {
        variant: 'toggle',
        pressed: false,
        class:
          'hover:text-content hover:bg-surface-overlay hover:shadow-[shadow:inset_0_1px_0_var(--edge-light),var(--shadow-contact)]',
      },
      {
        variant: 'toggle',
        pressed: true,
        class:
          'hover:brightness-110 hover:shadow-[shadow:inset_0_1px_0_var(--edge-light),var(--shadow-ambient)]',
      },
    ],
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
      pressed: false,
    },
  },
);

export const Button = forwardRef(function Button(
  { variant, size, pressed, as: Tag = 'button', className, children, type, style, ...rest },
  ref,
) {
  const isChip = variant === 'chip';
  const isToggle = variant === 'toggle' || isChip;
  const ariaPressed = isToggle ? Boolean(pressed) : undefined;
  const typeProp = Tag === 'button' ? (type ?? 'button') : undefined;
  return (
    <Tag
      ref={ref}
      type={typeProp}
      aria-pressed={ariaPressed}
      style={style}
      className={cn(
        buttonVariants({ variant, size, pressed: isChip ? false : (isToggle ? pressed : false) }),
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
});
