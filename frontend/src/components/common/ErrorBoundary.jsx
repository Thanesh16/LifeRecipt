import React from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';
import Button from './Button';

/**
 * Robust React Error Boundary component.
 * Prevents unhandled rendering errors from unmounting the React tree
 * or leaving the user with an unresponsive black screen.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[LifeReceipt ErrorBoundary] Caught render error:', error, errorInfo);
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetErrorBoundary = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      // 1. If custom fallback provided
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback({
            error: this.state.error,
            resetErrorBoundary: this.resetErrorBoundary,
          });
        }
        return this.props.fallback;
      }

      // 2. Default graceful Fallback UI
      return (
        <div className="min-h-[320px] w-full flex items-center justify-center p-6 bg-slate-950/60 rounded-2xl border border-rose-500/20 my-4">
          <div className="max-w-lg w-full space-y-4 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white tracking-tight">
                  {this.props.title || 'Component Display Notice'}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {this.props.description ||
                    'A display issue occurred while rendering this section. Your underlying data and session remain secure.'}
                </p>
              </div>
            </div>

            {/* Error Message preview */}
            {this.state.error && (
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-left">
                <div className="text-xs font-mono text-rose-300 break-words">
                  {this.state.error.toString()}
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={this.toggleDetails}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <span>{this.state.showDetails ? 'Hide technical stack' : 'View technical stack'}</span>
                    {this.state.showDetails ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>
                </div>

                {this.state.showDetails && this.state.errorInfo?.componentStack && (
                  <pre className="mt-2 p-2 rounded bg-slate-950 text-[10px] font-mono text-slate-400 overflow-x-auto max-h-40 leading-normal">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.location.href = '/dashboard';
                }}
                leftIcon={<Home className="w-3.5 h-3.5" />}
              >
                Go to Dashboard
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={this.resetErrorBoundary}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
