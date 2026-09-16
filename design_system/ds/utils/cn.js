import { clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const isArbitraryClampFontSize = (value) => /^\[clamp\(.+\)\]$/.test(value);

const customTwMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'fluid-micro',
            'fluid-label',
            'fluid-nano',
            'fluid-nano-narrow',
            'fluid-body',
            'fluid-sm',
            'fluid-sm-narrow',
            'fluid-heading',
            'fluid-section',
            'fluid-title',
            'fluid-hero',
            'fluid-hero-report',
            'fluid-billed',
            'fluid-billed-report',
            'fluid-verdict',
            'fluid-verdict-report',
            'data-nano',
            'data-xs',
            'data-sm',
            'data-base',
            isArbitraryClampFontSize,
          ],
        },
      ],
    },
  },
});

export const cn = (...args) => customTwMerge(clsx(args));
