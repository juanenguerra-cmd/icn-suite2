import React from "react";
import { useICNStore } from "@/store/icnStore";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; errorMsg?: string };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { hasError: true, errorMsg: msg };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen p-6">
        <div className="max-w-xl mx-auto rounded-xl border bg-white p-5 shadow-sm">
          <h1 className="text-xl font-semibold">App recovered from an error</h1>
          <p className="text-sm opacity-80 mt-2">
            The UI hit something unexpected. Your saved data should still be intact.
          </p>
          <pre className="mt-3 text-xs whitespace-pre-wrap opacity-80">{this.state.errorMsg}</pre>

          <div className="flex flex-wrap gap-2 mt-4">
            <button
              className="rounded-full border px-4 py-2 hover:bg-gray-50"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>

            <button
              className="rounded-full border px-4 py-2 hover:bg-gray-50"
              onClick={() => {
                const data = useICNStore.getState().exportState();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `icn_backup_${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export data
            </button>

            <button
              className="rounded-full border px-4 py-2 hover:bg-gray-50"
              onClick={() => {
                useICNStore.getState().resetAll();
                window.location.reload();
              }}
            >
              Reset local data
            </button>
          </div>
        </div>
      </div>
    );
  }
}
