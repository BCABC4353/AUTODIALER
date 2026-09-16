/// <reference types="vite/client" />

declare module '@ds/*';
declare module '@design/*';

declare namespace JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      src?: string;
      partition?: string;
      allowpopups?: string;
      webpreferences?: string;
    };
  }
}
