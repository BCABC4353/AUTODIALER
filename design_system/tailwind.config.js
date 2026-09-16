import containerQueries from '@tailwindcss/container-queries';
import plugin from 'tailwindcss/plugin';
import {
  ColorPaletteSafetyOrange500,
  ColorPaletteSafetyOrange100,
  FontSizeFluidMicro,
  FontSizeFluidLabel,
  FontSizeFluidNano,
  FontSizeFluidBody,
  FontSizeFluidSm,
  FontSizeFluidHeading,
  FontSizeFluidSection,
  FontSizeFluidTitle,
  FontSizeFluidSmNarrow,
  FontSizeFluidNanoNarrow,
  FontSizeFluidHero,
  FontSizeFluidHeroReport,
  FontSizeFluidBilled,
  FontSizeFluidBilledReport,
  FontSizeFluidVerdict,
  FontSizeFluidVerdictReport,
  FontSizeDataNano,
  FontSizeDataXs,
  FontSizeDataSm,
  FontSizeDataBase,
  SpacingFluidXs,
  SpacingFluidSm,
  SpacingFluidMd,
  SpacingFluidLg,
  SpacingFluidXl,
  SpacingFluidCtl05,
  SpacingFluidCtl1,
  SpacingFluidCtl15,
  SpacingFluidCtl2,
  SpacingFluidCtl25,
  SpacingFluidCtl3,
  SpacingFluidCtl4,
  MotionDurationInstant,
  MotionDurationShort,
  MotionDurationBase,
  MotionDurationMedium,
  MotionDurationLong,
  MotionDurationPosture,
  BreakpointSm,
  BreakpointMd,
  BreakpointLg,
  BreakpointXl,
  Breakpoint2xl,
  MotionEaseLinear,
  MotionEaseOut,
  MotionEaseIn,
  MotionEaseInOut,
  MotionEaseAppleOut,
} from './tokens.js';

const easeOut = `cubic-bezier(${MotionEaseOut.join(',')})`;

const alphaVar =
  (name) =>
  ({ opacityValue } = {}) => {
    if (opacityValue === undefined) return `var(${name})`;
    if (String(opacityValue).startsWith('var(--tw-')) return `var(${name})`;
    return `color-mix(in srgb, var(${name}) calc(${opacityValue} * 100%), transparent)`;
  };

