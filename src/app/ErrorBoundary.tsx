import { Component, type ErrorInfo, type ReactNode } from "react";

interface State { failed: boolean }

/** Last line of defence: a render error shows a recovery screen instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#081508] p-6">
        <div className="max-w-sm text-center">
          <p className="text-4xl mb-3">🌾</p>
          <h1 className="text-lg text-[#ddefd4] mb-2">Something went wrong</h1>
          <p className="text-sm text-[#6a8f5e] mb-5 leading-relaxed">
            The page hit an unexpected problem. Your saved farm data is safe — reloading usually fixes it.
          </p>
          <button onClick={() => window.location.reload()}
            className="px-4 py-2 rounded bg-[#7ab648] text-[#0a1809] text-sm font-medium hover:bg-[#9ed460] transition-colors">
            Reload
          </button>
        </div>
      </div>
    );
  }
}
