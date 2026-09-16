import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';
const PREFS_STORAGE_KEY = 'ems-prefs';
const PREFS_CHANGE_EVENT = 'ems-prefs-change';

function osPrefersReduce() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(QUERY).matches;
}

function appMotionMode() {
  if (typeof localStorage === 'undefined') return 'system';
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return 'system';
    const parsed = JSON.parse(raw);
    const mode = parsed?.reduceMotion;
    return mode === 'on' || mode === 'off' ? mode : 'system';
  } catch {
    return 'system';
  }
}

export function prefersReducedMotion() {
  const mode = appMotionMode();
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  return osPrefersReduce();
}

function subscribe(callback) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const media = window.matchMedia(QUERY);
  const teardown = [];
  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', callback);
    teardown.push(() => media.removeEventListener('change', callback));
  }
  window.addEventListener(PREFS_CHANGE_EVENT, callback);
  teardown.push(() => window.removeEventListener(PREFS_CHANGE_EVENT, callback));
  const onStorage = (event) => {
    if (event.key === PREFS_STORAGE_KEY) callback();
  };
  window.addEventListener('storage', onStorage);
  teardown.push(() => window.removeEventListener('storage', onStorage));
  return () => {
    for (const off of teardown) off();
  };
}

export function useReducedMotion() {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}
