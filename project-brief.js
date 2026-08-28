(function () {
  "use strict";

  const form = document.getElementById("project-brief-form");
  const status = document.getElementById("project-brief-status");
  const profile = window.PORTFOLIO_CONFIG?.profile || {};
  const typeSelect = document.getElementById("brief-type");
  const contactSelect = document.getElementById("brief-contact");
  const portfolioOptions = document.getElementById("brief-portfolio-options");
  const discordOptions = document.getElementById("brief-discord-options");
  const discordInput = document.getElementById("brief-discord");

  if (!form || !profile.email) return;

  const updateConditionalFields = () => {
    const isPortfolio = typeSelect?.value === "Build a web portfolio";
    const usesDiscord = contactSelect?.value === "Discord";
    portfolioOptions?.toggleAttribute("hidden", !isPortfolio);
    portfolioOptions?.setAttribute("aria-hidden", String(!isPortfolio));
    discordOptions?.toggleAttribute("hidden", !usesDiscord);
    discordOptions?.setAttribute("aria-hidden", String(!usesDiscord));
    if (discordInput) discordInput.required = usesDiscord;
  };

  typeSelect?.addEventListener("change", updateConditionalFields);
  contactSelect?.addEventListener("change", updateConditionalFields);
  updateConditionalFields();

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
      `Budget range: ${value("budget")}`,
      `Target timeline: ${value("timeline")}`,
      `Preferred contact: ${value("contactPreference")}`,
      ...(value("type") === "Build a web portfolio" ? [
        `Portfolio style: ${value("portfolioStyle")}`,
        `Portfolio features: ${checkedValues("portfolioFeature").join(", ") || "Not provided"}`
      ] : []),
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
