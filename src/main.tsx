import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Suppress benign Vite WebSocket errors that appear in the production-like dev environment
if (typeof window !== 'undefined') {
  const isViteError = (msg: string) => 
    msg.includes('WebSocket') || 
    msg.includes('failed to connect to websocket') ||
    msg.includes('WebSocket closed without opened');

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = typeof reason === 'string' ? reason : reason?.message;
    if (msg && isViteError(msg)) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  // Also suppress console.error for WebSocket failures to clean up the logs
  const originalError = console.error;
  console.error = (...args) => {
    const firstArg = args[0];
    if (typeof firstArg === 'string' && isViteError(firstArg)) {
      return;
    }
    originalError.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
