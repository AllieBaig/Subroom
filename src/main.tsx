import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import SafetyChecker from './utils/SafetyChecker';

// Pre-boot diagnostics (Async, non-blocking)
SafetyChecker.runFullDiagnostics().then(report => {
  if (report.status === 'critical') {
    console.error('[Safety] System is in critical state. Proceeding with caution.');
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
);

// Version tracking for cache-busting
const APP_VERSION = '1.1.0';

// Safety: Hide shell once React is stable
// Transition smoothly to prevent flash
setTimeout(() => {
  const shell = document.getElementById('app-shell');
  if (shell) {
    shell.style.opacity = '0';
    setTimeout(() => {
      shell.style.display = 'none';
      shell.classList.add('hidden');
    }, 400); // Wait for transition
  }
}, 800);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Aggressive SW registration with relative paths for GitHub Pages compatibility
    const swPath = './sw.js';
    navigator.serviceWorker.register(swPath)
      .then(registration => {
        console.log('[SW] PWA System Active:', registration.scope);
        
        // Auto-update SW if new version is found
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.onstatechange = () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[SW] New version available, ready for reload');
              }
            };
          }
        });
      })
      .catch(err => {
        console.error('[SW] System offline fallback failed:', err);
      });
  });
}

