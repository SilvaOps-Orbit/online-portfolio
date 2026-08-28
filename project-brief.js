(function () {
  "use strict";

  const form = document.getElementById("project-brief-form");
  const status = document.getElementById("project-brief-status");
  const profile = window.PORTFOLIO_CONFIG?.profile || {};

  if (!form || !profile.email) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const details = new FormData(form);
    const value = (name) => String(details.get(name) || "Not provided").trim();
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
