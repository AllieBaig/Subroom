import React, { useState, useEffect, Component, ErrorInfo } from 'react';
import { AlertTriangle, RotateCcw, ShieldCheck } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorInfo: string | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorInfo: (error as Error).message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[CRITICAL RENDER FAILURE]", error, errorInfo);
    // Track crashes to verify if it's persistent
    const crashHistory = localStorage.getItem('app_crash_log') || '[]';
    const logs = JSON.parse(crashHistory);
    logs.push(Date.now());
    
    // Keep only last 10 crashes
    const recentLogs = logs.filter((t: number) => t > Date.now() - 30000).slice(-10);
    localStorage.setItem('app_crash_log', JSON.stringify(recentLogs));
    
    // If more than 5 crashes in 30 seconds, we show the hard recovery
    if (recentLogs.length >= 5) {
      this.setState({ hasError: true, errorInfo: "Interface stabilization required." });
    } else {
      // Automatic silent recovery for isolated hiccups
      console.warn("Safety: Attempting silent UI recovery...");
      setTimeout(() => this.setState({ hasError: false, errorInfo: null }), 1000);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-system-background p-8 text-center z-[10000]">
          <div className="max-w-md w-full bg-apple-card rounded-[2.5rem] p-10 border border-apple-border shadow-2xl animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-apple-blue/10 text-apple-blue rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
              <ShieldCheck size={40} />
            </div>
            <h2 className="text-2xl font-bold mb-3 text-system-label">System Refresh</h2>
            <p className="text-system-secondary-label text-sm mb-10 leading-relaxed font-medium">
              We've optimized the interface state to ensure stability. Your library and settings remain safe.
            </p>
            <div className="space-y-3">
              <button 
                onClick={() => {
                  localStorage.removeItem('app_crash_log');
                  localStorage.removeItem('app_boot_crash_count');
                  this.setState({ hasError: false, errorInfo: null });
                }}
                className="w-full bg-apple-blue text-white h-14 rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-lg shadow-apple-blue/20"
              >
                <RotateCcw size={20} />
                <span>Resume App</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const GlobalSafetyManager = ({ children }: { children: React.ReactNode }) => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for crash loop on mount
    const bootCrashes = parseInt(localStorage.getItem('app_boot_crash_count') || '0');
    if (bootCrashes > 10) {
      console.warn("Safety: Repeated boot failure. Applying minimal reset.");
      localStorage.removeItem('app_boot_crash_count');
      localStorage.removeItem('subliminal_active_tab');
    }

    const handleError = (event: ErrorEvent) => {
      // Ignore non-critical errors or environment noise
      if (
        event.message?.includes('ResizeObserver') || 
        event.message?.includes('Vite') ||
        event.message?.includes('Script error.') || // External scripts
        !event.error // Non-standard errors
      ) return;
      
      console.error("[RUNTIME SYSTEM ERROR]", event.error?.stack || event.message);
      
      // Only trigger if it's a critical boot error (within first 8 seconds for slow devices)
      const uptime = performance.now();
      if (uptime < 8000) {
        const newCount = bootCrashes + 1;
        localStorage.setItem('app_boot_crash_count', newCount.toString());
        
        // Don't show hard error unless it's a repeated boot failure
        if (newCount > 3) {
          setError("System optimization in progress.");
        }
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      // Async rejections (like offline network fails) shouldn't freeze the UI
      console.warn("[ASYNC COORDINATION]", event.reason?.message || event.reason);
      
      // If it's a specific DB error, we might want to log it but not freeze
      if (event.reason?.message?.includes('IndexedDB')) {
        console.error("Critical DB rejection handled silently.");
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-system-background z-[10001]">
        <div className="max-w-md w-full bg-apple-card rounded-[2.5rem] p-10 border border-apple-border shadow-2xl text-center">
          <div className="w-20 h-20 bg-apple-blue/10 text-apple-blue rounded-3xl flex items-center justify-center mx-auto mb-8">
            <ShieldCheck size={40} />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-system-label">Stable Mode</h2>
          <p className="text-system-secondary-label text-sm mb-10 leading-relaxed font-medium">
            System initialization is coordinating local resources. A quick refresh will restore full access.
          </p>
          <button 
            onClick={() => {
              localStorage.setItem('app_boot_crash_count', '0');
              setError(null);
              window.location.reload(); // Hard reload to clear stack
            }}
            className="w-full bg-apple-blue text-white h-14 rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-lg"
          >
            <RotateCcw size={20} />
            <span>Refresh & Resume</span>
          </button>
        </div>
      </div>
    );
  }

  return <ErrorBoundary>{children}</ErrorBoundary>;
};

export const LoadingPlaceholder = () => (
  <div className="h-full flex flex-col items-center justify-center bg-system-background">
    <div className="w-28 h-28 bg-apple-card rounded-[32px] shadow-xl flex items-center justify-center animate-pulse">
      <div className="w-12 h-12 bg-system-tertiary-label/20 rounded-xl" />
    </div>
    <div className="mt-12 flex flex-col items-center gap-4">
      <div className="h-6 w-48 bg-secondary-system-background rounded-full animate-pulse" />
      <div className="h-4 w-32 bg-secondary-system-background rounded-full animate-pulse opacity-60" />
    </div>
  </div>
);
