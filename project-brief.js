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
    "Home or company network setup": document.getElementById("brief-network-options"),
    "Something else": document.getElementById("brief-other-options")
  };
  const discordOptions = document.getElementById("brief-discord-options");
  const discordInput = document.getElementById("brief-discord");
  const paymentSelect = document.getElementById("brief-payment");
  const timelineSelect = document.getElementById("brief-timeline");
  const budgetRange = document.getElementById("brief-budget-range");
  const budgetValue = document.getElementById("brief-budget-value");
  const budgetFit = document.getElementById("brief-budget-fit");
  const newSkillSelect = document.getElementById("brief-new-skill");
  const portfolioStyleSelect = document.getElementById("brief-portfolio-style");
  const estimateTotal = document.getElementById("brief-estimate-total");
  const estimateNote = document.getElementById("brief-estimate-note");
  const effortHours = document.getElementById("brief-effort-hours");
  const complexityOutput = document.getElementById("brief-complexity");
  const suggestedRate = document.getElementById("brief-suggested-rate");
  const cartTotal = document.getElementById("brief-cart-total");
  const cartLines = document.getElementById("brief-price-lines");
  const cartNote = document.getElementById("brief-cart-note");
  const readiness = document.getElementById("brief-readiness");

  if (!form || !profile.email) return;

  const optionHelp = {
    "Project showcase": "A section that presents completed work, what it does, and the thinking behind it.",
    "Animations and interaction": "Subtle movement, hover states, and interactive details that make the site feel more alive.",
    "Dark mode": "A switch that lets visitors use a darker colour theme when they prefer it.",
    "Contact form": "A simple way for visitors to send a project enquiry without hunting for an email address.",
    "Social or live data integrations": "Safely display selected information from services such as GitHub, Steam, Spotify, or YouTube.",
    "Mobile-first refinement": "Extra attention to small screens so the site is comfortable to use on phones first.",
    "Accessibility pass": "Checks for keyboard use, readable contrast, sensible labels, and reduced-motion support.",
    "SEO foundations": "Search-engine basics such as page titles, descriptions, structured content, and a sitemap.",
    "GitHub Pages deployment": "Publishing the finished static site through GitHub Pages with a public web address.",
    "Live API data": "Information that is retrieved from another service and refreshed automatically, such as prices or activity.",
    "Charts and reporting": "Visual summaries that make changes, comparisons, or trends easier to understand.",
    "Logins or roles": "Different access levels for different people. This may need a separate secure backend service.",
    "Exports or alerts": "Downloads, email notices, or notifications when information reaches a condition you set.",
    "Mobile dashboard view": "A layout designed to keep important dashboard information usable on a phone.",
    "Filters and saved views": "Controls that let people narrow information and return to a preferred setup.",
    "Manual data upload": "A controlled way to add information from a file, rather than connecting to a live service.",
    "Moderation and safety tools": "Commands and checks that help moderators manage a community more consistently.",
    "Role or verification flow": "A guided process for giving members the right access or confirming they have completed a step.",
    "Games or commands": "Fun community commands, mini experiences, or utility commands people can use in Discord.",
    "External API integration": "Connecting the bot to another service so it can display or act on selected data.",
    "Welcome and onboarding flow": "A helpful first path for new members, including rules, roles, and useful channel directions.",
    "Persistent settings or database": "Saving selected bot settings or community data so it remains available after a restart.",
    "Deployment and uptime setup": "Getting the bot hosted and setting up basic checks so it can keep running reliably.",
    "AI-assisted text or analysis": "Using an AI service to help classify, summarise, draft, or analyse information with human oversight.",
    "Multiple connected services": "Moving approved information between more than one service, such as a form, spreadsheet, and Discord.",
    "Human approval step": "Keeping a person in control before an automation sends, publishes, or changes something important.",
    "Scheduled or event-based runs": "Running the automation on a timetable or when something specific happens.",
    "Email or Discord notifications": "Sending a concise message when the automation completes or needs attention.",
    "Simple admin controls": "A small control surface for changing allowed settings without editing code.",
    "Usage logging": "A lightweight record of when an automation ran and whether it completed successfully.",
    "Security headers and safe defaults": "Browser and deployment settings that reduce common web risks by default.",
    "Dependency and update review": "Checking third-party packages and updates for known issues or avoidable risk.",
    "Privacy and data handling": "Reviewing what information is collected, where it goes, and whether it is necessary.",
    "Performance and accessibility": "Checking load speed, readability, keyboard use, and other everyday visitor experience basics.",
    "Deployment configuration check": "Reviewing how the site is published, including public settings and basic protections.",
    "Prioritised findings report": "A clear list of what was found, why it matters, and the recommended next actions.",
    "Wi-Fi coverage and mesh plan": "A practical plan for reliable wireless coverage, including access point or mesh placement.",
    "Router, modem, and internet setup": "Connecting and configuring the supplied internet equipment and core network settings.",
    "Wired device and cabling plan": "Planning stable wired connections and cable routes. Any specialist electrical or structural work can be quoted separately if needed.",
    "Guest network or device separation": "Keeping visitor, smart-home, or work devices separate from the main network where appropriate.",
    "Smart home or printer connection": "Connecting approved smart devices, printers, and everyday equipment to the network.",
    "Updates and safe device settings": "Applying sensible update, password, and access settings to supported network equipment.",
    "Network map and handover notes": "A simple record of the important equipment, Wi-Fi names, and setup choices for future reference."
  };

  const closeHelp = () => form.querySelectorAll(".brief-help-button.is-open").forEach((button) => {
    button.classList.remove("is-open");
    button.setAttribute("aria-expanded", "false");
  });

  const addHelp = (label, message) => {
    if (!label || !message || label.querySelector(".brief-help-button")) return;
    const button = document.createElement("button");
    const popover = document.createElement("span");
    button.type = "button";
    button.className = "brief-help-button";
    button.textContent = "?";
    button.setAttribute("aria-label", `Explain ${label.textContent.trim()}`);
    button.setAttribute("aria-expanded", "false");
    popover.className = "brief-help-popover";
    popover.setAttribute("role", "tooltip");
    popover.textContent = message;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const isOpen = button.classList.contains("is-open");
      closeHelp();
      if (!isOpen) {
        button.classList.add("is-open");
        button.setAttribute("aria-expanded", "true");
      }
    });
    label.append(button, popover);
  };

  form.querySelectorAll("[data-help]").forEach((label) => addHelp(label, label.dataset.help));
  form.querySelectorAll(".brief-feature-field label").forEach((label) => {
    const option = label.textContent.trim();
    addHelp(label, optionHelp[option] || "Choose this if it is important to the finished project.");
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".brief-help-button, .brief-help-popover")) closeHelp();
  });

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

  const estimateBuild = ({ syncBudget = false } = {}) => {
    const isLongTerm = timelineSelect?.value === "Long-term";
    if (paymentSelect) {
      if (isLongTerm) paymentSelect.value = "hour";
      paymentSelect.disabled = isLongTerm;
      paymentSelect.title = isLongTerm ? "Long-term work is billed per hour." : "";
    }
    const baseHours = {
      "Build a web portfolio": 20,
      "Interactive dashboard": 30,
      "Discord bot or community tool": 12,
      "AI automation": 48,
      "Security or performance review": 18,
      "Home or company network setup": 18,
      "Something else": 24
    };
    let hours = baseHours[typeSelect?.value] || 24;
    const selectedFeatures = [...form.querySelectorAll('.brief-conditional:not([hidden]) input[type="checkbox"]:checked')];
    const featureHours = selectedFeatures.reduce((total, field) => total + Number(field.dataset.effort || 3), 0);
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
    const portfolioStyleHours = typeSelect?.value === "Build a web portfolio"
      ? (styleHours[portfolioStyleSelect?.value] || 0)
      : 0;
    hours += featureHours + portfolioStyleHours + Math.min(10, Math.floor(scopeWords / 35));
    if (newSkillSelect?.value === "unsure") hours += 5;
    if (newSkillSelect?.value === "yes") hours = Math.ceil(hours * 1.3 + 8);

    const roleRateBenchmarks = {
      "Build a web portfolio": { role: "Web developer", marketRate: 51 },
      "Interactive dashboard": { role: "Data analyst / dashboard developer", marketRate: 66 },
      "Discord bot or community tool": { role: "Software developer", marketRate: 51 },
      "AI automation": { role: "AI engineer", marketRate: 71 },
      "Security or performance review": { role: "Cyber security analyst", marketRate: 59 },
      "Home or company network setup": { role: "Network support technician", marketRate: 48 },
      "Something else": { role: "Software developer", marketRate: 51 }
    };
    const timelinePricing = {
      Flexible: { project: 0, hourly: 0, label: "Flexible schedule", detail: "The lowest-cost option because work can be planned around the available build schedule." },
      "Within 2 to 3 months": { project: 100, hourly: 2, label: "Planned schedule", detail: "A light allowance for reserving a delivery window in advance." },
      "Within a month": { project: 250, hourly: 5, label: "Priority schedule", detail: "Extra priority is needed to complete the work within a month." },
      "Within 2 weeks": { project: 500, hourly: 10, label: "Rush schedule", detail: "A short turnaround needs protected build time and faster feedback." },
      "Long-term": { project: 75, hourly: 1, label: "Long-term reservation", detail: "A small allowance for holding space and maintaining a longer delivery plan." }
    };
    const timeline = timelineSelect?.value || "Flexible";
    const timelinePrice = timelinePricing[timeline] || timelinePricing.Flexible;
    const roleRate = roleRateBenchmarks[typeSelect?.value] || roleRateBenchmarks["Something else"];
    const rateBuffer = 10;
    const hourly = roleRate.marketRate + rateBuffer + timelinePrice.hourly + (newSkillSelect?.value === "yes" ? 10 : 0);
    const lowHours = Math.max(8, Math.round(hours * 0.85));
    const highHours = Math.round(hours * 1.2);
    const perHour = paymentSelect?.value === "hour";
    const discordBase = {
      "Under 100 members": { low: 150, high: 150, label: "Easy Discord bot base" },
      "100 to 1,000 members": { low: 250, high: 250, label: "Easy Discord bot base" },
      "1,000 to 10,000 members": { low: 350, high: 350, label: "Easy Discord bot base" },
      "10,000+ members": { low: 750, high: 900, label: "Easy Discord bot base" }
    };
    const basePricing = {
      "Build a web portfolio": { low: 700, high: 900, label: "Portfolio foundation" },
      "Interactive dashboard": { low: 1300, high: 1700, label: "Dashboard foundation" },
      "Discord bot or community tool": discordBase[document.getElementById("brief-community-size")?.value] || discordBase["Under 100 members"],
      "AI automation": { low: 2800, high: 3400, label: "High-complexity AI foundation" },
      "Security or performance review": { low: 600, high: 800, label: "Scoped review foundation" },
      "Home or company network setup": { low: 600, high: 850, label: "Network setup foundation" },
      "Something else": { low: 700, high: 1000, label: "Custom build foundation" }
    };
    const basePrice = basePricing[typeSelect?.value] || basePricing["Something else"];
    const addOns = selectedFeatures.map((field) => ({
      label: field.value,
      price: Math.max(25, Math.min(100, Math.round((Number(field.dataset.effort || 3) * 12.5) / 25) * 25)),
      hours: Number(field.dataset.effort || 3)
    }));
    const addOnPrice = addOns.reduce((total, item) => total + item.price, 0);
    const learningPrice = newSkillSelect?.value === "yes" ? 500 : newSkillSelect?.value === "unsure" ? 150 : 0;
    const scopePrice = Math.min(100, Math.floor(scopeWords / 35) * 25);
    const projectLow = basePrice.low + addOnPrice + learningPrice + scopePrice + timelinePrice.project;
    const projectHigh = basePrice.high + addOnPrice + learningPrice + scopePrice + timelinePrice.project;
    const guideLow = perHour ? Math.max(35, hourly - 10) : projectLow;
    const guideHigh = perHour ? hourly + 15 : projectHigh;
    if (budgetRange) {
      budgetRange.min = perHour ? "35" : "150";
      budgetRange.max = perHour ? "130" : "10000";
      budgetRange.step = perHour ? "5" : "100";
      if (syncBudget || Number(budgetRange.value) < Number(budgetRange.min) || Number(budgetRange.value) > Number(budgetRange.max)) {
        budgetRange.value = String(perHour ? hourly : Math.round(((guideLow + guideHigh) / 2) / 50) * 50);
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
        ? `${currency(guideLow)} to ${currency(guideHigh)} / hour`
        : `${currency(guideLow)} to ${currency(guideHigh)}`;
    }
    if (effortHours) effortHours.textContent = `${lowHours}-${highHours} hrs`;
    if (suggestedRate) suggestedRate.textContent = `${currency(hourly)}/hr`;
    if (complexityOutput) {
      const complexity = typeSelect?.value === "AI automation"
        ? "High"
        : typeSelect?.value === "Discord bot or community tool"
          ? "Easy"
          : hours >= 70 ? "High" : hours >= 42 ? "Detailed" : hours >= 28 ? "Balanced" : "Focused";
      complexityOutput.textContent = complexity;
      complexityOutput.className = `is-${complexity.toLowerCase()}`;
    }
    const cartItems = perHour
      ? [
          { label: "Estimated delivery time", value: `${lowHours}-${highHours} hrs`, detail: "The range changes as features and written scope are added." },
          { label: `${roleRate.role} market rate`, value: `${currency(roleRate.marketRate)}/hr`, detail: "A current Australian employee-style hourly equivalent for this kind of work." },
          { label: "Solo delivery allowance", value: `+${currency(rateBuffer)}/hr`, detail: "Most comparable roles sit inside a developer team. This A$10 allowance reflects one person carrying the planning, build, testing, communication, and delivery workload." },
          { label: timelinePrice.label, value: timelinePrice.hourly ? `+${currency(timelinePrice.hourly)}/hr` : "Included", detail: timelinePrice.detail },
          { label: "Your selected rate", value: `${currency(selectedBudget)}/hr`, detail: "The rate preference selected with the budget slider." },
          ...addOns.map((item) => ({ label: item.label, value: `+${item.hours} hrs`, detail: "Selected scope addition." })),
          ...(newSkillSelect?.value === "yes" ? [{ label: "Research and learning", value: "+8 hrs", detail: "Time to learn and validate a new platform or skill." }] : []),
          ...(newSkillSelect?.value === "unsure" ? [{ label: "Discovery allowance", value: "+5 hrs", detail: "A small allowance while the technical path is confirmed." }] : [])
        ]
      : [
          { label: basePrice.label, value: basePrice.low === basePrice.high ? currency(basePrice.low) : `${currency(basePrice.low)}-${currency(basePrice.high)}`, detail: typeSelect?.value === "Discord bot or community tool" ? "Scaled from community size before extras are added." : "The base work needed to make this type of project useful." },
          { label: timelinePrice.label, value: timelinePrice.project ? `+${currency(timelinePrice.project)}` : "Included", detail: timelinePrice.detail },
          { label: "Your comfortable budget", value: currency(selectedBudget), detail: "The project budget selected with the slider. It does not change the estimate, but shows whether the selected amount fits the scope." },
          ...addOns.map((item) => ({ label: item.label, value: `+${currency(item.price)}`, detail: "A selected scope addition." })),
          ...(learningPrice ? [{ label: newSkillSelect?.value === "yes" ? "Research and learning" : "Discovery allowance", value: `+${currency(learningPrice)}`, detail: "Allows time to validate a new skill, service, or platform." }] : []),
          ...(scopePrice ? [{ label: "Detailed written scope", value: `+${currency(scopePrice)}`, detail: "Extra planning allowance for the additional requirements shared." }] : [])
        ];
    if (cartTotal) cartTotal.textContent = perHour ? `${currency(guideLow)}-${currency(guideHigh)}/hr` : `${currency(projectLow)}-${currency(projectHigh)}`;
    if (cartLines) {
      cartLines.replaceChildren(...cartItems.map((item) => {
        const line = document.createElement("li");
        const copy = document.createElement("span");
        const value = document.createElement("strong");
        copy.textContent = item.label;
        value.textContent = item.value;
        line.append(copy, value);
        if (item.detail) line.title = item.detail;
        return line;
      }));
    }
    if (cartNote) {
      const complexityNote = typeSelect?.value === "AI automation"
        ? "AI automation is the highest-complexity service because it needs extra design, testing, and safe integration work."
        : typeSelect?.value === "Discord bot or community tool"
          ? "Discord bots start as an easy service; cost increases only with community scale and the features selected."
          : "Complexity rises with the chosen features, written scope, and any new skills or services needed.";
      cartNote.textContent = perHour
        ? `${complexityNote} The hourly figure is the ${roleRate.role.toLowerCase()} market equivalent plus an A$${rateBuffer} solo-delivery allowance, because one person carries the planning, build, testing, communication, and delivery work that a team would normally share. ${timelinePrice.detail}`
        : `${complexityNote} The project estimate combines a clear starting scope with A$25 to A$100 additions. ${timelinePrice.detail} It is a planning guide, not a binding quote.`;
    }
    form.dataset.scopeCart = cartItems.map((item) => `${item.label}: ${item.value}`).join("; ");
    if (budgetFit) {
      const unit = perHour ? "hourly rate" : "project budget";
      budgetFit.className = "brief-budget-fit";
      if (selectedBudget < guideLow) {
        budgetFit.classList.add("is-below");
        budgetFit.textContent = `${currency(guideLow - selectedBudget)} below the suggested ${unit}.`;
      } else if (selectedBudget > guideHigh) {
        budgetFit.classList.add("is-above");
        budgetFit.textContent = `${currency(selectedBudget - guideHigh)} above the suggested ${unit}.`;
      } else {
        budgetFit.classList.add("is-aligned");
        budgetFit.textContent = `Matches the suggested ${unit} for this scope.`;
      }
    }
    if (estimateNote) {
      const learningNote = newSkillSelect?.value === "yes"
        ? " Includes discovery time for a new skill or platform."
        : newSkillSelect?.value === "unsure"
          ? " Includes a small discovery allowance."
          : " Uses established tools and workflow.";
      estimateNote.textContent = `Based on the selected build, features, and written scope.${learningNote} Final pricing is confirmed after a proper conversation.`;
    }
  };

  const updateReadiness = () => {
    if (!readiness) return;
    const checks = [
      document.getElementById("brief-name")?.value.trim(),
      document.getElementById("brief-email")?.value.trim(),
      typeSelect?.value,
      timelineSelect?.value,
      budgetRange?.value,
      contactSelect?.value,
      document.getElementById("brief-goal")?.value.trim(),
      document.getElementById("brief-estimate-acknowledgement")?.checked
    ];
    const complete = checks.filter(Boolean).length;
    const isReady = complete === checks.length;
    readiness.classList.toggle("is-ready", isReady);
    readiness.textContent = isReady
      ? "Project brief: good to send."
      : `Project brief: ${complete} of ${checks.length} essentials ready.`;
  };

  form.addEventListener("input", (event) => {
    if (event.target.matches("input, select, textarea")) {
      estimateBuild();
      updateReadiness();
    }
  });
  timelineSelect?.addEventListener("change", () => {
    estimateBuild({ syncBudget: true });
    updateReadiness();
  });
  paymentSelect?.addEventListener("change", () => {
    estimateBuild({ syncBudget: true });
    updateReadiness();
  });
  budgetRange?.addEventListener("input", () => {
    estimateBuild();
    updateReadiness();
  });
  form.addEventListener("change", (event) => {
    if (event.target.matches("input, select, textarea")) {
      estimateBuild();
      updateReadiness();
    }
  });
  estimateBuild();
  updateReadiness();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const details = new FormData(form);
    if (timelineSelect?.value === "Long-term") details.set("paymentModel", "hour");
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
      `Projected effort: ${effortHours?.textContent || "Not provided"}`,
      `Scope complexity: ${complexityOutput?.textContent || "Not provided"}`,
      `Suggested rate: ${suggestedRate?.textContent || "Not provided"}`,
      `Scope cart: ${form.dataset.scopeCart || "Not provided"}`,
      `Estimate notes: ${estimateNote?.textContent || "Not provided"}`,
      `Target timeline: ${value("timeline")}`,
      `Preferred contact: ${value("contactPreference")}`,
      `Location: ${value("location")}`,
      `Preferred start date: ${value("preferredStartDate")}`,
      `Ongoing support: ${value("maintenancePreference")}`,
      `Support preference: ${value("supportPreference")}`,
      `Found EchoOps via: ${value("referralSource")}`,
      `Showcase permission: ${value("showcasePermission")}`,
      `Planning estimate acknowledged: ${details.has("estimateAcknowledgement") ? "Yes" : "No"}`,
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
      ...(value("type") === "Home or company network setup" ? [
        `Network setting: ${value("networkSetting")}`,
        `Network needs: ${checkedValues("networkFeature").join(", ") || "Not provided"}`
      ] : []),
      ...(value("type") === "Something else" ? [
        `Closest fit: ${value("otherCategory")}`,
        `Idea stage: ${value("otherStage")}`
      ] : []),
      ...(value("contactPreference") === "Discord" ? [`Discord username: ${value("discordUsername")}`] : []),
      "",
      "Goal:",
      value("goal"),
      "",
      "Notes, links, and must-haves:",
      value("notes"),
      "",
      "Existing setup, tools, or equipment:",
      value("existingSetup"),
      "",
      "Must-haves:",
      value("mustHaves"),
      "",
      "Nice-to-haves:",
      value("niceToHaves"),
      "",
      "Design references or examples:",
      value("designReferences"),
      "",
      "Sent from the EchoOps project brief."
    ].join("\n");

    status.textContent = "Opening your email app with the project brief...";
    window.location.href = `mailto:${encodeURIComponent(profile.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
})();
