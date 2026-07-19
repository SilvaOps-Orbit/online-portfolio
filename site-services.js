(function () {
  "use strict";

  const config = window.PORTFOLIO_CONFIG?.services || {};
  const languageStorageKey = "echoops-language-v1";
  const translationCacheKey = "echoops-translation-cache-v1";
  const factCacheKey = "echoops-daily-fact-v1";
  const counterCacheKey = "echoops-counter-crossrefs-v1";
  const textRecords = new Map();
  let translationController = null;
  let translationMutationTimer = 0;
  let applyingTranslations = false;
  let activeLanguage = "en";
  let suppressTranslationObserverUntil = 0;

  function cleanText(value, maxLength = 1000) {
    return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
  }

  function trustedHttpsUrl(value, allowedOrigins) {
    try {
      const url = new URL(String(value || ""));
      return url.protocol === "https:" && allowedOrigins.includes(url.origin) ? url : null;
    } catch (error) {
      return null;
    }
  }

  function todayInMelbourne() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Melbourne",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  }

  function readJsonStorage(key, fallback) {
    try {
      return JSON.parse(window.localStorage.getItem(key) || "null") || fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJsonStorage(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      return;
    }
  }

  function fallbackFact() {
    const facts = [
      "The first computer mouse was made of wood.",
      "A group of flamingos is called a flamboyance.",
      "Bananas are berries, but strawberries are not.",
      "The dot over a lowercase i or j is called a tittle.",
      "A day on Venus is longer than a year on Venus."
    ];
    const index = Array.from(todayInMelbourne()).reduce((total, character) => total + character.charCodeAt(0), 0) % facts.length;
    return { text: facts[index], sourceUrl: "https://uselessfacts.jsph.pl/", cached: true };
  }

  async function loadDailyFact() {
    const day = todayInMelbourne();
    const cached = readJsonStorage(factCacheKey, null);
    if (cached?.day === day && cleanText(cached.text, 600)) return cached;

    const configured = config.uselessFacts?.endpoint || "https://uselessfacts.jsph.pl/api/v2/facts/today?language=en";
    const endpoint = trustedHttpsUrl(configured, ["https://uselessfacts.jsph.pl"]);
    if (!endpoint) return { day, ...fallbackFact() };

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(endpoint, {
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Useless Facts returned ${response.status}`);
      const payload = await response.json();
      const text = cleanText(payload?.text, 600);
      if (!text) throw new Error("Useless Facts returned an empty fact");
      const permalink = trustedHttpsUrl(payload?.permalink, ["https://uselessfacts.jsph.pl"]);
      const value = {
        day,
        text,
        sourceUrl: permalink?.href || "https://uselessfacts.jsph.pl/",
        cached: false
      };
      writeJsonStorage(factCacheKey, value);
      return value;
    } catch (error) {
      return { day, ...fallbackFact() };
    } finally {
      window.clearTimeout(timer);
    }
  }

  function bindDailyFact() {
    const button = document.getElementById("daily-fact-button");
    const dialog = document.getElementById("daily-fact-dialog");
    const close = document.getElementById("daily-fact-close");
    const text = document.getElementById("daily-fact-text");
    const source = document.getElementById("daily-fact-source");
    if (!button || !(dialog instanceof HTMLDialogElement) || !close || !text || !source) return;

    button.addEventListener("click", async () => {
      document.getElementById("site-nav")?.classList.remove("is-open");
      document.getElementById("nav-toggle")?.setAttribute("aria-expanded", "false");
      if (!dialog.open) dialog.showModal();
      button.setAttribute("aria-expanded", "true");
      text.textContent = "Fetching one beautifully unnecessary fact...";
      const fact = await loadDailyFact();
      if (!dialog.open) return;
      text.textContent = fact.text;
      source.href = fact.sourceUrl;
      source.textContent = fact.cached ? "Local fallback fact" : "Useless Facts API";
    });
    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => {
      button.setAttribute("aria-expanded", "false");
      button.focus();
    });
  }

  function languageOptions() {
    const configured = Array.isArray(config.translation?.languages) ? config.translation.languages : [];
    const defaults = [
      { code: "en", label: "English", target: "English" },
      { code: "es", label: "Spanish", target: "Spanish" },
      { code: "fr", label: "French", target: "French" },
      { code: "de", label: "German", target: "German" },
      { code: "it", label: "Italian", target: "Italian" },
      { code: "pt", label: "Portuguese", target: "Portuguese" },
      { code: "zh", label: "Chinese", target: "Chinese" },
      { code: "ja", label: "Japanese", target: "Japanese" },
      { code: "ko", label: "Korean", target: "Korean" },
      { code: "ar", label: "Arabic", target: "Arabic" },
      { code: "hi", label: "Hindi", target: "Hindi" }
    ];
    return (configured.length ? configured : defaults).flatMap((item) => {
      const code = cleanText(item?.code, 8).toLowerCase();
      const label = cleanText(item?.label, 40);
      const target = cleanText(item?.target, 40);
      return /^[a-z]{2,3}(?:-[a-z]{2})?$/.test(code) && label && target ? [{ code, label, target }] : [];
    });
  }

  function configuredTranslationEndpoint() {
    const endpoint = String(config.translation?.endpoint || "").trim().replace(/\/+$/, "");
    if (!endpoint) return "";
    try {
      const url = new URL(endpoint);
      const local = ["localhost", "127.0.0.1"].includes(url.hostname);
      if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return "";
      return `${url.href.replace(/\/+$/, "")}/api/translate`;
    } catch (error) {
      return "";
    }
  }

  function shouldIgnoreTextNode(node) {
    const parent = node.parentElement;
    if (!parent) return true;
    return Boolean(parent.closest("script, style, noscript, code, pre, select, option, textarea, input, svg, canvas, [data-no-translate], .tech-lab, .daily-fact-dialog"));
  }

  function sourceForNode(node) {
    const current = cleanText(node.nodeValue, 1000);
    if (!current || !/[A-Za-z]/.test(current)) return "";
    const record = textRecords.get(node);
    if (!record || (!applyingTranslations && current !== record.rendered)) {
      textRecords.set(node, { source: current, rendered: current });
      return current;
    }
    return record.source;
  }

  function collectTranslatableNodes() {
    const bySource = new Map();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (!shouldIgnoreTextNode(node)) {
        const source = sourceForNode(node);
        if (source) {
          const nodes = bySource.get(source) || [];
          nodes.push(node);
          bySource.set(source, nodes);
        }
      }
      node = walker.nextNode();
    }
    return bySource;
  }

  function setLanguageState(text, state) {
    const target = document.getElementById("language-state");
    const control = document.querySelector(".language-control");
    if (target) target.textContent = text;
    if (control) control.dataset.state = state;
  }

  function applyTranslationMap(bySource, translations) {
    suppressTranslationObserverUntil = performance.now() + 1200;
    applyingTranslations = true;
    try {
      bySource.forEach((nodes, source) => {
        const translated = cleanText(translations.get(source), 1000);
        if (!translated) return;
        nodes.forEach((node) => {
          node.nodeValue = translated;
          textRecords.set(node, { source, rendered: translated });
        });
      });
    } finally {
      applyingTranslations = false;
    }
  }

  function readTranslationCache() {
    const value = readJsonStorage(translationCacheKey, {});
    return value && typeof value === "object" ? value : {};
  }

  function saveTranslationCache(cache) {
    const entries = Object.entries(cache).slice(-800);
    writeJsonStorage(translationCacheKey, Object.fromEntries(entries));
  }

  function translationBatches(strings) {
    const batches = [];
    let batch = [];
    let characters = 0;
    strings.forEach((value) => {
      const nextLength = value.length + 14;
      if (batch.length && (batch.length >= 8 || characters + nextLength > 850)) {
        batches.push(batch);
        batch = [];
        characters = 0;
      }
      batch.push(value);
      characters += nextLength;
    });
    if (batch.length) batches.push(batch);
    return batches;
  }

  async function translateBatch(endpoint, texts, language, signal) {
    const response = await fetch(endpoint, {
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts, source: "English", target: language.target }),
      signal
    });
    if (!response.ok) throw new Error(`Translation gateway returned ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload?.translations) || payload.translations.length !== texts.length) {
      throw new Error("Translation gateway returned an unexpected response");
    }
    return payload.translations.map((value) => cleanText(value, 1000));
  }

  function restoreEnglish() {
    suppressTranslationObserverUntil = performance.now() + 1200;
    applyingTranslations = true;
    try {
      textRecords.forEach((record, node) => {
        if (!node.isConnected) return;
        node.nodeValue = record.source;
        record.rendered = record.source;
      });
    } finally {
      applyingTranslations = false;
    }
    document.documentElement.lang = "en-AU";
    document.documentElement.dir = "ltr";
    setLanguageState("", "ready");
  }

  async function translatePage(language) {
    activeLanguage = language.code;
    translationController?.abort();
    if (language.code === "en") {
      restoreEnglish();
      return;
    }

    const endpoint = configuredTranslationEndpoint();
    if (!endpoint) {
      restoreEnglish();
      setLanguageState("Setup", "error");
      return;
    }

    translationController = new AbortController();
    const bySource = collectTranslatableNodes();
    const cache = readTranslationCache();
    const translated = new Map();
    const missing = [];
    bySource.forEach((nodes, source) => {
      const value = cleanText(cache[`${language.code}::${source}`], 1000);
      if (value) translated.set(source, value);
      else missing.push(source);
    });
    applyTranslationMap(bySource, translated);
    setLanguageState("...", "loading");

    try {
      for (const batch of translationBatches(missing)) {
        const values = await translateBatch(endpoint, batch, language, translationController.signal);
        batch.forEach((source, index) => {
          if (!values[index]) return;
          translated.set(source, values[index]);
          cache[`${language.code}::${source}`] = values[index];
        });
        applyTranslationMap(bySource, translated);
      }
      saveTranslationCache(cache);
      document.documentElement.lang = language.code;
      document.documentElement.dir = language.code === "ar" ? "rtl" : "ltr";
      setLanguageState("OK", "ready");
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.warn("Site translation was unavailable", error);
      setLanguageState("Retry", "error");
    }
  }

  function bindLanguagePreference() {
    const select = document.getElementById("language-select");
    if (!(select instanceof HTMLSelectElement)) return;
    const languages = languageOptions();
    select.replaceChildren(...languages.map((language) => {
      const option = document.createElement("option");
      option.value = language.code;
      option.textContent = language.code.toUpperCase();
      option.title = language.label;
      return option;
    }));

    const saved = cleanText(window.localStorage.getItem(languageStorageKey), 8).toLowerCase();
    const initial = languages.find((language) => language.code === saved) || languages[0];
    select.value = initial.code;
    activeLanguage = initial.code;
    select.addEventListener("change", () => {
      const language = languages.find((item) => item.code === select.value) || languages[0];
      window.localStorage.setItem(languageStorageKey, language.code);
      void translatePage(language);
    });

    const observer = new MutationObserver((mutations) => {
      if (applyingTranslations || performance.now() < suppressTranslationObserverUntil || activeLanguage === "en" || !configuredTranslationEndpoint()) return;
      const hasPageChange = mutations.some((mutation) => {
        const parent = mutation.target.nodeType === Node.TEXT_NODE ? mutation.target.parentElement : mutation.target;
        return parent instanceof Element && !parent.closest(".language-control, .daily-fact-dialog, .tech-lab, script, style, select, option");
      });
      if (!hasPageChange) return;
      window.clearTimeout(translationMutationTimer);
      translationMutationTimer = window.setTimeout(() => {
        const language = languages.find((item) => item.code === activeLanguage);
        if (language) void translatePage(language);
      }, 800);
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });

    if (initial.code !== "en") {
      window.setTimeout(() => void translatePage(initial), document.body.classList.contains("is-booting") ? 10500 : 0);
    }
  }

  function productionCounterMode() {
    const hosts = Array.isArray(config.analyticsCrossReference?.productionHosts)
      ? config.analyticsCrossReference.productionHosts.map((host) => cleanText(host, 120).toLowerCase())
      : ["silvaops-orbit.github.io"];
    return hosts.includes(window.location.hostname.toLowerCase());
  }

  function safeCounterSegment(value, fallback) {
    const cleaned = cleanText(value, 80).toLowerCase().replace(/[^a-z0-9._-]/g, "-").replace(/-+/g, "-");
    return cleaned || fallback;
  }

  function configuredCounterGateway(settings) {
    const value = String(settings.gatewayEndpoint || "").trim().replace(/\/+$/, "");
    if (!value) return "";
    try {
      const url = new URL(value);
      const local = ["127.0.0.1", "localhost"].includes(url.hostname);
      const approved = url.origin === "https://echoops-counter-gateway.alvis-dev.workers.dev";
      return approved || (local && url.protocol === "http:") ? url.href.replace(/\/+$/, "") : "";
    } catch (error) {
      return "";
    }
  }

  async function fetchCounterValue(url, field, signal) {
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal
    });
    if (!response.ok) throw new Error(`Counter returned ${response.status}`);
    const payload = await response.json();
    const value = Math.max(0, Math.floor(Number(payload?.[field])));
    if (!Number.isFinite(value)) throw new Error("Counter returned an invalid value");
    return value;
  }

  async function fetchGatewayCounter(endpoint, increment, signal) {
    const response = await fetch(`${endpoint}${increment ? "/api/track" : "/api/value"}`, {
      method: increment ? "POST" : "GET",
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal
    });
    if (!response.ok) throw new Error(`Counter gateway returned ${response.status}`);
    const payload = await response.json();
    const value = Math.max(0, Math.floor(Number(payload?.value)));
    if (!Number.isFinite(value)) throw new Error("Counter gateway returned an invalid value");
    return { value, source: cleanText(payload?.provider, 60) || "CounterAPI V2 gateway" };
  }

  async function refreshCounterCrossReferences() {
    const settings = config.analyticsCrossReference || {};
    const production = productionCounterMode();
    const namespace = safeCounterSegment(settings.namespace, "silvaops-orbit-online-portfolio");
    const key = safeCounterSegment(settings.key, "page-views");
    const gatewayEndpoint = configuredCounterGateway(settings);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    const counterPath = production ? "up" : "";
    const counterUrl = `https://api.counterapi.dev/v1/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}${counterPath ? `/${counterPath}` : ""}`;
    const abacusAction = production ? "hit" : "get";
    const abacusUrl = `https://abacus.jasoncameron.dev/${abacusAction}/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`;
    const current = readJsonStorage(counterCacheKey, {});
    const counterRequest = gatewayEndpoint
      ? fetchGatewayCounter(gatewayEndpoint, production, controller.signal).catch(async () => ({
          value: await fetchCounterValue(counterUrl, "count", controller.signal),
          source: "CounterAPI V1 public fallback"
        }))
      : fetchCounterValue(counterUrl, "count", controller.signal).then((value) => ({
          value,
          source: "CounterAPI V1 public fallback"
        }));

    try {
      const [counterResult, abacusResult] = await Promise.allSettled([
        counterRequest,
        fetchCounterValue(abacusUrl, "value", controller.signal)
      ]);
      const updated = {
        ...current,
        counterApi: counterResult.status === "fulfilled" ? counterResult.value.value : current.counterApi,
        counterApiSource: counterResult.status === "fulfilled" ? counterResult.value.source : current.counterApiSource,
        abacus: abacusResult.status === "fulfilled" ? abacusResult.value : current.abacus,
        updatedAt: new Date().toISOString(),
        mode: production ? "raw production page loads" : "read-only preview"
      };
      writeJsonStorage(counterCacheKey, updated);
      document.dispatchEvent(new CustomEvent("echoops:counter-crossrefs", { detail: updated }));
    } finally {
      window.clearTimeout(timer);
    }
  }

  bindDailyFact();
  bindLanguagePreference();
  void refreshCounterCrossReferences();
})();
