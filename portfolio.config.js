window.PORTFOLIO_CONFIG = {
  profile: {
    name: "Alvis Leslie Gordon",
    initials: "AG",
    alias: "Alias EchoOps",
    role: "Creative developer with a security mindset.",
    rolePrefix: "I am",
    typewriterRoles: [
      "a father",
      "a programmer",
      "a Discord bot developer",
      "a web developer",
      "a cyber security learner",
      "an automation builder"
    ],
    kicker: "Interactive Portfolio",
    summary:
      "Creative developer with a security mindset, building useful digital experiences with thoughtful interaction, clean code, and secure foundations.",
    location: "Melboune, Australia",
    focus: "Frontend, cyber security, AI automation",
    current: "Studying Diplomia ICT (Advanced Networking, Cyber Security)",
    availability: "Open to opportunities",
    email: "alvis.dev@proton.me",
    githubUsername: "",
    discordUrl: "",
    linkedinUrl: "",
    resumeUrl: ""
  },
  highlights: [
    { value: "3+", label: "Featured projects" },
    { value: "24/7", label: "Curious builder" },
    { value: "0", label: "Client-side secrets" }
  ],
  about: [
    "I am Alvis Leslie Gordon, a creative developer with a growing cyber security mindset. I like building things that feel polished, useful, and a little alive.",
    "My work leans toward web development, Discord bots, automation, and practical security habits. I care about the full path from idea to deployment: structure, accessibility, performance, and safe defaults."
  ],
  skills: [
    { name: "Website Development", level: 89 },
    { name: "Cyber Security Basics", level: 11 },
    { name: "AI Automation", level: 20 },
    { name: "JavaScript Programming", level: 78 }
  ],
  projects: [
    {
      title: "This Portfolio Website!!",
      summary:
        "A fast static portfolio with animated sections, project filtering, a GitHub integration, and strict client-side security defaults.",
      tags: ["Frontend", "Security", "GitHub"," Portfolio","websites"],
      github: "#",
      demo: "#"
    },
    {
      title: "Discord Bot Project",
      summary:
        "A Discord bot project space for commands, automations, community utilities, and future bot experiments.",
      tags: ["Discord", "Automation"],
      github: "#",
      demo: "#"
    },
    {
      title: "Security Checklist Tool",
      summary:
        "A lightweight checklist experience for reviewing common web security controls before shipping a project.",
      tags: ["Security", "Tools"],
      github: "#",
      demo: "#"
    }
  ],
  security: [
    {
      title: "No Client-Side Secrets",
      body:
        "The GitHub integration only uses public repository data. No personal access token, API key, private key, or Discord token belongs in browser JavaScript."
    },
    {
      title: "DOM-Safe Rendering",
      body:
        "Portfolio content is rendered with DOM APIs and textContent instead of injecting raw HTML, reducing the chance of cross-site scripting mistakes."
    },
    {
      title: "Content Security Policy",
      body:
        "The page includes a restrictive Content Security Policy that limits scripts, styles, images, connections, forms, frames, and embedded objects."
    },
    {
      title: "Privacy Headers",
      body:
        "The deployment header template includes no-referrer, nosniff, frame blocking, and a Permissions-Policy that disables camera, microphone, geolocation, payment, and USB access."
    },
    {
      title: "Small Supply Chain",
      body:
        "The front end avoids third-party packages. Fewer dependencies means fewer packages to audit and fewer supply-chain updates that can break trust."
    },
    {
      title: "GitHub Security Automation",
      body:
        "The repository includes CodeQL scanning and Dependabot updates for GitHub Actions, giving the project ongoing security checks after it is pushed."
    }
  ]
};
