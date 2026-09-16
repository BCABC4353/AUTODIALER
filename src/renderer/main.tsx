import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary, GlassFilters } from '@ds/index.js';
import { App } from './App';
import './styles/index.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <ErrorBoundary>
      <GlassFilters />
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
