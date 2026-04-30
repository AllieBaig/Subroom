
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[GlobalErrorBoundary] Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    // Attempt to clear potentially corrupt state
    localStorage.removeItem('app_settings_backup');
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-system-background z-[9999] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold mb-2">Unexpected Glitch</h1>
          <p className="text-system-secondary-label text-sm mb-8 max-w-xs leading-relaxed">
            The application encountered a runtime error. We've logged the incident and recommend restarting.
          </p>
          
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 bg-system-blue text-white px-6 py-3 rounded-full text-sm font-medium active:scale-95 transition-transform"
          >
            <RotateCcw className="w-4 h-4" />
            Reload Application
          </button>
          
          {this.state.error && (
            <pre className="mt-8 p-4 bg-system-quaternary-fill rounded-lg text-[10px] text-left max-w-full overflow-auto font-mono text-system-secondary-label">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
