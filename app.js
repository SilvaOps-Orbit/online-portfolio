(function () {
  "use strict";

  const config = window.PORTFOLIO_CONFIG || {};
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const cycleTimers = new Map();
  const dataRefreshMs = 60000;
  const spotifyDataRefreshMs = 5000;
  let bootQuoteTimer = 0;
  let bootStepTimers = [];
  let spotifyProgressTimer = 0;
  let spotifyFactTimers = [];
  let marketSignalTimer = 0;
  let latestDynamicData = { steam: null, spotify: null, market: null, news: null };

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

  function setImage(id, src, alt) {
    const element = document.getElementById(id);
    if (!element || typeof src !== "string" || !src.trim()) {
      return;
    }

    try {
      const normalizedSrc = src.trim().replace(/^http:\/\//i, "https://");
      const parsed = new URL(normalizedSrc);
      if (parsed.protocol !== "https:") {
        return;
      }
      element.src = parsed.href;
      if (alt) {
        element.alt = alt;
      }
    } catch (error) {
      return;
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
    setText("brand-label", profile.alias || profile.name || "Portfolio");
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
    setText("footer-year", String(new Date().getFullYear()));

    setLink("github-profile-link", githubProfileUrl(username));
    setLink("email-link", `mailto:${profile.email || ""}`);

    const footerResume = document.getElementById("footer-resume-link");
    if (footerResume) {
      if (profile.resumeUrl) {
        footerResume.href = safeUrl(profile.resumeUrl);
        footerResume.hidden = false;
        footerResume.setAttribute("download", "");
      } else {
        footerResume.hidden = true;
      }
    }
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
    const featureGrid = document.getElementById("nerd-feature-grid");

    renderSecuritySnapshot();
    renderInfoCards(grid, config.security || [], "Security Control");
    renderInfoCards(featureGrid, config.nerdFeatures || [], "Build Feature");
  }

  function renderSecuritySnapshot() {
    const target = document.getElementById("security-score");
    if (!target) return;

    const controls = (config.security || []).filter(Boolean);
    const snapshot = config.securitySnapshot || {};
    const activeCount = controls.length;
    const featuredControls = controls.slice(0, 6);

    target.replaceChildren();
    const score = createElement("div", "security-score-meter");
    score.append(
      createElement("span", "security-score-value", `${activeCount}/${activeCount}`),
      createElement("span", "security-score-label", "controls active")
    );

    const copy = createElement("div", "security-score-copy");
    copy.append(
      createElement("span", "security-score-kicker", snapshot.label || "Site Hardening Snapshot"),
      createElement("h4", "", snapshot.posture || "Strong static-site posture"),
      createElement("p", "", snapshot.summary || "Security controls are rendered from the same config that powers the detailed cards below.")
    );

    const chips = createElement("div", "security-score-chips");
    featuredControls.forEach((control) => {
      chips.append(createElement("span", "", control.title || "Security control"));
    });
    copy.append(chips);
    target.append(score, copy);
  }

  function renderInfoCards(grid, items, fallbackTitle) {
    if (!grid) return;
    grid.replaceChildren();

    items.forEach((item) => {
      const card = createElement("article", "security-card reveal tilt-card");
      card.append(createElement("h3", "", item.title || fallbackTitle), createElement("p", "", item.body || ""));

      if (item.why) {
        card.append(createElement("p", "card-why", `Why: ${item.why}`));
      }

      const docs = Array.isArray(item.docs) ? item.docs : [];
      if (docs.length) {
        const links = createElement("div", "card-doc-links");
        docs.forEach((doc) => {
          if (!doc?.url) return;
          const link = createElement("a", "doc-link", doc.label || "Docs");
          link.href = safeUrl(doc.url);
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          links.append(link);
        });
        card.append(links);
      }

      grid.append(card);
    });
  }

  function mergeSteamData(fallback, live) {
    const result = { ...(fallback || {}), ...(live || {}) };
    result.profile = { ...((fallback || {}).profile || {}), ...((live || {}).profile || {}) };
    result.accountValue = { ...((fallback || {}).accountValue || {}), ...((live || {}).accountValue || {}) };

    if ((fallback || {}).accountValue?.manual) {
      result.accountValue = (fallback || {}).accountValue;
    }

    ["currentlyPlaying", "mostPlayed", "achievements", "completedGames", "storeHighlights", "preorderWatch", "stats"].forEach((key) => {
      if (Array.isArray((live || {})[key]) && live[key].length) {
        result[key] = live[key];
      } else if (Array.isArray((fallback || {})[key])) {
        result[key] = fallback[key];
      }
    });

    return result;
  }

  function renderStats(stats) {
    const grid = document.getElementById("steam-stats");
    if (!grid) return;
    grid.replaceChildren();

    (stats || []).forEach((item) => {
      const stat = createElement("div", "steam-stat");
      stat.append(createElement("span", "steam-stat-value", String(item.value || "TBC")));
      stat.append(createElement("span", "steam-stat-label", String(item.label || "Steam stat")));
      if (item.note) {
        stat.append(createElement("span", "steam-stat-note", String(item.note)));
      }
      grid.append(stat);
    });
  }

  function renderStoreTicker(id, items) {
    const track = document.getElementById(id);
    if (!track) return;
    track.replaceChildren();

    const highlights = (Array.isArray(items) ? items : []).filter((item) => item && item.title);
    if (!highlights.length) {
      const empty = createElement("span", "store-deal muted", "Steam store feed pending");
      track.append(empty);
      return;
    }

    const repeats = Math.max(1, Math.ceil(6 / highlights.length));
    const sequence = Array.from({ length: repeats }, () => highlights).flat();
    const tickerItems = [...sequence, ...sequence];
    tickerItems.forEach((item, index) => {
      const isDuplicate = index >= sequence.length;
      const deal = createElement(item.url ? "a" : "span", "store-deal");
      if (item.url) {
        deal.href = safeUrl(item.url);
        deal.target = "_blank";
        deal.rel = "noopener noreferrer";
      }

      if (isDuplicate) {
        deal.setAttribute("aria-hidden", "true");
        deal.tabIndex = -1;
      }

      deal.append(createElement("span", "store-deal-tag", item.tag || item.category || "Steam"));
      deal.append(createElement("span", "store-deal-title", item.title || "Steam game"));
      deal.append(createElement("span", "store-deal-price", item.price || "Price TBA"));

      if (item.discount) {
        deal.append(createElement("span", "store-deal-discount", `${item.discount}% off`));
      }

      track.append(deal);
    });
  }

  function shuffleItems(items) {
    const shuffled = [...(Array.isArray(items) ? items : [])];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  }

  function stripMarkup(value) {
    let depth = 0;
    let output = "";

    for (const char of String(value || "")) {
      if (char === "<") {
        depth += 1;
        output += " ";
        continue;
      }

      if (char === ">") {
        if (depth > 0) {
          depth -= 1;
        }
        output += " ";
        continue;
      }

      if (depth === 0) {
        output += char;
      }
    }

    return output;
  }

  function decodeVisibleEntities(value) {
    const htmlEntityText = {
      nbsp: " ",
      amp: "&",
      quot: "\"",
      apos: "'",
      "#39": "'",
      lt: " ",
      gt: " "
    };

    return String(value || "").replace(/&(?:nbsp|amp|quot|apos|#39|lt|gt);/gi, (entity) => {
      const name = entity.slice(1, -1).toLowerCase();
      return htmlEntityText[name] || " ";
    });
  }

  function cleanText(value) {
    return decodeVisibleEntities(stripMarkup(value))
      .replace(/\s+/g, " ")
      .trim();
  }

  function stripPriceText(value) {
    return cleanText(value)
      .replace(/(?:\b(?:AUD|USD|CAD|NZD|EUR|GBP)\b\s*)?(?:A\$|AU\$|NZ\$|US\$|CA\$|\$|€|£)\s*\d[\d,.]*(?:\.\d{2})?(?:\s*\b(?:AUD|USD|CAD|NZD|EUR|GBP)\b)?/gi, " ")
      .replace(/\bPrice\s*TBA\b/gi, " ")
      .replace(/\s*[-–—:|]\s*$/g, " ")
      .replace(/^\s*[-–—:|]\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function editionChipText(edition) {
    const rawLabel = typeof edition === "string" ? edition : edition?.label || edition?.name || "";
    const price = typeof edition === "string" ? "" : edition?.price || "";
    const label = stripPriceText(rawLabel).replace(/^(buy|purchase)\s+/i, "").trim();

    if (price) {
      return `${label || "Edition"}: ${price}`;
    }

    return label || rawLabel || "Edition";
  }

  function appendGameItem(list, item, index) {
    const game = typeof item === "string" ? { title: item } : item || {};
    const li = createElement("li");
    li.className = game.image ? "game-item has-art" : "game-item";
    const body = createElement("div", "game-body");
    const title = game.url ? createElement("a", "game-title", game.title || "Untitled game") : createElement("span", "game-title", game.title || "Untitled game");

    if (Number.isInteger(index)) {
      li.style.setProperty("--item-index", String(index));
    }

    if (game.url) {
      title.href = safeUrl(game.url);
      title.target = "_blank";
      title.rel = "noopener noreferrer";
    }

    if (game.image) {
      const image = createElement("img", "game-art");
      setImageElement(image, game.image, `${game.title || "Steam game"} artwork`);
      li.append(image);
    }

    body.append(title);

    if (game.meta) {
      body.append(createElement("span", "game-meta", game.meta));
    }

    if (game.price || game.discount || game.originalPrice) {
      const priceRow = createElement("span", "game-price-row");
      priceRow.append(createElement("span", "game-price", game.price || "Price TBA"));

      if (game.originalPrice && game.originalPrice !== game.price) {
        priceRow.append(createElement("span", "game-original-price", game.originalPrice));
      }

      if (game.discount) {
        priceRow.append(createElement("span", "game-discount", `${game.discount}% off`));
      }

      body.append(priceRow);
    }

    if (game.note) {
      body.append(createElement("span", "game-note", game.note));
    }

    if (Array.isArray(game.editions) && game.editions.length) {
      const editions = createElement("span", "game-editions");
      game.editions.slice(0, 3).forEach((edition) => {
        editions.append(createElement("span", "edition-chip", editionChipText(edition)));
      });
      body.append(editions);
    }

    li.append(body);
    list.append(li);
    return li;
  }

  function renderGameList(id, items) {
    const list = document.getElementById(id);
    if (!list) return;
    clearCycle(id);
    list.classList.remove("cycle-list", "is-cycling", "is-swapping");
    list.replaceChildren();

    (items || []).forEach((item) => appendGameItem(list, item));
  }

  function clearCycle(id) {
    if (cycleTimers.has(id)) {
      window.clearInterval(cycleTimers.get(id));
      cycleTimers.delete(id);
    }
  }

  function renderCycleList(id, items, label, pageSizeValue = 6) {
    const list = document.getElementById(id);
    if (!list) return;

    clearCycle(id);
    list.classList.add("cycle-list");
    list.classList.remove("is-swapping");
    list.replaceChildren();

    const games = (Array.isArray(items) ? items : []).filter(Boolean);
    const heading = list.closest(".steam-card, .spotify-card")?.querySelector("h3");

    if (!games.length) {
      list.classList.remove("is-cycling");
      if (heading) {
        heading.textContent = label;
      }
      return;
    }

    const pageSize = Math.min(pageSizeValue, games.length);
    let startIndex = 0;
    list.classList.toggle("is-cycling", games.length > pageSize);

    function updateHeading() {
      if (!heading) return;
      if (games.length <= pageSize) {
        heading.textContent = `${label} (${games.length})`;
        return;
      }

      const endIndex = Math.min(startIndex + pageSize, games.length);
      heading.textContent = `${label} (${startIndex + 1}-${endIndex} of ${games.length})`;
    }

    function visibleGames() {
      if (games.length <= pageSize) {
        return games;
      }

      return Array.from({ length: pageSize }, (_, offset) => games[(startIndex + offset) % games.length]);
    }

    function renderWindow() {
      list.replaceChildren();
      visibleGames().forEach((item, index) => appendGameItem(list, item, index));
      updateHeading();
      window.requestAnimationFrame(() => list.classList.remove("is-swapping"));
    }

    renderWindow();

    if (prefersReducedMotion || games.length <= pageSize) {
      return;
    }

    const timer = window.setInterval(() => {
      list.classList.add("is-swapping");
      window.setTimeout(() => {
        startIndex = (startIndex + pageSize) % games.length;
        renderWindow();
      }, 260);
    }, 4800);
    cycleTimers.set(id, timer);
  }

  function setImageElement(element, src, alt) {
    if (!element || typeof src !== "string" || !src.trim()) {
      return;
    }

    try {
      const normalizedSrc = src.trim().replace(/^http:\/\//i, "https://");
      const parsed = new URL(normalizedSrc);
      if (parsed.protocol !== "https:") {
        return;
      }
      element.src = parsed.href;
      element.alt = alt || "";
      element.loading = "lazy";
    } catch (error) {
      return;
    }
  }

  function renderSteam(steamData) {
    const steam = steamData || config.steam || {};
    setText("steam-summary", steam.summary || "");
    renderStatus("steam-status", steam);

    const profile = steam.profile || {};
    const profileCard = document.getElementById("steam-profile-card");
    if (profileCard && (profile.personaName || profile.avatarFull)) {
      profileCard.hidden = false;
    }

    setText("steam-persona", profile.personaName || "Steam Profile");
    setText("steam-updated", steam.generatedAt ? `Updated ${formatDate(steam.generatedAt)}` : "");
    setImage("steam-avatar", profile.avatarFull, `${profile.personaName || "Steam"} avatar`);

    const profileLink = document.getElementById("steam-profile-link");
    if (profileLink && steam.profileUrl) {
      profileLink.href = safeUrl(steam.profileUrl);
      profileLink.hidden = false;
    }

    const steamDbLink = document.getElementById("steamdb-link");
    if (steamDbLink && steam.steamDbUrl) {
      steamDbLink.href = safeUrl(steam.steamDbUrl);
      steamDbLink.hidden = false;
    }

    const stats = Array.isArray(steam.stats) ? [...steam.stats] : [];
    if (steam.accountValue?.value) {
      stats.push({
        label: "SteamDB Value",
        value: steam.accountValue.value,
        note: steam.accountValue.note
      });
    }
    renderStats(stats);

    renderGameList("steam-current", steam.currentlyPlaying);
    renderCycleList("steam-preorder-watch", shuffleItems(steam.preorderWatch), "Pre-Order / Top 20 Games Watch", 1);
    renderGameList("steam-most-played", steam.mostPlayed);
    renderCycleList("steam-achievements", steam.achievements, "Achievements");
    renderCycleList("steam-completed", steam.completedGames, "100% Games");
    renderStoreTicker("steam-store-ticker", steam.storeHighlights);
    observeReveals();
  }

  function dataUrl(path) {
    return `${path}?v=${Date.now()}`;
  }

  function dataKind(path) {
    return String(path || "").split("/").pop()?.replace(/\.json$/i, "") || "dynamic";
  }

  function dataCacheKey(path) {
    return `echoops:last-good:${dataKind(path)}`;
  }

  function isPlaceholderText(value) {
    return /pending|not connected|needs key|api refresh|connect market data|fallback|tbc/i.test(String(value || ""));
  }

  function isUsefulSteamItem(item) {
    if (!item || typeof item !== "object") return false;
    const title = String(item.title || item.name || "");
    return Boolean(title) && !isPlaceholderText(`${title} ${item.meta || ""} ${item.note || ""} ${item.price || ""}`);
  }

  function isUsefulMarketItem(item) {
    if (!item || typeof item !== "object") return false;
    return Boolean(item.symbol) && !isPlaceholderText(`${item.price || ""} ${item.change || ""} ${item.reason || ""}`);
  }

  function isUsefulNewsItem(item) {
    if (!item || typeof item !== "object") return false;
    return Boolean(item.title && item.url) && !isPlaceholderText(`${item.title} ${item.snippet || ""}`);
  }

  function isUsefulSpotifyData(data) {
    const current = data?.current || {};
    const currentUseful = Boolean(current.title) && !isPlaceholderText(`${current.title} ${current.meta || ""} ${current.note || ""}`);
    const playlistsUseful = Array.isArray(data?.playlists) && data.playlists.some((item) => item?.title && !isPlaceholderText(item.title));
    return currentUseful || playlistsUseful;
  }

  function hasUsefulDynamicData(path, data) {
    if (!data || typeof data !== "object") return false;
    const kind = dataKind(path);

    if (kind === "steam") {
      return ["currentlyPlaying", "mostPlayed", "achievements", "completedGames", "storeHighlights", "preorderWatch"]
        .some((key) => Array.isArray(data[key]) && data[key].some(isUsefulSteamItem));
    }

    if (kind === "spotify") {
      return isUsefulSpotifyData(data);
    }

    if (kind === "market") {
      return ["indexes", "stocks"].some((key) => Array.isArray(data[key]) && data[key].some(isUsefulMarketItem));
    }

    if (kind === "news") {
      return Array.isArray(data.items) && data.items.some(isUsefulNewsItem);
    }

    return true;
  }

  function readCachedDataFile(path, liveStatus = "") {
    if (!("localStorage" in window)) return null;

    try {
      const cached = JSON.parse(window.localStorage.getItem(dataCacheKey(path)) || "null");
      if (!cached?.data || !hasUsefulDynamicData(path, cached.data)) {
        return null;
      }

      const cachedAt = cached.cachedAt || cached.data.generatedAt || new Date().toISOString();
      const kind = dataKind(path);
      return {
        ...cached.data,
        cachedSnapshot: true,
        stale: true,
        lastGoodAt: cached.data.lastGoodAt || cached.data.generatedAt || cachedAt,
        status: liveStatus
          ? `${liveStatus} Showing last saved ${kind} snapshot while GitHub refresh catches up.`
          : `Showing last saved ${kind} snapshot while GitHub refresh catches up.`
      };
    } catch (error) {
      return null;
    }
  }

  function writeCachedDataFile(path, data) {
    if (!("localStorage" in window) || !hasUsefulDynamicData(path, data)) return;

    try {
      window.localStorage.setItem(dataCacheKey(path), JSON.stringify({
        cachedAt: new Date().toISOString(),
        data
      }));
    } catch (error) {
      return;
    }
  }

  async function fetchDataFile(path, timeoutMs = 6500) {
    const controller = "AbortController" in window ? new AbortController() : null;
    const timeoutId = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : 0;

    try {
      const response = await fetch(dataUrl(path), {
        cache: "no-cache",
        referrerPolicy: "no-referrer",
        signal: controller?.signal
      });

      if (!response.ok) {
        return readCachedDataFile(path);
      }

      const data = await response.json();
      if (hasUsefulDynamicData(path, data)) {
        writeCachedDataFile(path, data);
        return data;
      }

      return readCachedDataFile(path, data?.status) || data;
    } catch (error) {
      return readCachedDataFile(path);
    } finally {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    }
  }

  async function loadSteamData(options = {}) {
    const fallback = config.steam || {};
    if (options.renderFallback !== false) {
      renderSteam(fallback);
    }

    const live = await fetchDataFile("data/steam.json");
    if (!live) {
      return fallback;
    }

    const merged = mergeSteamData(fallback, live);
    latestDynamicData.steam = merged;
    renderSteam(merged);
    renderConnections();
    return merged;
  }

  function mergeSpotifyData(fallback, live) {
    const result = { ...(fallback || {}), ...(live || {}) };
    result.profile = { ...((fallback || {}).profile || {}), ...((live || {}).profile || {}) };

    if ((live || {}).current?.title) {
      result.current = live.current;
    } else if ((live || {}).lastTrack?.title) {
      result.current = live.lastTrack;
    } else if ((fallback || {}).current?.title) {
      result.current = fallback.current;
    }

    ["playlists"].forEach((key) => {
      if (Array.isArray((live || {})[key]) && live[key].length) {
        result[key] = live[key];
      } else if (Array.isArray((fallback || {})[key])) {
        result[key] = fallback[key];
      }
    });

    return result;
  }

  function mergeMarketData(fallback, live) {
    const result = { ...(fallback || {}), ...(live || {}) };
    ["indexes", "stocks", "signals"].forEach((key) => {
      if (Array.isArray((live || {})[key]) && live[key].length) {
        result[key] = live[key];
      } else if (Array.isArray((fallback || {})[key])) {
        result[key] = fallback[key];
      }
    });
    return result;
  }

  function mergeNewsData(fallback, live) {
    const result = { ...(fallback || {}), ...(live || {}) };
    if (Array.isArray((live || {}).items) && live.items.length) {
      const liveCategories = new Set(live.items.map((item) => String(item?.category || "Other")));
      const missingFallbackRows = Array.isArray((fallback || {}).items)
        ? fallback.items.filter((item) => !liveCategories.has(String(item?.category || "Other")))
        : [];
      result.items = [...missingFallbackRows, ...live.items];
    } else if (Array.isArray((fallback || {}).items)) {
      result.items = fallback.items;
    }
    return result;
  }

  async function preloadDynamicData() {
    const fallbackSteam = config.steam || {};
    const fallbackSpotify = config.spotify || {};
    const fallbackMarket = config.market || {};
    const fallbackNews = config.news || {};
    const [liveSteam, liveSpotify, liveMarket, liveNews] = await Promise.all([
      fetchDataFile("data/steam.json"),
      fetchDataFile("data/spotify.json"),
      fetchDataFile("data/market.json"),
      fetchDataFile("data/news.json")
    ]);

    return {
      steam: liveSteam ? mergeSteamData(fallbackSteam, liveSteam) : fallbackSteam,
      spotify: liveSpotify ? mergeSpotifyData(fallbackSpotify, liveSpotify) : fallbackSpotify,
      market: liveMarket ? mergeMarketData(fallbackMarket, liveMarket) : fallbackMarket,
      news: liveNews ? mergeNewsData(fallbackNews, liveNews) : fallbackNews
    };
  }

  function fallbackDynamicData() {
    return {
      steam: config.steam || {},
      spotify: config.spotify || {},
      market: config.market || {},
      news: config.news || {}
    };
  }

  function delay(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function withTimeout(promise, timeoutMs, fallbackValue) {
    return Promise.race([
      promise,
      delay(timeoutMs).then(() => fallbackValue)
    ]);
  }

  function finishBoot() {
    const bootScreen = document.getElementById("boot-screen");
    if (bootQuoteTimer) {
      window.clearInterval(bootQuoteTimer);
      bootQuoteTimer = 0;
    }
    completeBootSteps();

    document.body.classList.remove("is-booting");
    document.body.classList.add("is-ready");

    if (bootScreen) {
      window.setTimeout(() => {
        bootScreen.hidden = true;
      }, 280);
    }
  }

  function completeBootSteps() {
    qsa(".boot-chips span").forEach((step) => step.classList.add("is-complete"));
    bootStepTimers.forEach((timer) => window.clearTimeout(timer));
    bootStepTimers = [];
  }

  function bindBootSteps() {
    const steps = qsa(".boot-chips span");
    if (!steps.length) return;

    steps.forEach((step) => step.classList.remove("is-complete"));
    const timings = prefersReducedMotion ? [0, 0, 0] : [1800, 5200, 8400];
    bootStepTimers = steps.map((step, index) =>
      window.setTimeout(() => step.classList.add("is-complete"), timings[index] || 0)
    );
  }

  function bindBootQuotes() {
    const target = document.getElementById("boot-quote");
    if (!target) return;

    const quotes = [
      "Teaching the APIs how to behave.",
      "Checking if the pixels know the password.",
      "Unlocking the portfolio vault.",
      "Politely asking the firewall to smile.",
      "Loading cool stuff with serious intent.",
      "Keeping secrets out of browser code.",
      "Preparing fallback data like a responsible adult.",
      "Dusting off the access badge.",
      "Making the loading screen earn its rent.",
      "Almost in. Pretend this is dramatic."
    ];

    let quoteIndex = Math.floor(Math.random() * quotes.length);
    target.textContent = quotes[quoteIndex];

    if (prefersReducedMotion) {
      return;
    }

    bootQuoteTimer = window.setInterval(() => {
      target.classList.add("is-swapping");
      window.setTimeout(() => {
        quoteIndex = (quoteIndex + 1) % quotes.length;
        target.textContent = quotes[quoteIndex];
        target.classList.remove("is-swapping");
      }, 180);
    }, 1500);
  }

  function scheduleDynamicDataWarmups() {
    [2000, 8000, 20000].forEach((delayMs) => {
      window.setTimeout(() => {
        loadSteamData({ renderFallback: false });
        loadSpotifyData({ renderFallback: false });
        loadMarketData({ renderFallback: false });

        if (delayMs >= 8000) {
          loadNewsData({ renderFallback: false });
        }
      }, delayMs);
    });
  }

  function renderStatus(id, data) {
    const status = document.getElementById(id);
    if (!status) return;

    const timestamp = data?.lastGoodAt || data?.generatedAt;
    if (data?.status) {
      status.textContent = timestamp
        ? `${data.status} Refreshed ${formatDateTime(timestamp)}.`
        : data.status;
      return;
    }

    if (timestamp) {
      status.textContent = `${data?.stale ? "Showing last saved values from" : "Updated"} ${formatDateTime(timestamp)}.`;
      return;
    }

    status.textContent = "";
  }

  function renderFeatureItem(id, item) {
    const target = document.getElementById(id);
    if (!target) return;
    target.replaceChildren();

    const list = createElement("ul", "game-list feature-list");
    appendGameItem(list, item || { title: "No live data yet", note: "Connect the API to fill this section." });
    target.append(list);
  }

  function formatDurationMs(value) {
    const totalSeconds = Math.max(0, Math.floor(Number(value || 0) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function currentProgress(track) {
    const durationMs = Number(track?.durationMs || 0);
    let progressMs = Number(track?.progressMs || 0);

    if (track?.isPlaying && track?.observedAt) {
      const observed = new Date(track.observedAt).getTime();
      if (Number.isFinite(observed)) {
        progressMs += Math.max(0, Date.now() - observed);
      }
    }

    return {
      durationMs,
      progressMs: durationMs ? Math.min(progressMs, durationMs) : Math.max(0, progressMs),
      percent: durationMs ? Math.min(100, Math.max(0, (progressMs / durationMs) * 100)) : 0
    };
  }

  function updateSpotifyProgress(card, track) {
    const progress = currentProgress(track);
    const fill = qs(".spotify-progress-fill", card);
    const current = qs(".spotify-progress-current", card);
    const total = qs(".spotify-progress-total", card);

    if (fill) {
      fill.style.width = `${progress.percent}%`;
    }

    if (current) {
      current.textContent = formatDurationMs(progress.progressMs);
    }

    if (total) {
      total.textContent = formatDurationMs(progress.durationMs);
    }

    const contextTime = qs(".spotify-context-time", card);
    if (contextTime && track?.context?.type === "playlist") {
      contextTime.textContent = progress.progressMs
        ? `Listening for ${formatDurationMs(progress.progressMs)}`
        : "Playlist context";
    }
  }

  function bindSpotifyProgress(card, track) {
    if (spotifyProgressTimer) {
      window.clearInterval(spotifyProgressTimer);
      spotifyProgressTimer = 0;
    }

    updateSpotifyProgress(card, track);

    if (track?.isPlaying && Number(track?.durationMs || 0) > 0) {
      spotifyProgressTimer = window.setInterval(() => updateSpotifyProgress(card, track), 1000);
    }
  }

  function clearSpotifyFactTimers() {
    spotifyFactTimers.forEach((timer) => window.clearInterval(timer));
    spotifyFactTimers = [];
  }

  function bindSpotifyFactCycle(element, facts, intervalMs) {
    const values = shuffleItems(Array.isArray(facts) ? facts.filter(Boolean) : []);
    if (!element || !values.length) return;

    let index = Math.floor(Math.random() * values.length);
    element.textContent = values[index];

    if (prefersReducedMotion || values.length === 1) {
      return;
    }

    const timer = window.setInterval(() => {
      index = (index + 1) % values.length;
      element.classList.add("is-swapping");
      window.setTimeout(() => {
        element.textContent = values[index];
        element.classList.remove("is-swapping");
      }, 180);
    }, intervalMs);

    spotifyFactTimers.push(timer);
  }

  function appendSpotifyFactTicker(parent, label, facts, intervalMs, emptyText) {
    const item = createElement("div", "spotify-fact-ticker");
    item.append(createElement("span", "spotify-fact-label", label));
    const value = createElement("span", "spotify-fact-value", emptyText);
    item.append(value);
    parent.append(item);
    bindSpotifyFactCycle(value, facts, intervalMs);
  }

  function uniqueValues(values) {
    return [...new Set((values || []).filter(Boolean))];
  }

  function appendSpotifySourceAudit(parent, track) {
    const publishedUsing = track?.publishedUsing;
    const dataSources = Array.isArray(track?.dataSources) ? track.dataSources : [];
    const crossReference = track?.enrichment?.crossReference;

    if (!publishedUsing && !dataSources.length && !crossReference?.summary) {
      return;
    }

    const audit = createElement("div", "spotify-source-audit");
    if (crossReference?.summary) {
      audit.title = crossReference.summary;
    }

    audit.append(createElement("span", "spotify-source-title", "Source mix"));
    const factSources = uniqueValues([
      ...(publishedUsing?.songFacts || []),
      ...(publishedUsing?.artistFacts || [])
    ]);

    const chips = createElement("div", "spotify-source-chips");
    [
      publishedUsing?.playback ? `Playback: ${publishedUsing.playback}` : "",
      factSources.length ? `Facts: ${factSources.join(" + ")}` : "",
      publishedUsing?.artwork ? `Art: ${publishedUsing.artwork}` : "",
      crossReference?.matchedSources?.length ? `Checked: ${crossReference.matchedSources.join(" + ")}` : ""
    ].filter(Boolean).forEach((label) => {
      chips.append(createElement("span", "spotify-source-chip is-matched", label));
    });

    dataSources.forEach((source) => {
      if (!source?.source) return;
      if ((source.status || "").toLowerCase() === "matched") return;
      const chip = createElement("span", `spotify-source-chip is-${source.status || "checked"}`, `${source.source} ${source.status || "checked"}`);
      chips.append(chip);
    });

    if (chips.children.length) {
      audit.append(chips);
    }

    if (audit.children.length) {
      parent.append(audit);
    }
  }

  function renderSpotifyNow(id, item) {
    const target = document.getElementById(id);
    if (!target) return;
    target.replaceChildren();
    clearSpotifyFactTimers();

    const track = item || { title: "No live data yet", note: "Connect Spotify to fill this section." };
    const card = createElement("article", track.image ? "spotify-now-card has-art" : "spotify-now-card");

    const player = createElement("div", "spotify-player");

    if (track.image) {
      const image = createElement("img", "spotify-now-art");
      image.loading = "lazy";
      setImageElement(image, track.image, `${track.title || "Spotify track"} artwork`);
      player.append(image);
    } else {
      const placeholder = createElement("div", "spotify-now-art spotify-now-art-placeholder", "SP");
      player.append(placeholder);
    }

    const body = createElement("div", "spotify-now-body");
    body.append(createElement("span", "spotify-now-note", track.note || "Spotify activity"));
    body.append(createElement("h3", "", track.title || "Spotify track"));
    body.append(createElement("p", "spotify-now-meta", track.meta || "Spotify artist"));

    if (track.album?.name) {
      const album = track.album.url
        ? createElement("a", "spotify-album-link", track.album.name)
        : createElement("span", "spotify-album-link", track.album.name);
      if (track.album.url) {
        album.href = safeUrl(track.album.url);
        album.target = "_blank";
        album.rel = "noopener noreferrer";
      }
      body.append(album);
    }

    if (track.context?.type === "playlist" && track.context.title) {
      const playlist = track.context.url
        ? createElement("a", "spotify-context")
        : createElement("div", "spotify-context");
      if (track.context.url) {
        playlist.href = safeUrl(track.context.url);
        playlist.target = "_blank";
        playlist.rel = "noopener noreferrer";
      }
      if (track.context.image) {
        const playlistImage = createElement("img", "spotify-context-image");
        playlistImage.loading = "lazy";
        setImageElement(playlistImage, track.context.image, `${track.context.title} playlist artwork`);
        playlist.append(playlistImage);
      }
      const playlistText = createElement("span", "spotify-context-copy");
      playlistText.append(createElement("span", "spotify-context-label", "Playlist"));
      playlistText.append(createElement("strong", "", track.context.title));
      playlistText.append(createElement("span", "spotify-context-time", "Playlist context"));
      playlist.append(playlistText);
      body.append(playlist);
    }

    if (track.url) {
      const link = createElement("a", "text-link spotify-track-link", "Open in Spotify");
      link.href = safeUrl(track.url);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      body.append(link);
    }

    if (Array.isArray(track.enrichmentLinks) && track.enrichmentLinks.length) {
      const links = createElement("div", "spotify-source-links");
      track.enrichmentLinks.slice(0, 3).forEach((sourceLink) => {
        if (!sourceLink?.url || !sourceLink?.label) return;
        const link = createElement("a", "spotify-source-link", sourceLink.label);
        link.href = safeUrl(sourceLink.url);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        links.append(link);
      });
      if (links.children.length) {
        body.append(links);
      }
    }

    appendSpotifySourceAudit(body, track);

    player.append(body);
    card.append(player);

    if (Number(track.durationMs || 0) > 0) {
      const progress = createElement("div", "spotify-progress");
      const bar = createElement("span", "spotify-progress-bar");
      bar.append(createElement("span", "spotify-progress-fill"));
      progress.append(bar);
      const times = createElement("div", "spotify-progress-times");
      times.append(createElement("span", "spotify-progress-current", "00:00"));
      times.append(createElement("span", "spotify-progress-total", formatDurationMs(track.durationMs)));
      progress.append(times);
      card.append(progress);
    }

    const facts = createElement("div", "spotify-fact-strip");
    appendSpotifyFactTicker(facts, "Artist", track.artistFacts, 5000, track.artist?.name || track.meta || "Artist details will appear here.");
    appendSpotifyFactTicker(facts, "Song", track.songFacts, 10000, track.album?.name || "Song details will appear here.");
    card.append(facts);

    target.append(card);
    bindSpotifyProgress(card, track);
  }

  function renderSpotify(spotifyData) {
    const spotify = spotifyData || config.spotify || {};
    setText("spotify-summary", spotify.summary || "");
    renderStatus("spotify-status", spotify);

    const profile = spotify.profile || {};
    const profileLink = document.getElementById("spotify-profile-link");
    if (profileLink && (profile.url || spotify.profileUrl)) {
      profileLink.href = safeUrl(profile.url || spotify.profileUrl);
      profileLink.hidden = false;
    }

    const current = spotify.current || spotify.lastTrack;
    renderSpotifyNow("spotify-now", current);
    renderCycleList("spotify-playlists", spotify.playlists, "Public Playlists", 4);
    observeReveals();
  }

  async function loadSpotifyData(options = {}) {
    const fallback = config.spotify || {};
    if (options.renderFallback !== false) {
      renderSpotify(fallback);
    }

    const live = await fetchDataFile("data/spotify.json");
    if (!live) {
      return fallback;
    }

    const merged = mergeSpotifyData(fallback, live);
    latestDynamicData.spotify = merged;
    renderSpotify(merged);
    renderConnections();
    return merged;
  }

  function marketChangeClass(value) {
    const text = String(value || "").toLowerCase();
    if (/^-|down|loss|red|risk/.test(text)) return "is-down";
    if (/^\+|up|gain|green|bull/.test(text)) return "is-up";
    return "";
  }

  function marketPointValue(point) {
    if (typeof point === "number") return point;
    if (!point || typeof point !== "object") return NaN;
    return Number(point.close ?? point.price ?? point.value ?? point.y);
  }

  function marketPointLabel(point, index) {
    if (!point || typeof point !== "object") return `Day ${index + 1}`;
    const raw = point.date || point.label || point.time || point.timestamp;
    if (!raw) return `Day ${index + 1}`;

    try {
      return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(raw));
    } catch (error) {
      return String(raw);
    }
  }

  function marketHistoryPoints(item) {
    const raw = Array.isArray(item?.history)
      ? item.history
      : Array.isArray(item?.chart)
        ? item.chart
        : [];

    return raw
      .map((point, index) => ({
        value: marketPointValue(point),
        label: marketPointLabel(point, index)
      }))
      .filter((point) => Number.isFinite(point.value));
  }

  function svgElement(tag, attributes = {}) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, String(value));
    });
    return element;
  }

  function renderMarketChart(item, featured = false) {
    const points = marketHistoryPoints(item);
    const wrap = createElement("div", `market-chart-wrap${featured ? " is-featured" : ""}`);

    if (points.length < 2) {
      wrap.classList.add("is-empty");
      wrap.textContent = "1W chart pending";
      return wrap;
    }

    const width = featured ? 640 : 320;
    const height = featured ? 220 : 112;
    const pad = featured ? 18 : 12;
    const values = points.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || Math.max(Math.abs(max) * 0.02, 1);
    const usableWidth = width - pad * 2;
    const usableHeight = height - pad * 2;
    const coordinates = points.map((point, index) => {
      const x = pad + (index / Math.max(points.length - 1, 1)) * usableWidth;
      const y = height - pad - ((point.value - min) / range) * usableHeight;
      return { ...point, x, y };
    });
    const line = coordinates.map((point, index) => `${index ? "L" : "M"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
    const floor = height - pad;
    const area = `${line} L ${coordinates.at(-1).x.toFixed(1)} ${floor.toFixed(1)} L ${coordinates[0].x.toFixed(1)} ${floor.toFixed(1)} Z`;
    const isUp = coordinates.at(-1).value >= coordinates[0].value;
    wrap.classList.add(isUp ? "is-up" : "is-down");

    const svg = svgElement("svg", {
      class: "market-chart",
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": `${item.name || item.symbol || "Market"} one week price chart`
    });
    const title = svgElement("title");
    title.textContent = `${item.name || item.symbol || "Market"} one week price chart`;
    svg.append(title);

    [0.25, 0.5, 0.75].forEach((ratio) => {
      const y = pad + ratio * usableHeight;
      svg.append(svgElement("line", {
        class: "market-chart-grid",
        x1: pad,
        x2: width - pad,
        y1: y.toFixed(1),
        y2: y.toFixed(1)
      }));
    });

    svg.append(svgElement("path", { class: "market-chart-area", d: area }));
    svg.append(svgElement("path", { class: "market-chart-line", d: line }));
    svg.append(svgElement("circle", {
      class: "market-chart-dot",
      cx: coordinates.at(-1).x.toFixed(1),
      cy: coordinates.at(-1).y.toFixed(1),
      r: featured ? 4.4 : 3.2
    }));

    const caption = createElement("div", "market-chart-caption");
    caption.append(createElement("span", "", String(item.chartLabel || "1W")));
    caption.append(createElement("span", "", `${coordinates[0].label} to ${coordinates.at(-1).label}`));
    wrap.append(svg, caption);
    return wrap;
  }

  function createMarketCard(item, options = {}) {
    const isFeaturedIndex = Boolean(options.featuredIndex);
    const card = createElement(item.url ? "a" : "article", `market-card${options.reveal === false ? "" : " reveal"}`);
    if (isFeaturedIndex) {
      card.classList.add("is-featured-index");
    }
    if (options.stockDeck) {
      card.classList.add("stock-deck-card");
      card.style.setProperty("--stock-index", String(options.index || 0));
    }
    if (item.url) {
      card.href = safeUrl(item.url);
      card.target = "_blank";
      card.rel = "noopener noreferrer";
    }

    const header = createElement("div", "market-card-header");
    const symbol = createElement("span", "market-symbol", String(item.symbol || "TBC"));
    const name = createElement("span", "market-name", String(item.name || item.sector || "Market item"));
    header.append(symbol, name);

    const priceRow = createElement("div", "market-price-row");
    priceRow.append(createElement("span", "market-price", String(item.price || "Price pending")));
    priceRow.append(createElement("span", `market-change ${marketChangeClass(item.change)}`, String(item.change || "No movement yet")));

    const signal = createElement("span", "market-signal", String(item.signal || "Watch"));
    const reason = createElement("p", "market-reason", String(item.reason || "Waiting for the next refresh."));

    card.append(header, priceRow, renderMarketChart(item, isFeaturedIndex), signal, reason);
    return card;
  }

  function setActiveStockDeck(cards, chips, index) {
    cards.forEach((card, cardIndex) => {
      const active = cardIndex === index;
      card.classList.toggle("is-active", active);
      card.setAttribute("aria-hidden", active ? "false" : "true");
      if (card.matches("a")) {
        card.tabIndex = active ? 0 : -1;
      }
    });

    chips.forEach((chip, chipIndex) => {
      chip.classList.toggle("is-active", chipIndex === index);
      chip.setAttribute("aria-pressed", chipIndex === index ? "true" : "false");
    });
  }

  function renderStockDeck(id, target, entries, emptyText) {
    target.classList.add("stock-deck");
    target.replaceChildren();

    if (!entries.length) {
      target.append(createElement("p", "muted", emptyText));
      return;
    }

    const stage = createElement("div", "stock-deck-stage");
    const controls = createElement("div", "stock-deck-controls");
    const cards = [];
    const chips = [];
    let activeIndex = 0;

    entries.forEach((item, index) => {
      const card = createMarketCard(item, { stockDeck: true, index, reveal: false });
      const chip = createElement("button", "stock-deck-chip");
      const percent = marketPercentValue(item);
      chip.type = "button";
      chip.setAttribute("aria-label", `Show ${item.symbol || item.name || "stock"} in the market deck`);
      chip.append(createElement("span", "stock-chip-symbol", String(item.symbol || "TBC")));
      chip.append(createElement("span", `stock-chip-change ${marketChangeClass(item.change)}`, Number.isFinite(percent) ? marketSignalLabel(percent) : String(item.change || "Watch")));
      chip.addEventListener("click", () => {
        activeIndex = index;
        target.classList.add("is-scanning");
        setActiveStockDeck(cards, chips, activeIndex);
        window.setTimeout(() => target.classList.remove("is-scanning"), 620);
      });

      cards.push(card);
      chips.push(chip);
      stage.append(card);
      controls.append(chip);
    });

    target.append(stage, controls);
    setActiveStockDeck(cards, chips, activeIndex);

    if (prefersReducedMotion || cards.length < 2) {
      return;
    }

    const timer = window.setInterval(() => {
      activeIndex = (activeIndex + 1) % cards.length;
      target.classList.add("is-scanning");
      setActiveStockDeck(cards, chips, activeIndex);
      window.setTimeout(() => target.classList.remove("is-scanning"), 620);
    }, 5600);
    cycleTimers.set(id, timer);
  }

  function renderMarketList(id, items, emptyText) {
    const target = document.getElementById(id);
    if (!target) return;
    clearCycle(id);
    target.classList.remove("stock-deck", "is-scanning");
    target.replaceChildren();

    const entries = (Array.isArray(items) ? items : []).filter((item) => item && item.symbol);
    if (id === "market-stocks") {
      renderStockDeck(id, target, entries, emptyText);
      return;
    }

    if (!entries.length) {
      target.append(createElement("p", "muted", emptyText));
      return;
    }

    entries.forEach((item) => {
      const isFeaturedIndex = id === "market-indexes" && /^(SPX|\^GSPC)$/i.test(String(item.symbol || ""));
      const card = createMarketCard(item, { featuredIndex: isFeaturedIndex });
      target.append(card);
    });
  }

  function newsApiDisplayLabel(item) {
    const labels = Array.isArray(item?.sourceApis) && item.sourceApis.length
      ? item.sourceApis
      : [item?.sourceApi || item?.apiSource || ""];
    const sourceName = String(item?.source || "News Feed").split("/")[0].trim();
    return labels
      .map((label) => String(label || "").trim())
      .filter(Boolean)
      .map((label) => label.toUpperCase() === "RSS" ? sourceName : label)
      .filter(Boolean)
      .join(" + ");
  }

  function newsIsBreaking(item) {
    return Boolean(item?.isBreaking) || /breaking/i.test(String(item?.category || ""));
  }

  function newsIsWar(item) {
    return Boolean(item?.isWar)
      || (Array.isArray(item?.tags) && item.tags.some((tag) => /war|conflict/i.test(String(tag))))
      || /war|conflict/i.test(String(item?.importance || ""));
  }

  function marketPercentValue(item) {
    const direct = Number(item?.changePercent ?? item?.changePercentValue);
    if (Number.isFinite(direct)) return direct;
    const text = String(item?.change || "");
    const matches = [...text.matchAll(/([+-]?\d+(?:\.\d+)?)%/g)];
    if (!matches.length) return NaN;
    return Number(matches.at(-1)[1]);
  }

  function marketSignalTone(item) {
    const tone = String(item?.tone || "").toLowerCase();
    if (tone) return tone;
    const stance = String(item?.stance || item?.signal || "").toLowerCase();
    if (/sell|risk|pressure|down|caution/.test(stance)) return "caution";
    if (/momentum|doing well|green|strength|gain/.test(stance)) return "positive";
    if (/research|buy|quality|theme/.test(stance)) return "research";
    if (/market|baseline|filter/.test(stance)) return "market";
    return "neutral";
  }

  function marketSignalLabel(percent) {
    if (!Number.isFinite(percent)) return "";
    const sign = percent > 0 ? "+" : "";
    return `${sign}${percent.toFixed(2)}% today`;
  }

  function enrichMarketSignals(signals, market = {}) {
    const baseSignals = (Array.isArray(signals) ? signals : []).filter((item) => item && item.title);
    const stocks = (Array.isArray(market.stocks) ? market.stocks : []).filter((item) => item && item.symbol);
    const indexes = (Array.isArray(market.indexes) ? market.indexes : []).filter((item) => item && item.symbol);
    const index = indexes[0];
    const indexPercent = marketPercentValue(index);
    const winners = stocks
      .map((stock) => ({ ...stock, percent: marketPercentValue(stock) }))
      .filter((stock) => Number.isFinite(stock.percent) && stock.percent > 0.75)
      .sort((a, b) => b.percent - a.percent);
    const pressure = stocks
      .map((stock) => ({ ...stock, percent: marketPercentValue(stock) }))
      .filter((stock) => Number.isFinite(stock.percent) && stock.percent < -1)
      .sort((a, b) => a.percent - b.percent);

    const dynamic = [];
    winners.slice(0, 3).forEach((stock) => {
      const supportiveMarket = Number.isFinite(indexPercent) && indexPercent >= 0;
      dynamic.push({
        stance: stock.percent >= 3 ? "Strong mover" : "Doing well",
        tone: "positive",
        symbol: stock.symbol,
        change: marketSignalLabel(stock.percent),
        title: `${stock.name || stock.symbol} is showing strength`,
        why: `${stock.name || stock.symbol} is up ${stock.percent.toFixed(2)}%. ${supportiveMarket ? "Because the broad market is also holding up, this is a cleaner momentum read." : "Because the broad market is not clearly helping, treat it as possible relative strength and check the catalyst."} Still research news, earnings, and valuation before acting.`,
        drivers: ["Relative strength", "Catalyst check", "Do not chase blind"]
      });
    });

    if (pressure.length) {
      const stock = pressure[0];
      dynamic.push({
        stance: "Risk check",
        tone: "caution",
        symbol: stock.symbol,
        change: marketSignalLabel(stock.percent),
        title: `${stock.name || stock.symbol} is under pressure`,
        why: `${stock.name || stock.symbol} is down ${Math.abs(stock.percent).toFixed(2)}%. Check whether the drop is company-specific, sector-wide, or just broad market weakness before calling it a discount.`,
        drivers: ["News scan", "Support levels", "Position sizing"]
      });
    }

    if (index && Number.isFinite(indexPercent)) {
      dynamic.push({
        stance: indexPercent >= 0 ? "Market support" : "Market drag",
        tone: indexPercent >= 0 ? "market" : "caution",
        symbol: index.symbol,
        change: marketSignalLabel(indexPercent),
        title: indexPercent >= 0 ? "Broad market is helping the watchlist" : "Broad market is working against the watchlist",
        why: `${index.name || index.symbol} is ${indexPercent >= 0 ? "positive" : "negative"} today. Individual stock signals are stronger when they line up with the wider market, and more suspicious when they fight it.`,
        drivers: ["S&P 500 trend", "Market breadth", "Rate expectations"]
      });
    }

    const seen = new Set();
    return [...dynamic, ...baseSignals].filter((item) => {
      const key = `${item.symbol || ""}|${item.title || ""}|${item.stance || ""}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 9);
  }

  function setActiveMarketSignal(cards, dots, index) {
    cards.forEach((card, cardIndex) => {
      const active = cardIndex === index;
      card.classList.toggle("is-active", active);
      card.setAttribute("aria-hidden", active ? "false" : "true");
    });
    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === index);
      dot.setAttribute("aria-pressed", dotIndex === index ? "true" : "false");
    });
  }

  function bindMarketSignalRotation(cards, dots) {
    if (marketSignalTimer) {
      window.clearInterval(marketSignalTimer);
      marketSignalTimer = 0;
    }
    if (!cards.length) return;

    let index = 0;
    setActiveMarketSignal(cards, dots, index);
    if (prefersReducedMotion || cards.length < 2) return;

    marketSignalTimer = window.setInterval(() => {
      index = (index + 1) % cards.length;
      setActiveMarketSignal(cards, dots, index);
    }, 6200);

    dots.forEach((dot, dotIndex) => {
      dot.addEventListener("click", () => {
        index = dotIndex;
        setActiveMarketSignal(cards, dots, index);
      });
    });
  }

  function renderMarketSignals(id, signals, market = {}) {
    const target = document.getElementById(id);
    if (!target) return;
    if (marketSignalTimer) {
      window.clearInterval(marketSignalTimer);
      marketSignalTimer = 0;
    }
    target.replaceChildren();
    target.classList.add("signal-rotor");

    const entries = enrichMarketSignals(signals, market);
    if (!entries.length) {
      target.append(createElement("p", "muted", "AI signal feed pending."));
      return;
    }

    const stage = createElement("div", "signal-rotor-stage");
    const controls = createElement("div", "signal-rotor-controls");
    const cards = [];
    const dots = [];

    entries.forEach((item, index) => {
      const card = createElement("article", "market-signal-card");
      card.classList.add(`signal-tone-${marketSignalTone(item)}`);
      card.style.setProperty("--signal-index", index);
      card.append(createElement("span", "signal-stance", String(item.stance || "Watch")));
      if (item.change) {
        card.append(createElement("span", "signal-change-chip", String(item.change)));
      }
      card.append(createElement("h4", "", `${item.symbol ? `${item.symbol}: ` : ""}${item.title}`));
      card.append(createElement("p", "", String(item.why || "Waiting for the next analysis refresh.")));

      const drivers = Array.isArray(item.drivers) ? item.drivers.filter(Boolean) : [];
      if (drivers.length) {
        const list = createElement("ul", "signal-drivers");
        drivers.slice(0, 5).forEach((driver) => list.append(createElement("li", "", String(driver))));
        card.append(list);
      }

      const dot = createElement("button", "signal-rotor-dot");
      dot.type = "button";
      dot.setAttribute("aria-label", `Show market signal ${index + 1}`);
      controls.append(dot);
      cards.push(card);
      dots.push(dot);
      stage.append(card);
    });
    target.append(stage, controls);
    bindMarketSignalRotation(cards, dots);
  }

  function renderMarket(marketData) {
    const market = marketData || config.market || {};
    setText("market-summary", market.summary || "");
    renderStatus("market-status", market);
    const disclaimer = document.getElementById("market-disclaimer");
    if (disclaimer) {
      disclaimer.textContent = market.disclaimer || "Educational research only, not financial advice.";
    }

    renderMarketList("market-indexes", market.indexes, "S&P 500 data pending.");
    renderMarketList("market-stocks", market.stocks, "Gaming and tech stock data pending.");
    renderMarketSignals("market-signals", market.signals, market);
    observeReveals();
  }

  function renderNews(newsData) {
    const news = newsData || config.news || {};
    const target = document.getElementById("news-feed");
    setText("news-summary", news.summary || "");
    renderStatus("news-status", news);
    if (!target) return;
    target.replaceChildren();

    const items = (Array.isArray(news.items) ? news.items : []).filter((item) => item && item.title);
    if (!items.length) {
      target.append(createElement("p", "muted", "News feed pending."));
      return;
    }

    const preferredRows = ["Breaking Worldwide", "Gaming", "Finance", "Australia"];
    const grouped = items.reduce((groups, item) => {
      const category = String(item.category || "Other");
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category).push(item);
      return groups;
    }, new Map());
    const rowNames = [
      ...preferredRows.filter((name) => grouped.has(name)),
      ...Array.from(grouped.keys()).filter((name) => !preferredRows.includes(name))
    ];

    function createNewsCard(item, isDuplicate = false) {
      const card = createElement("article", "news-card");
      const isBreaking = newsIsBreaking(item);
      const isWar = newsIsWar(item);
      if (isBreaking) card.classList.add("is-breaking-news");
      if (isWar) card.classList.add("is-war-news");
      if (isDuplicate) {
        card.setAttribute("aria-hidden", "true");
      }
      const meta = createElement("div", "news-meta");
      const category = createElement("span", `news-category${isBreaking ? " news-breaking-tag" : ""}`, isBreaking ? "Breaking News" : String(item.category || "News"));
      const importance = createElement("span", "news-importance", String(item.importance || "Important"));
      meta.append(category, importance);
      if (isBreaking && item.affectedRegion) {
        meta.append(createElement("span", "news-region-tag", `Affects: ${item.affectedRegion}`));
      }
      if (isWar) {
        meta.append(createElement("span", "news-war-tag", "War / conflict"));
      }
      const apiLabel = newsApiDisplayLabel(item);
      if (apiLabel) {
        const regionalLabel = item.regionalScope === "Australia" ? `${apiLabel} - AU` : apiLabel;
        meta.append(createElement("span", "news-api-source", String(regionalLabel)));
      }

      card.append(meta);
      const imageUrl = safeUrl(item.image || "");
      if (imageUrl !== "#") {
        const image = createElement("img", "news-image");
        image.src = imageUrl;
        image.alt = item.title ? `${item.title} image` : "";
        image.loading = "lazy";
        image.referrerPolicy = "no-referrer";
        image.addEventListener("error", () => image.remove());
        card.append(image);
      }
      card.append(createElement("h3", "", String(item.title || "News update")));
      card.append(createElement("p", "news-snippet", String(item.snippet || "Summary pending.")));
      if (item.why) {
        card.append(createElement("p", "news-why", `Why it matters: ${item.why}`));
      }

      const footer = createElement("div", "news-footer");
      footer.append(createElement("span", "news-source", String(item.source || "Source pending")));
      if (item.url) {
        const link = createElement("a", "text-link", "Read more");
        link.href = safeUrl(item.url);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        footer.append(link);
      }
      card.append(footer);
      return card;
    }

    rowNames.forEach((name) => {
      const rowItems = grouped.get(name) || [];
      const row = createElement("section", "news-row reveal");
      if (/breaking/i.test(name)) {
        row.classList.add("is-breaking-row");
      }
      row.setAttribute("aria-label", `${name} news`);
      const heading = createElement("div", "news-row-heading");
      heading.append(createElement("span", "news-row-label", name));
      heading.append(createElement("span", "news-row-count", `${rowItems.length} ${/breaking/i.test(name) ? "live alerts" : "important articles"}`));
      row.append(heading);

      const viewport = createElement("div", "news-marquee");
      const track = createElement("div", "news-track");
      const visibleItems = rowItems.slice(0, 12);
      const repeatedItems = visibleItems.length < 4 ? [...visibleItems, ...visibleItems, ...visibleItems] : visibleItems;
      repeatedItems.forEach((item) => track.append(createNewsCard(item)));
      repeatedItems.forEach((item) => track.append(createNewsCard(item, true)));
      viewport.append(track);
      row.append(viewport);
      target.append(row);
    });
    observeReveals();
  }

  async function loadMarketData(options = {}) {
    const fallback = config.market || {};
    if (options.renderFallback !== false) {
      renderMarket(fallback);
    }

    const live = await fetchDataFile("data/market.json");
    const merged = live ? mergeMarketData(fallback, live) : fallback;
    latestDynamicData.market = merged;
    renderMarket(merged);
    return merged;
  }

  async function loadNewsData(options = {}) {
    const fallback = config.news || {};
    if (options.renderFallback !== false) {
      renderNews(fallback);
    }

    const live = await fetchDataFile("data/news.json");
    const merged = live ? mergeNewsData(fallback, live) : fallback;
    latestDynamicData.news = merged;
    renderNews(merged);
    return merged;
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
      if (item.label === "Resume") {
        link.setAttribute("download", "");
      }
      actions.append(link);
    });
  }

  function findStatValue(stats, labels) {
    const normalizedLabels = labels.map((label) => label.toLowerCase());
    const match = (stats || []).find((item) => {
      const label = String(item?.label || "").toLowerCase();
      return normalizedLabels.some((needle) => label.includes(needle));
    });
    const value = String(match?.value || "").trim();
    return /connect api|needs key|pending/i.test(value) ? "" : value;
  }

  function withGameLabel(value) {
    if (!value) return "";
    return /game/i.test(value) ? value : `${value} Games`;
  }

  const connectionIconPaths = {
    discord:
      "M20.32 4.37A19.79 19.79 0 0 0 15.36 2.8a.07.07 0 0 0-.08.04c-.21.38-.44.88-.6 1.27a18.27 18.27 0 0 0-5.36 0c-.16-.4-.4-.89-.61-1.27a.07.07 0 0 0-.08-.04 19.74 19.74 0 0 0-4.96 1.57.06.06 0 0 0-.03.02C.54 9.04-.32 13.58.1 18.06c0 .02.01.05.03.06a19.9 19.9 0 0 0 6.08 3.07.08.08 0 0 0 .08-.03c.47-.64.89-1.31 1.25-2.02a.08.08 0 0 0-.04-.1 13.1 13.1 0 0 1-1.9-.91.08.08 0 0 1-.01-.13c.13-.1.26-.2.39-.31a.07.07 0 0 1 .08-.01c3.99 1.82 8.31 1.82 12.25 0a.07.07 0 0 1 .08.01c.13.11.26.21.39.31a.08.08 0 0 1-.01.13c-.6.35-1.24.66-1.9.91a.08.08 0 0 0-.04.1c.37.71.79 1.38 1.25 2.02a.08.08 0 0 0 .08.03 19.84 19.84 0 0 0 6.08-3.07.08.08 0 0 0 .03-.06c.5-5.18-.84-9.68-3.99-13.67a.06.06 0 0 0-.03-.02ZM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.96 2.42-2.16 2.42Zm7.96 0c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42Z",
    github:
      "M12 .5C5.65.5.5 5.65.5 12c0 5.1 3.29 9.43 7.86 10.96.58.11.79-.25.79-.56v-1.96c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.79 1.2 1.79 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.2-3.1-.12-.29-.52-1.47.11-3.05 0 0 .98-.31 3.21 1.18.93-.26 1.93-.39 2.92-.4.99 0 1.99.14 2.92.4 2.23-1.49 3.21-1.18 3.21-1.18.63 1.58.23 2.76.11 3.05.75.81 1.2 1.84 1.2 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.07.78 2.16v3.2c0 .31.21.68.8.56A11.52 11.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z",
    spotify:
      "M12 1.8A10.2 10.2 0 1 0 12 22.2 10.2 10.2 0 0 0 12 1.8Zm4.68 14.72a.78.78 0 0 1-1.08.25c-2.95-1.8-6.66-2.2-11.03-1.2a.78.78 0 1 1-.35-1.52c4.79-1.09 8.9-.62 12.21 1.4.37.23.49.7.25 1.07Zm1.25-2.78a.98.98 0 0 1-1.35.32c-3.38-2.08-8.53-2.68-12.52-1.46a.98.98 0 1 1-.57-1.87c4.56-1.38 10.24-.71 14.12 1.68.46.28.6.88.32 1.33Zm.11-2.9C14 8.43 7.36 8.2 3.5 9.38a1.17 1.17 0 1 1-.68-2.24c4.43-1.35 11.77-1.08 16.42 1.68a1.17 1.17 0 0 1-1.2 2.02Z",
    steam:
      "M12 2a10 10 0 0 0-9.72 7.7l5.37 2.2a2.84 2.84 0 0 1 1.58-.48l2.34-3.39v-.05a3.78 3.78 0 1 1 3.78 3.78h-.08l-3.33 2.38a2.84 2.84 0 1 1-5.58.74l-3.83-1.58A10 10 0 1 0 12 2Zm-2.72 13.82-1.24-.52a1.67 1.67 0 1 0 1.24-1.18l.95.4a1.05 1.05 0 1 1-.95 1.3Zm6.05-5.17a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Zm0-.56a1.64 1.64 0 1 1 0-3.28 1.64 1.64 0 0 1 0 3.28Z"
  };

  function createBrandSvg(icon, className = "connection-brand") {
    const pathData = connectionIconPaths[icon];
    if (!pathData) return null;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", className);
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    path.setAttribute("fill", "currentColor");
    svg.append(path);
    return svg;
  }

  function createConnectionIcon(icon, fallback) {
    const wrapper = createElement("span", `connection-icon is-${icon || "text"}`);
    wrapper.setAttribute("aria-hidden", "true");

    const svg = createBrandSvg(icon);
    if (svg) {
      wrapper.append(svg);
    } else {
      wrapper.textContent = fallback;
    }

    return wrapper;
  }

  function createConnectionStat(stat) {
    if (typeof stat === "string") {
      return createElement("span", "", stat);
    }

    const chip = createElement("span", stat.className || "");
    if (stat.icon) {
      const svg = createBrandSvg(stat.icon, "connection-stat-icon");
      if (svg) chip.append(svg);
    }
    chip.append(document.createTextNode(String(stat.text || "")));
    return chip;
  }

  function renderConnections(data = latestDynamicData) {
    const target = document.getElementById("connections-list");
    if (!target) return;

    const profile = config.profile || {};
    const steam = { ...(config.steam || {}), ...((data || {}).steam || {}) };
    const spotify = { ...(config.spotify || {}), ...((data || {}).spotify || {}) };
    const steamProfile = steam.profile || {};
    const spotifyProfile = spotify.profile || {};
    const discordUrl = profile.discordUrl || "#contact";
    const steamStats = Array.isArray(steam.stats) ? steam.stats : [];
    const ownedGames = withGameLabel(findStatValue(steamStats, ["owned games", "games owned", "game count"]));
    const accountValue = String(steam.accountValue?.value || "").replace(/^Account Value\s*/i, "").trim();
    const steamHandle = steamProfile.personaName || "Silva";
    const memberSince = Number(steamProfile.timeCreated || 0)
      ? `Member since ${formatDate(Number(steamProfile.timeCreated) * 1000)}`
      : "";
    const spotifyUrl = spotifyProfile.url || spotify.profileUrl || "";

    const links = [
      {
        label: profile.githubUsername || "GitHub",
        icon: "github",
        short: "GH",
        href: githubProfileUrl(profile.githubUsername || ""),
        meta: "GitHub",
        stats: []
      },
      {
        label: profile.discordUrl ? "Discord Server" : "Discord Server",
        icon: "discord",
        short: "DC",
        href: discordUrl,
        meta: profile.discordUrl ? "Community link" : "Add invite URL in portfolio.config.js",
        stats: []
      },
      {
        label: "Steam",
        icon: "steam",
        short: "ST",
        href: steam.profileUrl,
        meta: memberSince,
        stats: [
          accountValue ? { text: accountValue, className: "is-account-value" } : "",
          steamHandle ? { text: steamHandle, icon: "steam", className: "is-steam-handle" } : "",
          ownedGames
        ].filter(Boolean)
      },
      {
        label: spotifyProfile.displayName || "Alvis",
        icon: "spotify",
        short: "SP",
        href: spotifyUrl,
        meta: "Spotify",
        stats: []
      }
    ].filter((item) => item.href && item.href !== "https://github.com/");

    target.replaceChildren();
    links.forEach((item) => {
      const link = createElement("a", "connection-card");
      if (item.icon) {
        link.classList.add(`is-${item.icon}`);
      }
      link.href = safeUrl(item.href);
      link.setAttribute("aria-label", item.label);
      link.append(createConnectionIcon(item.icon, item.short));

      const copy = createElement("span", "connection-copy");
      const title = createElement("span", "connection-title");
      title.append(createElement("strong", "", item.label));
      title.append(createElement("span", "connection-arrow", String(item.href).startsWith("#") ? "↓" : "↗"));
      copy.append(title);
      if (item.meta) {
        copy.append(createElement("span", "connection-meta", item.meta));
      }
      if (item.stats.length) {
        const stats = createElement("span", "connection-stats");
        item.stats.forEach((stat) => stats.append(createConnectionStat(stat)));
        copy.append(stats);
      }
      link.append(copy);

      if (!String(item.href).startsWith("#")) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      target.append(link);
    });
  }

  function formatDate(value) {
    try {
      return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(new Date(value));
    } catch (error) {
      return "Recent";
    }
  }

  function formatDateTime(value) {
    try {
      return new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }).format(new Date(value));
    } catch (error) {
      return "recently";
    }
  }

  function isFeaturedRepo(repo) {
    const repoUrl = String(repo?.html_url || "").toLowerCase();
    const repoName = String(repo?.name || "").toLowerCase();
    return (config.projects || []).some((project) => {
      const projectUrl = String(project.github || "").toLowerCase();
      return projectUrl === repoUrl || (repoName && projectUrl.endsWith(`/${repoName}`));
    });
  }

  function appendRepoChip(parent, text, className = "") {
    if (!text) return;
    parent.append(createElement("span", className, text));
  }

  function appendRepoLink(parent, label, href) {
    if (!href) return;
    const link = createElement("a", "text-link", label);
    link.href = safeUrl(href);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    parent.append(link);
  }

  function addLanguageTotal(totals, language, value) {
    const label = language || "Other";
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return;
    totals.set(label, (totals.get(label) || 0) + amount);
  }

  function totalsToLanguageStats(totals) {
    const total = Array.from(totals.values()).reduce((sum, value) => sum + value, 0);
    return Array.from(totals.entries())
      .map(([language, value]) => ({
        language,
        value,
        percent: total ? (value / total) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);
  }

  function githubPrimaryLanguageStats(repos) {
    const totals = new Map();
    const sourceRepos = (Array.isArray(repos) ? repos : []).filter((repo) => !repo.fork);

    sourceRepos.forEach((repo) => {
      const language = repo.language || "Other";
      const weight = Math.max(Number(repo.size || 0), 1);
      addLanguageTotal(totals, language, weight);
    });

    return totalsToLanguageStats(totals);
  }

  async function loadGitHubLanguageStats(repos, headers) {
    const sourceRepos = (Array.isArray(repos) ? repos : []).filter((repo) => !repo.fork);
    const totals = new Map();

    const languageResults = await Promise.all(sourceRepos.map(async (repo) => {
      if (!repo.languages_url) return null;

      try {
        const response = await fetch(repo.languages_url, {
          headers,
          referrerPolicy: "no-referrer"
        });

        if (!response.ok) return null;
        const languages = await response.json();
        return languages && typeof languages === "object" ? { repo, languages } : null;
      } catch (error) {
        return null;
      }
    }));

    languageResults.forEach((result, index) => {
      const entries = Object.entries(result?.languages || {});
      if (entries.length) {
        entries.forEach(([language, bytes]) => addLanguageTotal(totals, language, bytes));
        return;
      }

      const repo = sourceRepos[index];
      addLanguageTotal(totals, repo?.language || "Other", Math.max(Number(repo?.size || 0), 1));
    });

    return totals.size ? totalsToLanguageStats(totals) : githubPrimaryLanguageStats(sourceRepos);
  }

  function dateKey(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function activityLevel(count, max) {
    if (!count) return 0;
    if (max <= 1) return 1;
    const ratio = count / max;
    if (ratio >= 0.76) return 4;
    if (ratio >= 0.5) return 3;
    if (ratio >= 0.25) return 2;
    return 1;
  }

  function renderGitHubLanguageMix(parent, languageStats) {
    const stats = (Array.isArray(languageStats) ? languageStats : []).slice(0, 8);
    const card = createElement("article", "github-insight-card");
    const title = createElement("div", "github-insight-heading");
    title.append(createElement("span", "repo-badge", "Language mix"));
    title.append(createElement("h3", "", "Code I keep reaching for"));
    card.append(title);

    if (!stats.length) {
      card.append(createElement("p", "github-insight-note", "No public language data returned yet."));
      parent.append(card);
      return;
    }

    const bar = createElement("div", "language-mix-bar");
    stats.forEach((item, index) => {
      const segment = createElement("span", `language-segment language-${index + 1}`);
      segment.style.width = `${Math.max(item.percent, 2).toFixed(2)}%`;
      segment.title = `${item.language}: ${item.percent.toFixed(1)}%`;
      bar.append(segment);
    });

    const list = createElement("div", "language-mix-list");
    stats.forEach((item, index) => {
      const row = createElement("div", "language-row");
      row.append(createElement("span", `language-dot language-${index + 1}`));
      row.append(createElement("span", "language-name", item.language));
      row.append(createElement("strong", "", `${item.percent.toFixed(1)}%`));
      list.append(row);
    });

    card.append(bar, list);
    card.append(createElement("p", "github-insight-note", "Based on GitHub's public languages endpoint for each non-fork repository, summed across the account."));
    parent.append(card);
  }

  function renderGitHubActivity(parent, events, username) {
    const card = createElement("article", "github-insight-card github-activity-card");
    const title = createElement("div", "github-insight-heading");
    title.append(createElement("span", "repo-badge", "Public activity"));
    title.append(createElement("h3", "", "Contribution pulse"));
    card.append(title);

    const counts = new Map();
    (Array.isArray(events) ? events : []).forEach((event) => {
      const key = dateKey(event.created_at);
      if (key) {
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - 364);
    start.setDate(start.getDate() - start.getDay());

    const days = [];
    for (let cursor = new Date(start); cursor <= today; cursor.setDate(cursor.getDate() + 1)) {
      days.push(new Date(cursor));
    }

    const max = Math.max(1, ...Array.from(counts.values()));
    const weeks = Math.ceil(days.length / 7);
    const months = createElement("div", "activity-months");
    months.style.setProperty("--github-weeks", weeks);

    let previousMonth = "";
    days.forEach((day, index) => {
      const month = day.toLocaleString(undefined, { month: "short" });
      if (month !== previousMonth && day.getDate() <= 7) {
        const label = createElement("span", "", month);
        label.style.gridColumn = String(Math.floor(index / 7) + 1);
        months.append(label);
        previousMonth = month;
      }
    });

    const grid = createElement("div", "activity-grid");
    grid.style.setProperty("--github-weeks", weeks);
    days.forEach((day, index) => {
      const key = dateKey(day);
      const count = counts.get(key) || 0;
      const cell = createElement("span", `activity-cell level-${activityLevel(count, max)}`);
      cell.style.gridColumn = String(Math.floor(index / 7) + 1);
      cell.style.gridRow = String(day.getDay() + 1);
      cell.title = `${count} public GitHub event${count === 1 ? "" : "s"} on ${day.toLocaleDateString()}`;
      cell.setAttribute("aria-label", cell.title);
      grid.append(cell);
    });

    const legend = createElement("div", "activity-legend");
    legend.append(createElement("span", "", "Less"));
    [0, 1, 2, 3, 4].forEach((level) => legend.append(createElement("span", `activity-cell level-${level}`)));
    legend.append(createElement("span", "", "More"));

    const profileLink = createElement("a", "text-link", "Open GitHub contribution graph");
    profileLink.href = githubProfileUrl(username);
    profileLink.target = "_blank";
    profileLink.rel = "noopener noreferrer";

    card.append(months, grid, legend);
    card.append(createElement("p", "github-insight-note", "Uses public GitHub events only, so private commits and older hidden activity are not requested."));
    card.append(profileLink);
    parent.append(card);
  }

  function renderGitHubInsights(container, username, repos, events, languageStats) {
    if (!container) return;
    container.replaceChildren();
    renderGitHubLanguageMix(container, languageStats);
    renderGitHubActivity(container, events, username);
  }

  async function loadGitHubRepos() {
    const profile = config.profile || {};
    const username = profile.githubUsername;
    const status = document.getElementById("github-status");
    const grid = document.getElementById("repo-grid");
    const insights = document.getElementById("github-insights");

    if (!status || !grid || !username || username === "your-github-username") {
      return;
    }

    status.textContent = `Loading public GitHub data for ${username}...`;
    grid.replaceChildren();
    if (insights) {
      insights.replaceChildren();
    }

    try {
      const headers = { Accept: "application/vnd.github+json" };
      const [response, eventsResponse] = await Promise.all([
        fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=100`, {
          headers,
          referrerPolicy: "no-referrer"
        }),
        fetch(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=100`, {
          headers,
          referrerPolicy: "no-referrer"
        }).catch(() => null)
      ]);

      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}`);
      }

      const repos = await response.json();
      const events = eventsResponse?.ok ? await eventsResponse.json() : [];
      const publicRepos = repos.filter((repo) => !repo.fork);
      const languageStats = await loadGitHubLanguageStats(publicRepos, headers);
      const visibleRepos = repos
        .filter((repo) => !repo.fork)
        .sort((a, b) => {
          if (isFeaturedRepo(a) !== isFeaturedRepo(b)) {
            return isFeaturedRepo(a) ? -1 : 1;
          }
          return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
        })
        .slice(0, 6);
      const totalStars = visibleRepos.reduce((sum, repo) => sum + Number(repo.stargazers_count || 0), 0);
      const totalForks = visibleRepos.reduce((sum, repo) => sum + Number(repo.forks_count || 0), 0);
      const latestUpdate = visibleRepos
        .map((repo) => new Date(repo.updated_at || 0).getTime())
        .filter(Number.isFinite)
        .sort((a, b) => b - a)[0];

      status.textContent = visibleRepos.length
        ? `Showing ${visibleRepos.length} displayed public repositories from ${publicRepos.length} total public non-fork repos. ${totalStars} stars, ${totalForks} forks, latest update ${formatDate(latestUpdate)}. Public GitHub API only, no token exposed.`
        : `No non-fork public repositories found for ${username}.`;

      renderGitHubInsights(insights, username, publicRepos, events, languageStats);

      visibleRepos.forEach((repo) => {
        const featured = isFeaturedRepo(repo);
        const card = createElement("article", featured ? "repo-card reveal tilt-card is-featured" : "repo-card reveal tilt-card");
        const header = createElement("div", "repo-card-header");
        const title = createElement("h3");
        const link = createElement("a", "", repo.name || "Repository");
        link.href = safeUrl(repo.html_url);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        title.append(link);
        header.append(title);
        if (featured) {
          header.append(createElement("span", "repo-badge", "Featured"));
        }

        const description = createElement("p", "repo-description", repo.description || "Public repository");
        const meta = createElement("div", "repo-meta");
        appendRepoChip(meta, repo.language || "Code", "is-language");
        appendRepoChip(meta, `${Number(repo.stargazers_count || 0)} stars`);
        appendRepoChip(meta, `${Number(repo.forks_count || 0)} forks`);
        appendRepoChip(meta, `${Number(repo.open_issues_count || 0)} open issues`);
        appendRepoChip(meta, `Updated ${formatDate(repo.updated_at)}`);
        if (repo.has_pages) appendRepoChip(meta, "GitHub Pages", "is-live");
        if (repo.archived) appendRepoChip(meta, "Archived");

        const topics = createElement("div", "repo-topics");
        (repo.topics || []).slice(0, 5).forEach((topic) => appendRepoChip(topics, topic));

        const securityNote = createElement(
          "p",
          "repo-security-note",
          "Public repo metadata only. External links open safely and private repo data is never requested."
        );

        const links = createElement("div", "repo-links");
        appendRepoLink(links, "Source", repo.html_url);
        appendRepoLink(links, "Demo", repo.homepage);
        if (repo.has_issues) {
          appendRepoLink(links, "Issues", `${repo.html_url}/issues`);
        }

        card.append(header, description, meta);
        if (topics.children.length) {
          card.append(topics);
        }
        card.append(securityNote, links);
        grid.append(card);
      });
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

  function triggerAliasEasterEgg() {
    if (document.body.classList.contains("easter-active")) return;

    document.body.classList.add("easter-active");
    const burst = createElement("div", "easter-burst");
    burst.setAttribute("aria-hidden", "true");
    if (!prefersReducedMotion) {
      Array.from({ length: 16 }, () => {
        const line = createElement("span");
        burst.append(line);
        return line;
      });
    }
    document.body.append(burst);

    const toast = createElement("div", "easter-toast");
    toast.setAttribute("role", "status");
    toast.append(
      createElement("strong", "", "EchoOps mode unlocked"),
      createElement("span", "", "Signal boost engaged. Nice find.")
    );
    document.body.append(toast);

    window.setTimeout(() => {
      document.body.classList.remove("easter-active");
      burst.remove();
      toast.remove();
    }, prefersReducedMotion ? 2400 : 4200);
  }

  function bindAliasEasterEgg() {
    const alias = document.getElementById("hero-alias");
    if (!alias) return;
    if (alias.dataset.easterBound === "true") return;

    alias.dataset.easterBound = "true";
    alias.tabIndex = 0;
    alias.setAttribute("role", "button");
    alias.setAttribute("aria-label", "Alias signal. Click three times to unlock EchoOps mode.");
    alias.setAttribute("title", "Click 3 times to unlock EchoOps mode");

    let taps = 0;
    let resetTimer = 0;
    const neededTaps = 3;

    const resetTaps = () => {
      taps = 0;
      alias.classList.remove("is-primed");
      alias.removeAttribute("data-easter-progress");
    };

    const registerTap = () => {
      taps += 1;
      window.clearTimeout(resetTimer);
      alias.classList.toggle("is-primed", taps > 1);
      alias.setAttribute("data-easter-progress", `${Math.min(taps, neededTaps)}/${neededTaps}`);

      if (taps >= neededTaps) {
        resetTaps();
        triggerAliasEasterEgg();
        return;
      }

      resetTimer = window.setTimeout(resetTaps, 4000);
    };

    alias.addEventListener("click", registerTap);
    alias.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        registerTap();
      }
    });

    if (document.body.dataset.easterKeyboardBound === "true") return;
    document.body.dataset.easterKeyboardBound = "true";
    let typedCode = "";
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const isTyping = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (isTyping || event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) {
        return;
      }

      typedCode = `${typedCode}${event.key.toLowerCase()}`.slice(-7);
      if (typedCode === "echoops") {
        typedCode = "";
        triggerAliasEasterEgg();
      }
    });
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

  function bootPortfolio(dynamicData = fallbackDynamicData()) {
    applyProfile();
    latestDynamicData = dynamicData;
    renderHighlights();
    renderAbout();
    renderProjectFilters(config.projects || []);
    renderProjects();
    renderSteam(dynamicData.steam);
    renderSpotify(dynamicData.spotify);
    renderMarket(dynamicData.market);
    renderNews(dynamicData.news);
    renderSecurity();
    renderContact();
    renderConnections(dynamicData);
    bindNavigation();
    bindActiveNav();
    bindTypewriter();
    bindAliasEasterEgg();
    observeReveals();
    bindTiltCards();
    startSignalCanvas();
    loadGitHubRepos();
    finishBoot();
    scheduleDynamicDataWarmups();
    window.setInterval(() => loadSteamData({ renderFallback: false }), dataRefreshMs);
    window.setInterval(() => loadSpotifyData({ renderFallback: false }), spotifyDataRefreshMs);
    window.setInterval(() => loadMarketData({ renderFallback: false }), dataRefreshMs);
    window.setInterval(() => loadNewsData({ renderFallback: false }), dataRefreshMs * 5);
  }

  async function init() {
    bindTheme();
    bindBootQuotes();
    bindBootSteps();
    const fallbackData = fallbackDynamicData();
    const dynamicDataPromise = withTimeout(preloadDynamicData(), 8500, fallbackData);
    const [dynamicData] = await Promise.all([dynamicDataPromise, delay(10000)]);
    bootPortfolio(dynamicData || fallbackData);
  }

  init().catch(() => {
    bootPortfolio(fallbackDynamicData());
  });
})();
