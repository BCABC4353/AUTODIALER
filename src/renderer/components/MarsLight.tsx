import type { CSSProperties } from 'react';
import { useReducedMotion } from '@design/ds/utils/reducedMotion.js';
import {
  ColorPaletteBlue400,
  ColorPaletteBrandNavy600,
  ColorPaletteBlue500,
  ColorPaletteSafetyOrange500,
} from '@design/tokens.js';

const ORANGE = ColorPaletteSafetyOrange500;
const BLUE = ColorPaletteBlue500;
const BLUE_LIGHT = ColorPaletteBlue400;
const BLUE_REST = ColorPaletteBrandNavy600;

const CSS = `
.mars-light {
  --mars-period: 2600ms;
  position: relative;
  display: inline-block;
  flex: none;
  width: var(--mars-size);
  height: var(--mars-size);
  vertical-align: middle;
}
.mars-halo {
  position: absolute;
  inset: -40%;
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(closest-side circle at 50% 50%, ${ORANGE} 0%, transparent 70%);
  opacity: 0.22;
  will-change: opacity;
  animation: mars-halo-a var(--mars-period) ease-in-out infinite;
}
.mars-halo-blue {
  background: radial-gradient(closest-side circle at 50% 50%, ${BLUE} 0%, transparent 70%);
  opacity: 0;
  animation-name: mars-halo-b;
}
.mars-lens {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  transform-origin: 50% 58%;
  will-change: transform;
  animation: mars-rock var(--mars-period) ease-in-out infinite;
}
.mars-lens .p-orange {
  fill: ${ORANGE};
  animation: mars-pulse-orange var(--mars-period) ease-in-out infinite;
}
.mars-lens .p-blue {
  fill: var(--mars-blue, ${BLUE_LIGHT});
  animation: mars-pulse-blue var(--mars-period) ease-in-out infinite;
}
@keyframes mars-rock {
  0% { transform: rotate(-14deg); }
  50% { transform: rotate(14deg); }
  100% { transform: rotate(-14deg); }
}
@keyframes mars-pulse-orange {
  0% { fill-opacity: 1; }
  38% { fill-opacity: 0.9; }
  50% { fill-opacity: 0.45; }
  88% { fill-opacity: 0.55; }
  100% { fill-opacity: 1; }
}
@keyframes mars-pulse-blue {
  0% { fill-opacity: 0.45; }
  38% { fill-opacity: 0.55; }
  50% { fill-opacity: 1; }
  88% { fill-opacity: 0.9; }
  100% { fill-opacity: 0.45; }
}
@keyframes mars-halo-a {
  0% { opacity: 0.3; }
  38% { opacity: 0.22; }
  50% { opacity: 0; }
  88% { opacity: 0; }
  100% { opacity: 0.3; }
}
@keyframes mars-halo-b {
  0% { opacity: 0; }
  38% { opacity: 0; }
  50% { opacity: 0.3; }
  88% { opacity: 0.22; }
  100% { opacity: 0; }
}
.mars-light[data-motion='still'] .mars-lens,
.mars-light[data-motion='still'] .mars-lens path,
.mars-light[data-motion='still'] .mars-halo {
  animation: none;
}
.mars-light[data-motion='still'] .mars-lens {
  --mars-blue: ${BLUE_REST};
}
.mars-light[data-motion='still'] .mars-lens path {
  fill-opacity: 1;
}
.mars-light[data-motion='still'] .mars-halo {
  opacity: 0.26;
}
.mars-light[data-motion='still'] .mars-halo-blue {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .mars-light .mars-lens,
  .mars-light .mars-lens path,
  .mars-light .mars-halo {
    animation: none;
  }
  .mars-light .mars-lens {
    --mars-blue: ${BLUE_REST};
  }
  .mars-light .mars-lens path {
    fill-opacity: 1;
  }
  .mars-light .mars-halo {
    opacity: 0.26;
  }
  .mars-light .mars-halo-blue {
    opacity: 0;
  }
}
`;

const ORANGE_PATH = 'M0,7 C10,27 34,58 58,72 L0,72 Z';
const BLUE_PATH = 'M11,0 C21,20 45,51 74,63 L74,0 Z';

export function MarsLight({ size = 28, active = false, className = '' }: { size?: number | string; active?: boolean; className?: string }) {
  const reduced = useReducedMotion();
  const still = reduced || !active;
  const px = typeof size === 'number' ? `${size}px` : size;
  return (
    <span aria-hidden="true" data-motion={still ? 'still' : 'sweep'} className={`mars-light ${className}`} style={{ '--mars-size': px } as CSSProperties}>
      <style>{CSS}</style>
      <span className="mars-halo" />
      <span className="mars-halo mars-halo-blue" />
      <svg className="mars-lens" viewBox="0 0 74 72" role="presentation" focusable="false">
        <path className="p-orange" d={ORANGE_PATH} />
        <path className="p-blue" d={BLUE_PATH} />
      </svg>
    </span>
  );
}
