import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { IslandBoundary } from "./IslandBoundary";
import { getPortfolioConfig } from "./portfolio-types";

function SecuritySnapshot() {
  const config = getPortfolioConfig();
  const controls = (config.security || []).filter(Boolean);
  const snapshot = config.securitySnapshot || {};
  return (
    <section className="security-score-card react-security-snapshot" aria-labelledby="react-security-snapshot-title">
      <div className="security-score-meter" aria-label={`${controls.length} configured controls active`}>
        <span className="security-score-value">{controls.length}/{controls.length}</span>
        <span className="security-score-label">controls active</span>
      </div>
      <div className="security-score-copy">
        <span className="security-score-kicker">React + TypeScript / {snapshot.label || "Site Hardening Snapshot"}</span>
        <h4 id="react-security-snapshot-title">{snapshot.posture || "Strong static-site posture"}</h4>
        <p>{snapshot.summary || "Security controls are rendered from the same configuration as the detailed cards below."}</p>
        <div className="security-score-chips">{controls.slice(0, 6).map((control) => <span key={control.title}>{control.title || "Security control"}</span>)}</div>
      </div>
    </section>
  );
}

export function mountSecuritySnapshot(target: HTMLElement) {
  createRoot(target).render(<StrictMode><IslandBoundary label="Security snapshot"><SecuritySnapshot /></IslandBoundary></StrictMode>);
}
