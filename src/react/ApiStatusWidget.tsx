import { Component, StrictMode, type ErrorInfo, type PropsWithChildren, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { StatusCard } from "./StatusCard";
import { createCheckingStatuses, loadIntegrationStatuses, type IntegrationStatus } from "./status-utils";

interface ApiStatusWidgetProps {
  githubUser: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class WidgetErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("React API status widget failed safely", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="react-api-status-fallback is-error" role="status">
          Integration status is temporarily unavailable. The static portfolio is still working.
        </div>
      );
    }
    return this.props.children;
  }
}

function ApiStatusWidget({ githubUser }: ApiStatusWidgetProps) {
  const [statuses, setStatuses] = useState<IntegrationStatus[]>(createCheckingStatuses);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsRefreshing(true);
    loadIntegrationStatuses(githubUser, controller.signal)
      .then((nextStatuses) => {
        setStatuses(nextStatuses);
        setLastCheckedAt(new Date());
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) console.error("Integration pulse refresh failed", error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsRefreshing(false);
      });
    return () => controller.abort();
  }, [githubUser, refreshKey]);

  useEffect(() => {
    const requestRefresh = () => setRefreshKey((value) => value + 1);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") requestRefresh();
    }, 60_000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") requestRefresh();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const respondingCount = statuses.filter(
    (status) => !["checking", "offline"].includes(status.state)
  ).length;

  return (
    <section className="react-api-pulse" aria-labelledby="react-api-pulse-title">
      <div className="react-api-pulse-header">
        <div>
          <span className="react-api-tech-label">React + TypeScript</span>
          <h4 id="react-api-pulse-title">Integration status</h4>
          <p>{respondingCount} of {statuses.length} public sources responding.</p>
        </div>
        <button type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={isRefreshing}>
          {isRefreshing ? "Refreshing..." : "Refresh status"}
        </button>
      </div>
      <div className="react-api-grid" aria-live="polite" aria-busy={isRefreshing}>
        {statuses.map((status) => <StatusCard key={status.id} status={status} />)}
      </div>
      <p className="react-api-pulse-footer">
        {lastCheckedAt ? `Checked ${lastCheckedAt.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}.` : "Initial check in progress."}
        {" "}Only public endpoints and generated snapshots are read in the browser.
      </p>
    </section>
  );
}

export function mountApiStatusWidget(target: HTMLElement) {
  const githubUser = target.dataset.githubUser || "SilvaOps-Orbit";
  createRoot(target).render(
    <StrictMode>
      <WidgetErrorBoundary>
        <ApiStatusWidget githubUser={githubUser} />
      </WidgetErrorBoundary>
    </StrictMode>
  );
}
