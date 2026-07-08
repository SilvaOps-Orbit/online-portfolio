(function () {
  "use strict";

  const config = window.PORTFOLIO_CONFIG || {};
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;

  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) {
      element.className = className;
    }
    if (typeof text === "string") {
      element.textContent = text;
    }
    return element;
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element && typeof value === "string" && value.trim()) {
      element.textContent = value;
    }
  }

  function safeUrl(value) {
    if (typeof value !== "string" || !value.trim()) {
      return "#";
    }

    const trimmed = value.trim();
    const hasProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);

    if (!hasProtocol || trimmed.startsWith("#") || trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) {
      return trimmed;
    }

    try {
      const parsed = new URL(trimmed);
      if (["https:", "http:", "mailto:"].includes(parsed.protocol)) {
        return parsed.href;
      }
    } catch (error) {
      return "#";
    }

    return "#";
  }

  function setLink(id, href) {
    const element = document.getElementById(id);
    if (element) {
      element.setAttribute("href", safeUrl(href));
    }
  }

  function githubProfileUrl(username) {
    if (!username || username === "your-github-username") {
      return "https://github.com/";
    }
    return `https://github.com/${encodeURIComponent(username)}`;
  }

  function applyProfile() {
    const profile = config.profile || {};
    const username = profile.githubUsername || "";

    document.title = `${profile.name || "Personal"} | Portfolio`;
    setText("brand-name", profile.name || "Portfolio");
    setText("hero-kicker", profile.kicker);
    setText("hero-name", profile.name);
    setText("hero-alias", profile.alias ? `aka ${profile.alias}` : "aka Alias TBC");
    setText("role-prefix", profile.rolePrefix || "I am");
    setText("hero-summary", profile.summary);
    setText("availability", profile.availability);
    setText("portrait-mark", profile.initials);
    setText("location", profile.location);
    setText("focus", profile.focus);
    setText("current", profile.current);
    setText("footer-name", profile.name);

    setLink("github-profile-link", githubProfileUrl(username));
    setLink("email-link", `mailto:${profile.email || ""}`);
  }

  function renderHighlights() {
    const grid = document.getElementById("highlight-grid");
    if (!grid) return;
    grid.replaceChildren();

    (config.highlights || []).forEach((item) => {
      const li = createElement("li");
      const value = createElement("span", "highlight-value", String(item.value || ""));
      const label = createElement("span", "highlight-label", String(item.label || ""));
      li.append(value, label);
      grid.append(li);
    });
  }

  function renderAbout() {
    const copy = document.getElementById("about-copy");
    if (copy) {
      copy.replaceChildren();
      const story = createElement("article", "story-body reveal");
      (config.about || []).forEach((paragraph) => {
        story.append(createElement("p", "", paragraph));
      });
      copy.append(story);
    }

    const skillList = document.getElementById("skill-list");
    if (!skillList) return;
    skillList.replaceChildren();

    (config.skills || []).forEach((skill) => {
      const row = createElement("article", "skill-row");
      const header = createElement("header");
      const name = createElement("span", "", skill.name || "Skill");
      const level = Math.max(0, Math.min(100, Number(skill.level || 0)));
      const value = createElement("span", "", `${level}%`);
      const meter = createElement("progress", "skill-meter");
      meter.max = 100;
      meter.value = level;
      meter.setAttribute("aria-label", `${skill.name || "Skill"} ${level}%`);

      header.append(name, value);
      row.append(header, meter);
      skillList.append(row);
    });
  }

  function uniqueTags(projects) {
    const tags = new Set(["All"]);
    projects.forEach((project) => (project.tags || []).forEach((tag) => tags.add(tag)));
    return Array.from(tags);
  }

  function renderProjectFilters(projects) {
    const filterBar = document.getElementById("project-filters");
    if (!filterBar) return;
    filterBar.replaceChildren();

    uniqueTags(projects).forEach((tag, index) => {
      const button = createElement("button", "filter-button", tag);
      button.type = "button";
      button.setAttribute("aria-pressed", index === 0 ? "true" : "false");
      button.addEventListener("click", () => {
        qsa(".filter-button", filterBar).forEach((item) => item.setAttribute("aria-pressed", "false"));
        button.setAttribute("aria-pressed", "true");
        renderProjects(tag);
      });
      filterBar.append(button);
    });
  }

  function renderProjects(activeTag = "All") {
    const grid = document.getElementById("project-grid");
    if (!grid) return;
    grid.replaceChildren();

    const projects = config.projects || [];
    const visibleProjects = activeTag === "All" ? projects : projects.filter((project) => (project.tags || []).includes(activeTag));

    visibleProjects.forEach((project) => {
      const card = createElement("article", "project-card reveal tilt-card");
      const tags = createElement("ul", "tag-list");
      (project.tags || []).forEach((tag) => tags.append(createElement("li", "", tag)));

      const title = createElement("h3", "", project.title || "Untitled Project");
      const summary = createElement("p", "", project.summary || "");
      const links = createElement("div", "project-links");

      if (project.github) {
        const github = createElement("a", "text-link", "Source");
        github.href = safeUrl(project.github);
        github.target = "_blank";
        github.rel = "noopener noreferrer";
        links.append(github);
      }

      if (project.demo) {
        const demo = createElement("a", "text-link", "Demo");
        demo.href = safeUrl(project.demo);
        demo.target = "_blank";
        demo.rel = "noopener noreferrer";
        links.append(demo);
      }

      card.append(tags, title, summary, links);
      grid.append(card);
    });

    observeReveals();
    bindTiltCards();
  }

  function renderSecurity() {
    const grid = document.getElementById("security-grid");
    if (!grid) return;
    grid.replaceChildren();

    (config.security || []).forEach((item) => {
      const card = createElement("article", "security-card reveal tilt-card");
      card.append(createElement("h3", "", item.title || "Security Control"), createElement("p", "", item.body || ""));
      grid.append(card);
    });
  }

  function renderGameList(id, items) {
    const list = document.getElementById(id);
    if (!list) return;
    list.replaceChildren();

    (items || []).forEach((item) => {
      const game = typeof item === "string" ? { title: item } : item;
      const li = createElement("li");
      li.append(createElement("span", "game-title", game.title || "Untitled game"));

      if (game.meta) {
        li.append(createElement("span", "game-meta", game.meta));
      }

      if (game.note) {
        li.append(createElement("span", "game-note", game.note));
      }

      list.append(li);
    });
  }

  function renderSteam() {
    const steam = config.steam || {};
    setText("steam-summary", steam.summary || "");

    const profileLink = document.getElementById("steam-profile-link");
    if (profileLink && steam.profileUrl) {
      profileLink.href = safeUrl(steam.profileUrl);
      profileLink.hidden = false;
      profileLink.classList.add("steam-profile-link");
    }

    renderGameList("steam-current", steam.currentlyPlaying);
    renderGameList("steam-wishlist", steam.wishlist);
    renderGameList("steam-most-played", steam.mostPlayed);
    renderGameList("steam-achievements", steam.achievements);
  }

  function renderContact() {
    const profile = config.profile || {};
    const actions = document.getElementById("contact-actions");
    if (!actions) return;
    actions.replaceChildren();

    const links = [
      { label: "Email", href: `mailto:${profile.email || ""}` },
      { label: "GitHub", href: githubProfileUrl(profile.githubUsername || "") },
      { label: "Discord", href: profile.discordUrl },
      { label: "LinkedIn", href: profile.linkedinUrl },
      { label: "Resume", href: profile.resumeUrl }
    ].filter((item) => item.href && item.href !== "mailto:" && item.href !== "#");

    links.forEach((item, index) => {
      const link = createElement("a", index === 0 ? "button primary" : "button", item.label);
      link.href = safeUrl(item.href);
      if (!String(item.href).startsWith("mailto:")) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      actions.append(link);
    });
  }

  function formatDate(value) {
    try {
      return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(new Date(value));
    } catch (error) {
      return "Recent";
    }
  }

  async function loadGitHubRepos() {
    const profile = config.profile || {};
    const username = profile.githubUsername;
    const status = document.getElementById("github-status");
    const grid = document.getElementById("repo-grid");

    if (!status || !grid || !username || username === "your-github-username") {
      return;
    }

    status.textContent = `Loading public repositories for ${username}...`;
    grid.replaceChildren();

    try {
      const response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=6`, {
        headers: { Accept: "application/vnd.github+json" },
        referrerPolicy: "no-referrer"
      });

      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}`);
      }

      const repos = await response.json();
      const visibleRepos = repos.filter((repo) => !repo.fork).slice(0, 6);

      status.textContent = `Showing recently updated public repositories from ${username}.`;
      visibleRepos.forEach((repo) => {
        const card = createElement("article", "repo-card reveal tilt-card");
        const title = createElement("h3");
        const link = createElement("a", "", repo.name || "Repository");
        link.href = safeUrl(repo.html_url);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        title.append(link);

        const description = createElement("p", "", repo.description || "Public repository");
        const meta = createElement("div", "repo-meta");
        meta.append(
          createElement("span", "", repo.language || "Code"),
          createElement("span", "", `${Number(repo.stargazers_count || 0)} stars`),
          createElement("span", "", `Updated ${formatDate(repo.updated_at)}`)
        );

        card.append(title, description, meta);
        grid.append(card);
      });

      if (!visibleRepos.length) {
        status.textContent = `No non-fork public repositories found for ${username}.`;
      }
    } catch (error) {
      status.textContent = "GitHub repositories could not be loaded right now.";
    }

    observeReveals();
    bindTiltCards();
  }

  function observeReveals() {
    const reveals = qsa(".reveal:not(.is-visible)");
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      reveals.forEach((item) => item.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, activeObserver) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            activeObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16 }
    );

    reveals.forEach((item) => observer.observe(item));
  }

  function bindTiltCards() {
    qsa(".tilt-card").forEach((card) => {
      card.dataset.tiltBound = "true";
    });
  }

  function bindTypewriter() {
    const target = document.getElementById("typewriter-role");
    const cursor = qs(".type-cursor");
    const profile = config.profile || {};
    const phrases = (profile.typewriterRoles || []).filter(Boolean);

    if (!target || !phrases.length) {
      return;
    }

    if (prefersReducedMotion) {
      target.textContent = phrases[0];
      if (cursor) {
        cursor.hidden = true;
      }
      return;
    }

    let phraseIndex = 0;
    let characterIndex = 0;
    let deleting = false;

    function tick() {
      const phrase = phrases[phraseIndex];
      target.textContent = phrase.slice(0, characterIndex);

      if (!deleting && characterIndex < phrase.length) {
        characterIndex += 1;
        window.setTimeout(tick, 72);
        return;
      }

      if (!deleting && characterIndex === phrase.length) {
        deleting = true;
        window.setTimeout(tick, 1200);
        return;
      }

      if (deleting && characterIndex > 0) {
        characterIndex -= 1;
        window.setTimeout(tick, 38);
        return;
      }

      deleting = false;
      phraseIndex = (phraseIndex + 1) % phrases.length;
      window.setTimeout(tick, 280);
    }

    tick();
  }

  function bindNavigation() {
    const nav = document.getElementById("site-nav");
    const toggle = document.getElementById("nav-toggle");
    const header = qs(".site-header");

    if (toggle && nav) {
      toggle.addEventListener("click", () => {
        const isOpen = nav.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", String(isOpen));
      });

      qsa("a", nav).forEach((link) => {
        link.addEventListener("click", () => {
          setActiveNav(link.getAttribute("href"));
          nav.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
        });
      });
    }

    const updateHeader = () => {
      if (header) {
        header.dataset.elevated = String(window.scrollY > 12);
      }
    };

    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
  }

  function setActiveNav(hash) {
    if (!hash) return;
    qsa(".site-nav a").forEach((link) => {
      link.setAttribute("aria-current", String(link.getAttribute("href") === hash));
    });
  }

  function bindActiveNav() {
    const links = qsa(".site-nav a");
    const sections = links.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);

    if (!("IntersectionObserver" in window)) return;

    if (window.location.hash) {
      setActiveNav(window.location.hash);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) return;
        setActiveNav(`#${visible.target.id}`);
      },
      { rootMargin: "-28% 0px -48% 0px", threshold: [0.08, 0.22, 0.5] }
    );

    sections.forEach((section) => observer.observe(section));
  }

  function bindTheme() {
    const toggle = document.getElementById("theme-toggle");
    const label = document.getElementById("theme-toggle-text");
    const savedTheme = localStorage.getItem("portfolio-theme");
    const initialTheme = savedTheme || "dark";

    root.dataset.theme = initialTheme;
    updateThemeToggle(initialTheme);

    if (!toggle) return;
    toggle.addEventListener("click", () => {
      const nextTheme = root.dataset.theme === "light" ? "dark" : "light";
      root.dataset.theme = nextTheme;
      localStorage.setItem("portfolio-theme", nextTheme);
      updateThemeToggle(nextTheme);
    });

    function updateThemeToggle(theme) {
      const isDark = theme === "dark";
      if (toggle) {
        toggle.setAttribute("aria-pressed", String(isDark));
        toggle.setAttribute("aria-label", isDark ? "Turn off dark mode" : "Turn on dark mode");
      }
      if (label) {
        label.textContent = isDark ? "Dark" : "Light";
      }
    }
  }

  function startSignalCanvas() {
    const canvas = document.getElementById("signal-canvas");
    if (!canvas || prefersReducedMotion) return;

    const context = canvas.getContext("2d");
    const pointer = { x: 0, y: 0, active: false };
    let width = 0;
    let height = 0;
    let particles = [];

    function resize() {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const count = Math.min(90, Math.max(36, Math.floor((width * height) / 18000)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.42,
        vy: (Math.random() - 0.5) * 0.42,
        radius: 1 + Math.random() * 1.8
      }));
    }

    function color(name) {
      return getComputedStyle(root).getPropertyValue(name).trim();
    }

    function draw() {
      context.clearRect(0, 0, width, height);
      const accent = color("--accent") || "#54d6be";
      const accentTwo = color("--accent-2") || "#ffbd59";

      particles.forEach((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < -10) particle.x = width + 10;
        if (particle.x > width + 10) particle.x = -10;
        if (particle.y < -10) particle.y = height + 10;
        if (particle.y > height + 10) particle.y = -10;

        context.beginPath();
        context.fillStyle = accent;
        context.globalAlpha = 0.56;
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
      });

      for (let index = 0; index < particles.length; index += 1) {
        for (let next = index + 1; next < particles.length; next += 1) {
          const a = particles[index];
          const b = particles[next];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          if (distance < 118) {
            context.beginPath();
            context.strokeStyle = accent;
            context.globalAlpha = (1 - distance / 118) * 0.18;
            context.moveTo(a.x, a.y);
            context.lineTo(b.x, b.y);
            context.stroke();
          }
        }

        if (pointer.active) {
          const particle = particles[index];
          const distance = Math.hypot(particle.x - pointer.x, particle.y - pointer.y);
          if (distance < 180) {
            context.beginPath();
            context.strokeStyle = accentTwo;
            context.globalAlpha = (1 - distance / 180) * 0.32;
            context.moveTo(particle.x, particle.y);
            context.lineTo(pointer.x, pointer.y);
            context.stroke();
          }
        }
      }

      context.globalAlpha = 1;
      requestAnimationFrame(draw);
    }

    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
    }, { passive: true });
    window.addEventListener("pointerleave", () => {
      pointer.active = false;
    });

    resize();
    draw();
  }

  function init() {
    applyProfile();
    renderHighlights();
    renderAbout();
    renderProjectFilters(config.projects || []);
    renderProjects();
    renderSteam();
    renderSecurity();
    renderContact();
    bindNavigation();
    bindActiveNav();
    bindTheme();
    bindTypewriter();
    observeReveals();
    bindTiltCards();
    startSignalCanvas();
    loadGitHubRepos();
  }

  init();
})();
