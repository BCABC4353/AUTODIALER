import { cva } from 'class-variance-authority';
import { cn } from './utils/cn';

const pillVariants = cva(
  'ds-pill ds-touch-halo inline-block rounded font-black uppercase tracking-wider',
  {
    variants: {
      tone: {
        slate: '',
        orange: '',
        amber: '',
        red: '',
        emerald: '',
        blue: '',
        violet: '',
        custom: '',
      },
      size: {
        sm: 'px-fluid-ctl-2 py-fluid-ctl-05 text-fluid-nano posture-tall:text-[0.6875rem] posture-wide:text-[0.6875rem]',
        md: 'px-fluid-ctl-25 py-fluid-ctl-1 text-fluid-label posture-tall:text-[max(0.6875rem,0.575rem_+_0.2cqi)] posture-wide:text-[max(0.6875rem,0.575rem_+_0.2cqi)]',
      },
      intensity: {
        subtle: '',
        solid: '',
      },
      border: {
        false: '',
        true: 'border',
      },
    },
    compoundVariants: [
      { tone: 'slate',   intensity: 'subtle', class: 'bg-chip-slate-bg text-chip-slate-fg' },
      { tone: 'orange',  intensity: 'subtle', class: 'bg-chip-org-bg text-chip-org-fg' },
      { tone: 'amber',   intensity: 'subtle', class: 'bg-chip-amber-bg text-chip-amber-fg' },
      { tone: 'red',     intensity: 'subtle', class: 'bg-chip-red-bg text-chip-red-fg' },
      { tone: 'emerald', intensity: 'subtle', class: 'bg-chip-emerald-bg text-chip-emerald-fg' },
      { tone: 'blue',    intensity: 'subtle', class: 'bg-chip-blue-bg text-chip-blue-fg' },
      { tone: 'violet',  intensity: 'subtle', class: 'bg-chip-violet-bg text-chip-violet-fg' },

      { tone: 'slate',   intensity: 'solid', class: 'bg-chip-slate-solid-bg text-chip-slate-solid-fg' },
      { tone: 'orange',  intensity: 'solid', class: 'bg-chip-org-solid-bg text-chip-org-solid-fg' },
      { tone: 'amber',   intensity: 'solid', class: 'bg-chip-amber-solid-bg text-chip-amber-solid-fg' },
      { tone: 'red',     intensity: 'solid', class: 'bg-chip-red-solid-bg text-chip-red-solid-fg' },
      { tone: 'emerald', intensity: 'solid', class: 'bg-chip-emerald-solid-bg text-chip-emerald-solid-fg' },
      { tone: 'blue',    intensity: 'solid', class: 'bg-chip-blue-solid-bg text-chip-blue-solid-fg' },
      { tone: 'violet',  intensity: 'solid', class: 'bg-chip-violet-solid-bg text-chip-violet-solid-fg' },

      { tone: 'slate',   border: true, class: 'border-chip-slate-bd' },
      { tone: 'orange',  border: true, class: 'border-chip-org-bd' },
      { tone: 'amber',   border: true, class: 'border-chip-amber-bd' },
      { tone: 'red',     border: true, class: 'border-chip-red-bd' },
      { tone: 'emerald', border: true, class: 'border-chip-emerald-bd' },
      { tone: 'blue',    border: true, class: 'border-chip-blue-bd' },
      { tone: 'violet',  border: true, class: 'border-chip-violet-bd' },
    ],
    defaultVariants: {
      tone: 'slate',
      size: 'sm',
      intensity: 'subtle',
      border: false,
    },
  },
);

export function Pill({ tone, size, intensity, border, bg, fg, className, children, style, ...rest }) {
  const hasCustomColor = bg != null || fg != null;
  const resolvedTone = hasCustomColor ? 'custom' : tone;
  const resolvedStyle = hasCustomColor
    ? { backgroundColor: bg, color: fg, ...style }
    : style;
  return (
    <span
      data-tone={resolvedTone ?? 'slate'}
      className={cn(pillVariants({ tone: resolvedTone, size, intensity, border }), className)}
      style={resolvedStyle}
      {...rest}
    >
      {children}
    </span>
  );
}
