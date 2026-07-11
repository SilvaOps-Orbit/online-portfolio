import { initVisitorAnalytics } from "./analytics-client";

type MountFunction = (target: HTMLElement) => void;

interface IslandDefinition {
  id: string;
  label: string;
  load: () => Promise<MountFunction>;
}

const islands: IslandDefinition[] = [
  {
    id: "react-career-roadmap-root",
    label: "Career roadmap",
    load: async () => (await import("./CareerRoadmap")).mountCareerRoadmap
  },
  {
    id: "react-steam-dashboard-root",
    label: "Steam activity dashboard",
    load: async () => (await import("./SteamActivityDashboard")).mountSteamActivityDashboard
  },
  {
    id: "react-github-dashboard-root",
    label: "GitHub insights dashboard",
    load: async () => (await import("./GitHubInsightsDashboard")).mountGitHubInsightsDashboard
  },
  {
    id: "react-security-snapshot-root",
    label: "Security snapshot",
    load: async () => (await import("./SecuritySnapshot")).mountSecuritySnapshot
  },
  {
    id: "react-api-status-root",
    label: "Integration status",
    load: async () => (await import("./ApiStatusWidget")).mountApiStatusWidget
  },
  {
    id: "react-visitor-insights-root",
    label: "Visitor insights",
    load: async () => (await import("./VisitorInsights")).mountVisitorInsights
  },
  {
    id: "react-achievement-vault-root",
    label: "Technical achievement vault",
    load: async () => (await import("./TechnicalAchievementVault")).mountTechnicalAchievementVault
  }
];

function prepareIsland(definition: IslandDefinition) {
  const target = document.getElementById(definition.id);
  if (!target) return;
  let loaded = false;
  const mount = async () => {
    if (loaded) return;
    loaded = true;
    try {
      const mountIsland = await definition.load();
      mountIsland(target);
    } catch (error) {
      console.error(`${definition.label} React island could not be loaded`, error);
      target.innerHTML = `<div class="react-api-status-fallback is-error" role="status">${definition.label} is temporarily unavailable. The rest of the portfolio is still working.</div>`;
    }
  };

  if (definition.id === "react-achievement-vault-root" || !("IntersectionObserver" in window)) {
    void mount();
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    void mount();
  }, { rootMargin: "700px 0px" });
  observer.observe(target);
}

initVisitorAnalytics();
islands.forEach(prepareIsland);
