import type { IntegrationStatus } from "./status-utils";
import { formatRelativeTime } from "./status-utils";

const STATE_LABELS: Record<IntegrationStatus["state"], string> = {
  checking: "Checking",
  live: "Live",
  cached: "Cached",
  partial: "Setup needed",
  offline: "Unavailable"
};

interface StatusCardProps {
  status: IntegrationStatus;
}

export function StatusCard({ status }: StatusCardProps) {
  return (
    <article className={`react-api-card is-${status.state}`}>
      <div className="react-api-card-heading">
        <span className="react-api-state-dot" aria-hidden="true" />
        <strong>{status.label}</strong>
        <span className="react-api-state-label">{STATE_LABELS[status.state]}</span>
      </div>
      <p>{status.detail}</p>
      <dl className="react-api-card-meta">
        <div>
          <dt>Source</dt>
          <dd>{status.source}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>
            <time dateTime={status.updatedAt || undefined} title={status.updatedAt || undefined}>
              {formatRelativeTime(status.updatedAt)}
            </time>
          </dd>
        </div>
      </dl>
    </article>
  );
}
