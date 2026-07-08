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
      "A gamer"
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
        title: "Pre-order / Top 20 feed pending",
        meta: "Steam Store",
        price: "API refresh",
        note: "Shows one randomized upcoming/pre-order or top 20 Steam game at a time after the store refresh runs.",
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
        "Steam, Spotify, and GitHub data are designed so API keys, client secrets, refresh tokens, private keys, and Discord tokens never belong in browser JavaScript.",
      docs: [
        {
          label: "GitHub Actions Secrets",
          url: "https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions"
        }
      ]
    },
    {
      title: "DOM-Safe Rendering",
      body:
        "Portfolio content is rendered with DOM APIs and textContent instead of injecting raw HTML, reducing the chance of cross-site scripting mistakes.",
      docs: [
        {
          label: "OWASP XSS Prevention",
          url: "https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html"
        }
      ]
    },
    {
      title: "Content Security Policy",
      body:
        "The page includes a restrictive Content Security Policy that limits scripts, styles, images, connections, forms, frames, and embedded objects.",
      docs: [
        {
          label: "MDN CSP",
          url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP"
        }
      ]
    },
    {
      title: "Privacy Headers",
      body:
        "The deployment header template includes no-referrer, nosniff, frame blocking, and a Permissions-Policy that disables camera, microphone, geolocation, payment, and USB access.",
      docs: [
        {
          label: "MDN Permissions-Policy",
          url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy"
        }
      ]
    },
    {
      title: "Generated Public Data",
      body:
        "Live Steam and Spotify data is generated in GitHub Actions, saved into public JSON files, and then read by the site. The browser only sees safe output, not the credentials used to collect it.",
      docs: [
        {
          label: "GitHub Actions",
          url: "https://docs.github.com/en/actions"
        }
      ]
    },
    {
      title: "Plain-Text API Sanitization",
      body:
        "Steam and Spotify API text is normalized into plain text before it is published to data files, removing tag-like markup, avoiding repeated entity decoding, and keeping generated content safe to display.",
      docs: [
        {
          label: "OWASP Output Encoding",
          url: "https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html"
        }
      ]
    },
    {
      title: "Small Supply Chain",
      body:
        "The front end avoids third-party packages. Fewer dependencies means fewer packages to audit and fewer supply-chain updates that can break trust."
    },
    {
      title: "GitHub Security Automation",
      body:
        "The repository includes CodeQL scanning and Dependabot updates for GitHub Actions, giving the project ongoing security checks after it is pushed.",
      docs: [
        {
          label: "CodeQL",
          url: "https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-code-scanning"
        },
        {
          label: "Dependabot",
          url: "https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain"
        }
      ]
    }
  ],
  nerdFeatures: [
    {
      title: "GitHub Repository Feed",
      body:
        "The portfolio pulls public repositories from GitHub so the project section can show real work that changes as the account changes.",
      why: "It proves the portfolio is connected to live public work without needing a GitHub token in the browser.",
      docs: [
        {
          label: "GitHub REST API",
          url: "https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#list-repositories-for-a-user"
        }
      ]
    },
    {
      title: "Steam Activity and Library Data",
      body:
        "Steam data is refreshed by scheduled GitHub Actions and written to data/steam.json for active games, recent games, most-played games, achievements, and 100% games.",
      why: "It gives the portfolio personality while keeping the Steam API key out of the public site.",
      docs: [
        {
          label: "Steam Web API",
          url: "https://steamcommunity.com/dev"
        }
      ]
    },
    {
      title: "Pre-Order and Top Games Watch",
      body:
        "The Steam section rotates one highlighted store game at a time with artwork, store links, prices, discounts, and edition data when Steam exposes it.",
      why: "It fills the gaming section with something current even when no game is actively open."
    },
    {
      title: "Spotify Now Playing",
      body:
        "Spotify uses an OAuth refresh token inside GitHub Actions to publish the current track or last saved track without exposing Spotify secrets to visitors.",
      why: "It makes the site feel alive while keeping authentication on the server-side workflow.",
      docs: [
        {
          label: "Now Playing API",
          url: "https://developer.spotify.com/documentation/web-api/reference/get-the-users-currently-playing-track"
        },
        {
          label: "Spotify Refresh Tokens",
          url: "https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens"
        }
      ]
    },
    {
      title: "Spotify Public Playlists",
      body:
        "The music section can list public playlists from Spotify and cycle them in the page layout.",
      why: "It adds personal taste without making visitors sign in or loading private playlist data.",
      docs: [
        {
          label: "Playlist API",
          url: "https://developer.spotify.com/documentation/web-api/reference/get-a-list-of-current-users-playlists"
        }
      ]
    },
    {
      title: "Preloaded Dynamic Data",
      body:
        "The loading layer fetches Steam and Spotify JSON before revealing the page, then keeps fallbacks when an API refresh fails.",
      why: "It makes the first view feel intentional and prevents empty live-data sections from looking broken."
    },
    {
      title: "Interactive Personality",
      body:
        "The site uses a typewriter role line, dark mode, reveal animations, project filters, cycling lists, and a styled loading screen.",
      why: "It shows creative front-end taste while keeping the build lightweight and fast."
    }
  ]
};
