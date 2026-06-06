// Top-level error boundary. Without this, an exception in any component
// during render unmounts the entire React tree → blank #root → "white screen
// of death" with no user-visible explanation. With this, we show a recovery
// UI plus the actual error message + stack so the user can screenshot it for
// us instead of just saying "white screen".

import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to console so DevTools captures it. Also keep in state for the UI.
    console.error("[ErrorBoundary] caught render error", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ error: null, errorInfo: null });
  };

  handleLogout = () => {
    try {
      localStorage.removeItem("supply_os_captain_token");
      localStorage.removeItem("supply_os_manager_token");
    } catch {
      /* ignore */
    }
    location.reload();
  };

  render() {
    if (this.state.error) {
      const stack = this.state.error.stack || String(this.state.error);
      const componentStack = this.state.errorInfo?.componentStack || "";
      return (
        <div className="min-h-screen bg-slate-50 p-6 flex items-start justify-center">
          <div className="max-w-2xl w-full bg-white rounded-lg border-2 border-red-400 shadow-lg p-6">
            <div className="text-red-700 font-semibold text-lg mb-2">
              Coś poszło nie tak — aplikacja przestała działać.
            </div>
            <p className="text-sm text-slate-700 mb-4">
              Spróbuj odświeżyć stronę. Jeśli błąd się powtarza, kliknij
              <strong> Wyloguj i resetuj</strong> — wyczyści lokalny token i
              przeładuje aplikację.
            </p>
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => location.reload()}
                className="px-4 py-2 rounded bg-blue-700 text-white text-sm font-medium hover:bg-blue-800"
              >
                Odśwież
              </button>
              <button
                type="button"
                onClick={this.handleLogout}
                className="px-4 py-2 rounded bg-red-700 text-white text-sm font-medium hover:bg-red-800"
              >
                Wyloguj i resetuj
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 rounded bg-slate-200 text-slate-800 text-sm font-medium hover:bg-slate-300"
              >
                Wróć
              </button>
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-slate-600 font-mono">
                Szczegóły techniczne (pokaż mi to przy zgłoszeniu)
              </summary>
              <pre className="mt-2 max-h-60 overflow-auto rounded bg-slate-100 p-2 font-mono text-[10px] text-slate-700 whitespace-pre-wrap">
                {String(this.state.error)}
                {"\n"}
                {stack}
                {componentStack ? "\nComponent stack:" + componentStack : ""}
              </pre>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
