import { Component, StrictMode, type ErrorInfo, type PropsWithChildren, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { StatusCard } from "./StatusCard";
import {
  createCheckingStatuses,
  loadIntegrationStatuses,
  loadProviderStatuses,
  type IntegrationStatus,
  type ProviderStatus
} from "./status-utils";

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

function ApiStatusWidget() {
  const [statuses, setStatuses] = useState<IntegrationStatus[]>(createCheckingStatuses);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsRefreshing(true);
    Promise.all([loadIntegrationStatuses(controller.signal), loadProviderStatuses(controller.signal)])
      .then(([nextStatuses, nextProviders]) => {
        setStatuses(nextStatuses);
        setProviders(nextProviders);
        setLastCheckedAt(new Date());
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) console.error("Integration pulse refresh failed", error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsRefreshing(false);
      });
    return () => controller.abort();
  }, [refreshKey]);

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
  const externallyMonitored = providers.filter((provider) => provider.coverage === "external");
  const externalUp = externallyMonitored.filter((provider) => provider.status === "up").length;

  const providerLabel = (provider: ProviderStatus) => {
    if (provider.coverage === "external") return provider.status === "up" ? "Up" : provider.status;
    if (provider.coverage === "snapshot") return provider.status === "up" ? "Snapshot OK" : "Snapshot stale";
    if (provider.coverage === "setup") return "Setup";
    return "On use";
  };

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
      {providers.length ? (
        <section className="provider-pulse" aria-labelledby="provider-pulse-title">
          <div className="provider-pulse-heading">
            <div>
              <h5 id="provider-pulse-title">Provider network</h5>
              <p>{externalUp} of {externallyMonitored.length} API Status Check providers report up. Other services are labelled by their real check method.</p>
            </div>
            <a href="https://apistatuscheck.com/" target="_blank" rel="noopener noreferrer">API Status Check</a>
          </div>
          <div className="provider-pulse-grid">
            {providers.map((provider) => {
              const content = <><i aria-hidden="true" /><span><strong>{provider.label}</strong><small>{providerLabel(provider)}</small></span></>;
              return provider.statusUrl
                ? <a key={provider.id} className={`provider-pulse-item is-${provider.status}`} href={provider.statusUrl} target="_blank" rel="noopener noreferrer" title={`${provider.role}. ${provider.source}`}>{content}</a>
                : <span key={provider.id} className={`provider-pulse-item is-${provider.status}`} title={`${provider.role}. ${provider.source}`}>{content}</span>;
            })}
          </div>
        </section>
      ) : null}
      <p className="react-api-pulse-footer">
        {lastCheckedAt ? `Checked ${lastCheckedAt.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}.` : "Initial check in progress."}
        {" "}Only public endpoints and generated snapshots are read in the browser.
      </p>
    </section>
  );
}

export function mountApiStatusWidget(target: HTMLElement) {
  createRoot(target).render(
    <StrictMode>
      <WidgetErrorBoundary>
        <ApiStatusWidget />
      </WidgetErrorBoundary>
    </StrictMode>
  );
}
