(() => {
  "use strict";

  const siteUrl = "https://silvaops-orbit.github.io/online-portfolio/";
  const profileId = `${siteUrl}#alvis-leslie-gordon`;
  const websiteId = `${siteUrl}#website`;

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfilePage",
        "@id": `${siteUrl}#profile-page`,
        url: siteUrl,
        name: "Alvis Leslie Gordon (EchoOps) | Cyber Security Developer",
        description: "The interactive portfolio of Alvis Leslie Gordon, a creative developer with a growing cyber security mindset.",
        inLanguage: "en-AU",
        dateModified: "2026-07-11",
        isPartOf: { "@id": websiteId },
        mainEntity: { "@id": profileId }
      },
      {
        "@type": "Person",
        "@id": profileId,
        name: "Alvis Leslie Gordon",
        alternateName: "EchoOps",
        url: siteUrl,
        jobTitle: "Creative Developer",
        description: "Creative developer focused on secure web development, Discord bots, automation, networking, and cyber security.",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Melbourne",
          addressRegion: "Victoria",
          addressCountry: "AU"
        },
        knowsAbout: [
          "Web development",
          "Cyber security",
          "React",
          "TypeScript",
          "JavaScript",
          "Discord bot development",
          "AI automation",
          "Computer networking"
        ],
        sameAs: [
          "https://github.com/SilvaOps-Orbit",
          "https://steamcommunity.com/profiles/76561199192411740"
        ]
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        url: siteUrl,
        name: "EchoOps Portfolio",
        alternateName: "Alvis Leslie Gordon Portfolio",
        inLanguage: "en-AU",
        publisher: { "@id": profileId }
      }
    ]
  };

  const element = document.createElement("script");
  element.type = "application/ld+json";
  element.textContent = JSON.stringify(schema);
  document.head.appendChild(element);
})();
