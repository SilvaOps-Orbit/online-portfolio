(function () {
  "use strict";

  const form = document.getElementById("project-brief-form");
  const status = document.getElementById("project-brief-status");
  const profile = window.PORTFOLIO_CONFIG?.profile || {};
  const typeSelect = document.getElementById("brief-type");
  const contactSelect = document.getElementById("brief-contact");
  const portfolioOptions = document.getElementById("brief-portfolio-options");
  const typeOptionPanels = {
    "Build a web portfolio": portfolioOptions,
    "Interactive dashboard": document.getElementById("brief-dashboard-options"),
    "Discord bot or community tool": document.getElementById("brief-bot-options"),
    "AI automation": document.getElementById("brief-automation-options"),
    "Security or performance review": document.getElementById("brief-security-options"),
    "Something else": document.getElementById("brief-other-options")
  };
  const discordOptions = document.getElementById("brief-discord-options");
  const discordInput = document.getElementById("brief-discord");
  const paymentSelect = document.getElementById("brief-payment");
  const budgetRange = document.getElementById("brief-budget-range");
  const budgetValue = document.getElementById("brief-budget-value");
  const newSkillSelect = document.getElementById("brief-new-skill");
  const portfolioStyleSelect = document.getElementById("brief-portfolio-style");
  const estimateTotal = document.getElementById("brief-estimate-total");
  const estimateNote = document.getElementById("brief-estimate-note");

  if (!form || !profile.email) return;

  const updateConditionalFields = () => {
    const usesDiscord = contactSelect?.value === "Discord";
    Object.entries(typeOptionPanels).forEach(([type, panel]) => {
      const isActive = typeSelect?.value === type;
      panel?.toggleAttribute("hidden", !isActive);
      panel?.setAttribute("aria-hidden", String(!isActive));
    });
    discordOptions?.toggleAttribute("hidden", !usesDiscord);
    discordOptions?.setAttribute("aria-hidden", String(!usesDiscord));
    if (discordInput) discordInput.required = usesDiscord;
  };

  typeSelect?.addEventListener("change", updateConditionalFields);
  contactSelect?.addEventListener("change", updateConditionalFields);
  updateConditionalFields();

  const currency = (amount) => new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(amount);

  const estimateBuild = () => {
    const baseHours = {
      "Build a web portfolio": 20,
      "Interactive dashboard": 30,
      "Discord bot or community tool": 32,
      "AI automation": 36,
      "Security or performance review": 18,
      "Something else": 24
    };
    let hours = baseHours[typeSelect?.value] || 24;
    const features = form.querySelectorAll('.brief-conditional:not([hidden]) input[type="checkbox"]:checked').length;
    const styleHours = {
      "Creative and animated": 9,
      "Developer / cyber security": 5,
      "Gaming / content creator": 6,
      "Clean and professional": 3,
      "Minimal and editorial": 2,
      "Not sure yet": 4
    };
    const scopeWords = ["brief-goal", "brief-notes"]
      .map((id) => document.getElementById(id)?.value.trim().split(/\s+/).filter(Boolean).length || 0)
      .reduce((total, count) => total + count, 0);
    hours += features * 3 + (styleHours[portfolioStyleSelect?.value] || 0) + Math.min(10, Math.floor(scopeWords / 35));
    if (newSkillSelect?.value === "unsure") hours += 5;
    if (newSkillSelect?.value === "yes") hours = Math.ceil(hours * 1.3 + 8);

    const hourly = 55 + (newSkillSelect?.value === "yes" ? 10 : 0);
    const lowHours = Math.max(8, Math.round(hours * 0.85));
    const highHours = Math.round(hours * 1.2);
    const perHour = paymentSelect?.value === "hour";
    if (budgetRange) {
      budgetRange.min = perHour ? "35" : "300";
      budgetRange.max = perHour ? "130" : "6000";
      budgetRange.step = perHour ? "5" : "100";
      if (Number(budgetRange.value) < Number(budgetRange.min) || Number(budgetRange.value) > Number(budgetRange.max)) {
        budgetRange.value = String(perHour ? hourly : Math.round((lowHours + highHours) * hourly / 2 / 100) * 100);
      }
    }
    const selectedBudget = Number(budgetRange?.value || 0);
    if (budgetValue) {
      budgetValue.textContent = perHour
        ? `${currency(selectedBudget)} per hour`
        : `${currency(selectedBudget)} project budget`;
    }
    if (estimateTotal) {
      estimateTotal.textContent = perHour
        ? `${currency(Math.max(35, hourly - 10))} to ${currency(hourly + 15)} / hour`
        : `${currency(lowHours * hourly)} to ${currency(highHours * hourly)}`;
    }
    if (estimateNote) {
      const learningNote = newSkillSelect?.value === "yes"
        ? " Includes discovery time for a new skill or platform."
        : newSkillSelect?.value === "unsure"
          ? " Includes a small discovery allowance."
          : " Uses established tools and workflow.";
      estimateNote.textContent = `Estimated scope: about ${lowHours} to ${highHours} hours.${learningNote} This is a planning guide, not a final quote.`;
    }
  };

  [typeSelect, paymentSelect, budgetRange, newSkillSelect, portfolioStyleSelect, document.getElementById("brief-goal"), document.getElementById("brief-notes")]
    .filter(Boolean)
    .forEach((field) => {
      field.addEventListener("input", estimateBuild);
      field.addEventListener("change", estimateBuild);
    });
  form.querySelectorAll('.brief-conditional input[type="checkbox"]').forEach((field) => field.addEventListener("change", estimateBuild));
  estimateBuild();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const details = new FormData(form);
    const value = (name) => String(details.get(name) || "Not provided").trim();
    const checkedValues = (name) => details.getAll(name).map((item) => String(item).trim()).filter(Boolean);
    const subject = `Project brief from ${value("name")}`;
    const body = [
      "Hi Alvis,",
      "",
      "I would like to discuss a project.",
      "",
      `Name: ${value("name")}`,
      `Email: ${value("email")}`,
      `Organisation/project: ${value("organisation")}`,
      `Build type: ${value("type")}`,
      `Payment model: ${value("paymentModel") === "hour" ? "Per hour" : "Per project"}`,
      `Comfortable budget: ${budgetValue?.textContent || "Not provided"}`,
      `Planning estimate: ${estimateTotal?.textContent || "Not provided"}`,
      `Estimate notes: ${estimateNote?.textContent || "Not provided"}`,
      `Target timeline: ${value("timeline")}`,
      `Preferred contact: ${value("contactPreference")}`,
      ...(value("type") === "Build a web portfolio" ? [
        `Portfolio style: ${value("portfolioStyle")}`,
        `Portfolio features: ${checkedValues("portfolioFeature").join(", ") || "Not provided"}`
      ] : []),
      ...(value("type") === "Interactive dashboard" ? [
        `Dashboard audience: ${value("dashboardAudience")}`,
        `Dashboard needs: ${checkedValues("dashboardFeature").join(", ") || "Not provided"}`
      ] : []),
      ...(value("type") === "Discord bot or community tool" ? [
        `Community size: ${value("communitySize")}`,
        `Bot jobs: ${checkedValues("botFeature").join(", ") || "Not provided"}`
      ] : []),
      ...(value("type") === "AI automation" ? [
        `Current workflow: ${value("automationWorkflow")}`,
        `Automation needs: ${checkedValues("automationFeature").join(", ") || "Not provided"}`
      ] : []),
      ...(value("type") === "Security or performance review" ? [
        `Review scope: ${value("securityScope")}`,
        `Review focus: ${checkedValues("securityFocus").join(", ") || "Not provided"}`
      ] : []),
      ...(value("type") === "Something else" ? [`Closest fit: ${value("otherCategory")}`] : []),
      ...(value("contactPreference") === "Discord" ? [`Discord username: ${value("discordUsername")}`] : []),
      "",
      "Goal:",
      value("goal"),
      "",
      "Notes, links, and must-haves:",
      value("notes"),
      "",
      "Sent from the EchoOps project brief."
    ].join("\n");

    status.textContent = "Opening your email app with the project brief...";
    window.location.href = `mailto:${encodeURIComponent(profile.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
})();
