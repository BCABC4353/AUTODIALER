import { useEffect } from 'react';

const NEUTRAL = 'rgb(128,128,128)';
const BEND = 'rgb(255,128,128)';

function lensMap(edge) {
  return encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" preserveAspectRatio="none">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0">' +
      `<stop offset="0" stop-color="${BEND}"/>` +
      `<stop offset="${edge}" stop-color="${NEUTRAL}"/>` +
      `<stop offset="1" stop-color="${NEUTRAL}"/>` +
      '</linearGradient></defs>' +
      '<rect width="100%" height="100%" fill="url(#g)"/></svg>',
  );
}

const LENS_HREF = `data:image/svg+xml;charset=utf-8,${lensMap(0.12)}`;

function magnifyMap() {
  return encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="60" preserveAspectRatio="none">' +
      '<defs><linearGradient id="m" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="rgb(128,128,128)"/>' +
      '<stop offset="0.18" stop-color="rgb(128,184,128)"/>' +
      '<stop offset="0.5" stop-color="rgb(128,128,128)"/>' +
      '<stop offset="0.82" stop-color="rgb(128,72,128)"/>' +
      '<stop offset="1" stop-color="rgb(128,128,128)"/>' +
      '</linearGradient></defs>' +
      '<rect width="100%" height="100%" fill="url(#m)"/></svg>',
  );
}

const MAGNIFY_HREF = `data:image/svg+xml;charset=utf-8,${magnifyMap()}`;

export const GLASS_LENS_FILTER_ID = 'ds-glass-lens';
export const MARK_LENS_FILTER_ID = 'ds-mark-lens';
export const ROLL_LENS_FILTER_ID = 'ds-roll-lens';
export const GLOW_CAUSTIC_FILTER_ID = 'ds-glow-caustic';

function backdropFiltersSvgFilters() {
  if (typeof navigator === 'undefined') return false;
  const brands = navigator.userAgentData?.brands;
  if (Array.isArray(brands)) {
    return brands.some((b) => b.brand === 'Chromium');
  }
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod|CriOS\/|EdgiOS\/|FxiOS\//.test(ua)) return false;
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return false;
  return /Chrome\/|Chromium\/|Edg\//.test(ua) && !/Firefox\/|OPR\//.test(ua);
}

export function GlassFilters() {
  useEffect(() => {
    const root = document.documentElement;
    if (!backdropFiltersSvgFilters()) {
      root.removeAttribute('data-glass-refract');
      return undefined;
    }
    root.setAttribute('data-glass-refract', '1');
    return () => root.removeAttribute('data-glass-refract');
  }, []);

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    >
      <filter
        id={GLASS_LENS_FILTER_ID}
        x="0"
        y="0"
        width="100%"
        height="100%"
        colorInterpolationFilters="sRGB"
      >
        <feImage
          href={LENS_HREF}
          preserveAspectRatio="none"
          x="0"
          y="0"
          width="100%"
          height="100%"
          result="map"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="map"
          scale="80"
          xChannelSelector="R"
          yChannelSelector="G"
          result="bent"
        />
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.005 0.010"
          numOctaves="2"
          seed="3"
          result="noise"
        />
        <feDisplacementMap
          in="bent"
          in2="noise"
          scale="14"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
      <filter
        id={GLOW_CAUSTIC_FILTER_ID}
        x="-35%"
        y="-35%"
        width="170%"
        height="170%"
        colorInterpolationFilters="sRGB"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.013 0.03"
          numOctaves="2"
          seed="7"
          result="caustic"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="caustic"
          scale="11"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
      <filter
        id={MARK_LENS_FILTER_ID}
        x="0"
        y="0"
        width="100%"
        height="100%"
        colorInterpolationFilters="sRGB"
      >
        <feImage
          href={MAGNIFY_HREF}
          preserveAspectRatio="none"
          x="0"
          y="0"
          width="100%"
          height="100%"
          result="mmap"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="mmap"
          scale="12"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
      <filter
        id={ROLL_LENS_FILTER_ID}
        x="0"
        y="0"
        width="100%"
        height="100%"
        colorInterpolationFilters="sRGB"
      >
        <feImage
          href={MAGNIFY_HREF}
          preserveAspectRatio="none"
          x="0"
          y="0"
          width="100%"
          height="100%"
          result="rmap"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="rmap"
          scale="30"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}
