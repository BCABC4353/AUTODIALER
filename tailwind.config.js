import designSystem from './design_system/tailwind.config.js';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [designSystem],
  content: [
    './src/renderer/index.html',
    './src/renderer/**/*.{js,jsx,ts,tsx}',
    './design_system/ds/**/*.{js,jsx}',
  ],
};
