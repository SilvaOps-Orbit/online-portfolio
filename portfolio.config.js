window.PORTFOLIO_CONFIG = {
  profile: {
    name: "Alvis Leslie Gordon",
    initials: "AG",
    alias: "EchoOps",
    role: "Creative developer with a security mindset.",
    rolePrefix: "I am",
    typewriterRoles: [
      "a father",
      "a programmer",
      "a Discord bot developer",
      "a web developer",
      "a cyber security learner",
      "an automation builder",
      "gamer"
    ],
    kicker: "Interactive Portfolio",
    summary:
      "Creative developer with a security mindset, building useful digital experiences with thoughtful interaction, clean code, and secure foundations.",
    location: "Melbourne, Australia",
    focus: "Frontend, cyber security, AI automation",
    current: "Studying Diploma of ICT (Advanced Networking, Cyber Security)",
    availability: "Open to opportunities",
    email: "alvis.dev@proton.me",
    githubUsername: "SilvaOps-Orbit",
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
    "I am Alvis Leslie Gordon, a creative developer with a growing cyber security mindset and a strong drive to build something better than where I started.",
    "I am currently studying a Diploma of ICT, focused on Advanced Networking and Cyber Security, with partial completion of a Certificate IV in ICT. A lot of my skills have also been self-taught through hands-on projects, experimentation, and a genuine passion for technology.",
    "My work leans toward web development, Discord bots, AI automation, cyber security habits, and building systems that feel polished, useful, and alive. I care about the full path from idea to deployment, including structure, accessibility, performance, and safe defaults.",
    "I grew up in foster care my whole life, and that experience shaped my mindset. I want to break the cycle for my family and build a future with purpose, stability, and discipline. I am also a father to a 2-year-old, which pushes me even harder to keep improving and create a better life.",
    "I have ADHD and Autism, and I see the world differently because of it. For me, that means strong focus, creative problem-solving, and a deep interest in how systems work. Outside of tech, I am passionate about gaming, programming, surfing, long drives, travelling, and pushing myself beyond my comfort zone.",
    "I am also working toward applying for the Australian Defence Force, with the long-term goal of pursuing the 2nd Commando Regiment. Whether it is technology, cyber security, fitness, fatherhood, or personal growth, my mindset stays the same: stay disciplined, keep building, and become better than yesterday."
  ],
  skills: [
    { name: "Website Development", level: 89 },
    { name: "Cyber Security Basics", level: 74 },
    { name: "AI Automation", level: 20 },
    { name: "JavaScript Programming", level: 78 }
  ],
  projects: [
    {
      title: "This Portfolio Website!!",
      summary:
        "A fast static portfolio with animated sections, project filtering, a GitHub integration, and strict client-side security defaults.",
      tags: ["Frontend", "Security", "GitHub"," Portfolio","websites"],
      github: "https://github.com/SilvaOps-Orbit/online-portfolio",
      demo: "https://silvaops-orbit.github.io/online-portfolio/"
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
  steam: {
    steamId: "76561199192411740",
    profileUrl: "https://steamcommunity.com/profiles/76561199192411740",
    steamDbUrl: "https://steamdb.info/calculator/76561199192411740/",
    accountValue: {
      value: "Account Value A$ 910.00",
      note: "Manual value. Update this in portfolio.config.js whenever you want it changed.",
      manual: true
    },
    summary:
      "Gaming is part downtime, part challenge, and part systems thinking. This section can refresh from the Steam Web API during deployment without exposing API keys in the browser.",
    currentlyPlaying: [
      {
        title: "Current main game",
        note: "Add the game you are focused on right now."
      },
      {
        title: "Side rotation",
        note: "Add the game you jump into when you want a change of pace."
      }
    ],
    stats: [
      { label: "Owned Games", value: "Connect API" },
      { label: "Total Playtime", value: "Connect API" },
      { label: "Steam Level", value: "Connect API" }
    ],
    mostPlayed: [
      {
        title: "Most played game",
        meta: "Hours TBC",
        note: "Add your top Steam game and playtime."
      },
      {
        title: "Second most played",
        meta: "Hours TBC",
        note: "Add another game that says something about your taste."
      }
    ],
    achievements: [
      {
        title: "Achievement highlight",
        meta: "Game TBC",
        note: "Add a rare unlock, completion goal, or proud gaming moment."
      },
      {
        title: "Next achievement goal",
        meta: "In progress",
        note: "Add the achievement you are currently chasing."
      }
    ],
    completedGames: [
      {
        title: "100% games pending",
        meta: "Steam API",
        note: "This fills from achievement data when the Steam API refresh succeeds."
      }
    ],
    storeHighlights: [
      {
        title: "Steam Store feed pending",
        category: "Steam",
        tag: "Store",
        price: "API refresh",
        note: "The deployment workflow fills this with sales, popular games, new releases, and coming soon titles."
      }
    ],
    preorderWatch: [
      {
        title: "Pre-order feed pending",
        meta: "Steam Store",
        note: "Shows one upcoming/pre-order game at a time, with top seller fallback when Steam has no upcoming entries.",
        url: "https://store.steampowered.com/"
      }
    ]
  },
  spotify: {
    summary:
      "Music gives the build energy. This section can publish public playlists and the latest listening state from Spotify without exposing API secrets in the browser.",
    profileUrl: "",
    current: {
      title: "Spotify not connected yet",
      meta: "Live listening needs Spotify API secrets",
      note: "The browser reads generated data/spotify.json only."
    },
    playlists: [
      {
        title: "Public playlists pending",
        meta: "Spotify API",
        note: "Add Spotify secrets in GitHub Actions to publish playlist data."
      }
    ]
  },
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
