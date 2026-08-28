import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { IslandBoundary } from "./IslandBoundary";
import { getPortfolioConfig } from "./portfolio-types";

const preferenceKey = "portfolio-reduced-motion";

function getSavedPreference() {
  return localStorage.getItem(preferenceKey) === "true";
}

function AccessibilityPanel() {
  const config = getPortfolioConfig();
  const details = config.accessibility || {};
  const [reducedMotion, setReducedMotion] = useState(getSavedPreference);

  useEffect(() => {
    document.documentElement.classList.toggle("user-reduced-motion", reducedMotion);
    localStorage.setItem(preferenceKey, String(reducedMotion));
  }, [reducedMotion]);

  const items = [
    ["Keyboard", "Skip link, visible focus, and menu controls"],
    ["Motion", reducedMotion ? "Visitor motion pause is on" : "Follows device motion preferences"],
    ["Contrast", "Dark and light themes keep controls legible"],
    ["Performance", "Static-first page with on-demand React islands"]
  ];

  return (
    <section className="accessibility-panel" aria-labelledby="accessibility-panel-title">
      <div className="accessibility-panel-header">
        <div>
          <span className="security-score-kicker">React + TypeScript / {details.label || "Accessibility controls"}</span>
          <h4 id="accessibility-panel-title">Built for more ways to browse.</h4>
          <p>{details.summary || "The portfolio keeps navigation, contrast, layout, and motion choices visible and practical."}</p>
        </div>
        <button
          className="accessibility-panel-action"
          type="button"
          aria-pressed={reducedMotion}
          onClick={() => setReducedMotion((value) => !value)}
        >
          {reducedMotion ? "Motion paused" : "Pause motion"}
        </button>
      </div>
      <div className="accessibility-panel-grid">
        {items.map(([label, description]) => (
          <div className="accessibility-panel-item" key={label}>
            <strong>{label}</strong>
            <span>{description}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function mountAccessibilityPanel(target: HTMLElement) {
  createRoot(target).render(
    <StrictMode>
      <IslandBoundary label="Accessibility controls">
        <AccessibilityPanel />
      </IslandBoundary>
    </StrictMode>
  );
}