const alphaAware = (node) => {
  if (typeof node === 'string') {
    return node.startsWith('var(--') && node.endsWith(')')
      ? alphaVar(node.slice(4, -1))
      : node;
  }
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, alphaAware(v)]));
  }
  return node;
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./ds/**/*.{js,jsx}', './window/**/*.{js,jsx}'],
  theme: {
    screens: {
      sm: BreakpointSm,
      md: BreakpointMd,
      lg: BreakpointLg,
      xl: BreakpointXl,
      '2xl': Breakpoint2xl,
    },
    extend: {
      colors: alphaAware({
        safety: {
          orange: ColorPaletteSafetyOrange500,
          'orange-100': ColorPaletteSafetyOrange100,
        },
        surface: {
          base: 'var(--surface-base)',
          raised: 'var(--surface-raised)',
          deep: 'var(--surface-deep)',
          overlay: 'var(--surface-overlay)',
          inset: 'var(--surface-inset)',
        },
        content: {
          DEFAULT: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          subtle: 'var(--text-subtle)',
        },
        line: {
          DEFAULT: 'var(--border-default)',
          strong: 'var(--border-strong)',
        },
        brand: {
          wordmark: 'var(--brand-wordmark)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          strong: 'var(--accent-strong)',
          soft: 'var(--accent-soft)',
          fg: 'var(--accent-fg)',
          text: 'var(--accent-text)',
          disabled: 'var(--accent-disabled)',
          'disabled-fg': 'var(--accent-disabled-fg)',
        },
        status: {
          success: 'var(--status-success-fg)',
          danger: 'var(--status-danger-fg)',
        },
        btn: {
          refresh: {
            bg: 'var(--btn-refresh-bg)',
            bd: 'var(--btn-refresh-bd)',
            hover: 'var(--btn-refresh-bg-hover)',
            fg: 'var(--btn-refresh-fg)',
          },
          reprocess: {
            bg: 'var(--btn-reprocess-bg)',
            bd: 'var(--btn-reprocess-bd)',
            hover: 'var(--btn-reprocess-bg-hover)',
            fg: 'var(--btn-reprocess-fg)',
          },
          advisor: {
            bg: 'var(--btn-advisor-bg)',
            bd: 'var(--btn-advisor-bd)',
            hover: 'var(--btn-advisor-bg-hover)',
            fg: 'var(--btn-advisor-fg)',
          },
        },
        chip: {
          slate: { bg: 'var(--chip-slate-bg)', fg: 'var(--chip-slate-fg)', bd: 'var(--chip-slate-bd)' },
          org: { bg: 'var(--chip-org-bg)', fg: 'var(--chip-org-fg)', bd: 'var(--chip-org-bd)' },
          amber: { bg: 'var(--chip-amber-bg)', fg: 'var(--chip-amber-fg)', bd: 'var(--chip-amber-bd)' },
          red: { bg: 'var(--chip-red-bg)', fg: 'var(--chip-red-fg)', bd: 'var(--chip-red-bd)' },
          emerald: { bg: 'var(--chip-emerald-bg)', fg: 'var(--chip-emerald-fg)', bd: 'var(--chip-emerald-bd)' },
          blue: { bg: 'var(--chip-blue-bg)', fg: 'var(--chip-blue-fg)', bd: 'var(--chip-blue-bd)' },
          violet: { bg: 'var(--chip-violet-bg)', fg: 'var(--chip-violet-fg)', bd: 'var(--chip-violet-bd)' },
          'slate-solid': { bg: 'var(--chip-slate-solid-bg)', fg: 'var(--chip-slate-solid-fg)' },
          'org-solid': { bg: 'var(--chip-org-solid-bg)', fg: 'var(--chip-org-solid-fg)' },
          'amber-solid': { bg: 'var(--chip-amber-solid-bg)', fg: 'var(--chip-amber-solid-fg)' },
          'red-solid': { bg: 'var(--chip-red-solid-bg)', fg: 'var(--chip-red-solid-fg)' },
          'emerald-solid': { bg: 'var(--chip-emerald-solid-bg)', fg: 'var(--chip-emerald-solid-fg)' },
          'blue-solid': { bg: 'var(--chip-blue-solid-bg)', fg: 'var(--chip-blue-solid-fg)' },
          'violet-solid': { bg: 'var(--chip-violet-solid-bg)', fg: 'var(--chip-violet-solid-fg)' },
        },
        row: {
          hover: 'var(--row-hover)',
          active: 'var(--row-active)',
        },
        edge: {
          light: 'var(--edge-light)',
          dark: 'var(--edge-dark)',
          inset: 'var(--edge-inset)',
        },
        tile: {
          'pass-bg': 'var(--tile-pass-bg)',
          'pass-fg': 'var(--tile-pass-fg)',
          'fail-bg': 'var(--tile-fail-bg)',
          'fail-fg': 'var(--tile-fail-fg)',
          'downcoded-bg': 'var(--tile-downcoded-bg)',
          'downcoded-fg': 'var(--tile-downcoded-fg)',
          'unknown-bg': 'var(--tile-unknown-bg)',
          'unknown-fg': 'var(--tile-unknown-fg)',
          edge: 'var(--tile-edge)',
        },
        conflict: {
          DEFAULT: 'var(--conflict-rule)',
          wash: 'var(--conflict-wash)',
        },
        danger: {
          DEFAULT: 'var(--danger-text)',
        },
        focus: {
          ring: 'var(--focus-ring)',
          danger: 'var(--focus-ring-danger)',
        },
        well: 'var(--well-surface)',
        narrative: {
          'active-bg': 'var(--narrative-active-bg)',
          'active-fg': 'var(--narrative-active-fg)',
          'hover-bg': 'var(--narrative-hover-bg)',
          'hover-fg': 'var(--narrative-hover-fg)',
        },
        glass: {
          surface: 'var(--glass-surface)',
          header: 'var(--glass-header)',
          chrome: 'var(--glass-chrome)',
          veil: 'var(--glass-veil)',
          edge: 'var(--glass-edge)',
          sheen: 'var(--glass-sheen)',
          tile: 'var(--glass-tile-surface)',
        },
      }),
      boxShadow: {
        tile: 'var(--tile-depth)',
        bar: 'var(--bar-depth)',
        contact: 'var(--shadow-contact)',
        ambient: 'var(--shadow-ambient)',
        glass: 'var(--glass-shadow)',
        'glass-rail': 'var(--glass-rail-shadow)',
        'glass-tile': 'var(--glass-tile-depth)',
      },
      backdropBlur: {
        glass: 'var(--glass-blur)',
        'glass-sm': 'var(--glass-blur-sm)',
        'glass-lg': 'var(--glass-blur-lg)',
      },
      fontFamily: {
        sans: [
          '"Inter Variable"',
          '"Inter"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono Variable"',
          '"JetBrains Mono"',
          '"Fira Code"',
          'Consolas',
          'monospace',
        ],
      },
      fontSize: {
        'fluid-micro': FontSizeFluidMicro,
        'fluid-label': FontSizeFluidLabel,
        'fluid-nano': FontSizeFluidNano,
        'fluid-body': FontSizeFluidBody,
        'fluid-sm': FontSizeFluidSm,
        'fluid-heading': FontSizeFluidHeading,
        'fluid-section': FontSizeFluidSection,
        'fluid-title': FontSizeFluidTitle,
        'fluid-sm-narrow': FontSizeFluidSmNarrow,
        'fluid-nano-narrow': FontSizeFluidNanoNarrow,
        'fluid-hero': FontSizeFluidHero,
        'fluid-hero-report': FontSizeFluidHeroReport,
        'fluid-billed': FontSizeFluidBilled,
        'fluid-billed-report': FontSizeFluidBilledReport,
        'fluid-verdict': FontSizeFluidVerdict,
        'fluid-verdict-report': FontSizeFluidVerdictReport,
        'data-nano': FontSizeDataNano,
        'data-xs': FontSizeDataXs,
        'data-sm': FontSizeDataSm,
        'data-base': FontSizeDataBase,
        'r1-2xs': ['var(--r1-text-2xs)', { lineHeight: '1.4' }],
        'r1-xs': ['var(--r1-text-xs)', { lineHeight: '1.45' }],
        'r1-sm': ['var(--r1-text-sm)', { lineHeight: '1.5' }],
        'r1-base': ['var(--r1-text-base)', { lineHeight: '1.55' }],
        'r1-lg': ['var(--r1-text-lg)', { lineHeight: '1.3' }],
        'r1-xl': ['var(--r1-text-xl)', { lineHeight: '1.2' }],
      },
      spacing: {
        'fluid-xs': SpacingFluidXs,
        'fluid-sm': SpacingFluidSm,
        'fluid-md': SpacingFluidMd,
        'fluid-lg': SpacingFluidLg,
        'fluid-xl': SpacingFluidXl,
        'fluid-ctl-05': SpacingFluidCtl05,
        'fluid-ctl-1': SpacingFluidCtl1,
        'fluid-ctl-15': SpacingFluidCtl15,
        'fluid-ctl-2': SpacingFluidCtl2,
        'fluid-ctl-25': SpacingFluidCtl25,
        'fluid-ctl-3': SpacingFluidCtl3,
        'fluid-ctl-4': SpacingFluidCtl4,
      },
      backgroundImage: {
        'skeleton-shimmer':
          'linear-gradient(90deg, var(--skeleton-base) 0%, var(--skeleton-highlight) 50%, var(--skeleton-base) 100%)',
      },
      keyframes: {
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-out-right': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-out-left': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'panel-in-inline': {
          '0%': { transform: 'translateX(var(--panel-travel, 1.5rem))', opacity: '0' },
          '100%': { transform: 'none', opacity: '1' },
        },
        'panel-out-inline': {
          '0%': { transform: 'none', opacity: '1' },
          '100%': { transform: 'translateX(var(--panel-travel, 1.5rem))', opacity: '0' },
        },
        'slide-in-top': {
          '0%': { transform: 'translateY(calc(-1 * var(--panel-travel, 1.5rem)))', opacity: '0' },
          '100%': { transform: 'none', opacity: '1' },
        },
        'slide-out-top': {
          '0%': { transform: 'none', opacity: '1' },
          '100%': { transform: 'translateY(calc(-1 * var(--panel-travel, 1.5rem)))', opacity: '0' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'accordion-down': {
          '0%': { gridTemplateRows: '0fr', opacity: '0' },
          '100%': { gridTemplateRows: '1fr', opacity: '1' },
        },
        'accordion-up': {
          '0%': { gridTemplateRows: '1fr', opacity: '1' },
          '100%': { gridTemplateRows: '0fr', opacity: '0' },
        },
        'popover-in': {
          '0%': { opacity: '0', transform: 'translateY(-4px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'popover-out': {
          '0%': { opacity: '1', transform: 'translateY(0) scale(1)' },
          '100%': { opacity: '0', transform: 'translateY(-4px) scale(0.96)' },
        },
        'dropdown-in': {
          '0%': { opacity: '0', transform: 'translateY(-12px) scaleY(0.92)' },
          '100%': { opacity: '1', transform: 'translateY(0) scaleY(1)' },
        },
        'dropdown-out': {
          '0%': { opacity: '1', transform: 'translateY(0) scaleY(1)' },
          '100%': { opacity: '0', transform: 'translateY(-12px) scaleY(0.92)' },
        },
        'skeleton-shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'skeleton-shimmer': 'skeleton-shimmer 1.5s linear infinite',
        'slide-in-right': `slide-in-right ${MotionDurationMedium} ${easeOut}`,
        'slide-out-right': `slide-out-right ${MotionDurationMedium} ${easeOut} forwards`,
        'slide-in-left': `slide-in-left ${MotionDurationMedium} ${easeOut}`,
        'slide-out-left': `slide-out-left ${MotionDurationMedium} ${easeOut} forwards`,
        'slide-up': `slide-up ${MotionDurationMedium} ${easeOut}`,
        'slide-down': `slide-down ${MotionDurationMedium} ${easeOut} forwards`,
        'panel-in-inline': `panel-in-inline ${MotionDurationMedium} ${easeOut}`,
        'panel-out-inline': `panel-out-inline ${MotionDurationMedium} ${easeOut} forwards`,
        'slide-in-top': `slide-in-top ${MotionDurationMedium} ${easeOut}`,
        'slide-out-top': `slide-out-top ${MotionDurationMedium} ${easeOut} forwards`,
        'fade-in': `fade-in ${MotionDurationBase} ${easeOut} forwards`,
        'fade-out': `fade-out ${MotionDurationMedium} ${easeOut} forwards`,
        'accordion-down': `accordion-down ${MotionDurationBase} ${easeOut}`,
        'accordion-up': `accordion-up ${MotionDurationBase} ${easeOut}`,
        'popover-in': `popover-in ${MotionDurationBase} ${easeOut} forwards`,
        'popover-out': `popover-out ${MotionDurationBase} ${easeOut} forwards`,
        'dropdown-in': `dropdown-in ${MotionDurationBase} ${easeOut} forwards`,
        'dropdown-out': `dropdown-out ${MotionDurationShort} ${easeOut} forwards`,
      },
      transitionDuration: {
        'motion-instant': MotionDurationInstant,
        'motion-short': MotionDurationShort,
        'motion-base': MotionDurationBase,
        'motion-medium': MotionDurationMedium,
        'motion-long': MotionDurationLong,
        'motion-posture': MotionDurationPosture,
      },
      transitionTimingFunction: {
        'motion-linear': `cubic-bezier(${MotionEaseLinear.join(',')})`,
        'motion-ease-out': easeOut,
        'motion-ease-in': `cubic-bezier(${MotionEaseIn.join(',')})`,
        'motion-ease-in-out': `cubic-bezier(${MotionEaseInOut.join(',')})`,
        'motion-ease-apple-out': `cubic-bezier(${MotionEaseAppleOut.join(',')})`,
      },
    },
  },
  plugins: [
    containerQueries,
    plugin(({ addVariant }) => {
      addVariant('coarse', [
        '@media (any-pointer: coarse) and (max-width: 559px)',
        '@media (any-pointer: coarse) and (min-width: 560px) and (max-height: 559px)',
      ]);
      addVariant('fine-hover', '@media (hover: hover) and (pointer: fine)');
      addVariant('posture-tall', ':root[data-posture="tall"] &');
      addVariant('posture-even', ':root[data-posture="even"] &');
      addVariant('posture-wide', ':root[data-posture="wide"] &');
      addVariant('posture-desk', ':root[data-desk] &');
      addVariant('posture-desk-full', ':root[data-desk="full"] &');
      addVariant('posture-desk-compact', ':root[data-desk="compact"] &');
      addVariant('hand', '@media (max-width: 559px)');
      addVariant('posture-shifting', ':root[data-posture-shifting] &');
      addVariant('crease-block', ':root[data-crease="block"] &');
      addVariant('crease-inline', ':root[data-crease="inline"] &');
      addVariant('fold-half', ':root[data-fold-half="1"] &');
      addVariant('short', '@media (max-height: 47.9375rem)');
    }),
  ],
};
