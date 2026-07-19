import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { cleanText } from "./text-sanitizer.mjs";

const execFileAsync = promisify(execFile);
const finnhubApiKey = process.env.FINNHUB_API_KEY || "";
const newsApiKey = process.env.NEWSAPI_KEY || process.env.NEWS_API_KEY || process.env.NEWS_API_ORG_KEY || "";
const mediastackApiKey = process.env.MEDIASTACK_API_KEY || process.env.MEDIASTACK_ACCESS_KEY || process.env.MEDIASTACK_KEY || "";
const mediastackBaseUrl = process.env.MEDIASTACK_BASE_URL || "https://api.mediastack.com/v1/news";
const marketOutputPath = new URL("../data/market.json", import.meta.url);
const newsOutputPath = new URL("../data/news.json", import.meta.url);
const generatedAt = new Date().toISOString();
const fetchTimeoutMs = 12000;
const hackerNewsBaseUrl = "https://hacker-news.firebaseio.com/v0";
const hackerNewsCandidateLimit = 30;
const newsCategoryOrder = ["Breaking Worldwide", "Gaming", "Technology", "Finance", "Australia"];

const quoteTargets = [
  { symbol: "SPX", name: "S&P 500 Index", type: "index", yahoo: "^GSPC", finnhub: "SPY", sector: "Broad market" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF", type: "index", yahoo: "SPY", finnhub: "SPY", sector: "S&P 500 ETF" },
  { symbol: "NVDA", name: "NVIDIA", type: "stock", yahoo: "NVDA", finnhub: "NVDA", sector: "AI / Gaming Hardware" },
  { symbol: "MSFT", name: "Microsoft", type: "stock", yahoo: "MSFT", finnhub: "MSFT", sector: "Cloud / AI / Gaming" },
  { symbol: "AMD", name: "AMD", type: "stock", yahoo: "AMD", finnhub: "AMD", sector: "Gaming Hardware / AI Chips" },
  { symbol: "SONY", name: "Sony", type: "stock", yahoo: "SONY", finnhub: "SONY", sector: "Gaming / Entertainment" },
  { symbol: "EA", name: "Electronic Arts", type: "stock", yahoo: "EA", finnhub: "EA", sector: "Game Publisher" },
  { symbol: "TTWO", name: "Take-Two Interactive", type: "stock", yahoo: "TTWO", finnhub: "TTWO", sector: "Game Publisher" },
  { symbol: "RBLX", name: "Roblox", type: "stock", yahoo: "RBLX", finnhub: "RBLX", sector: "Gaming Platform" },
  { symbol: "CRWD", name: "CrowdStrike", type: "stock", yahoo: "CRWD", finnhub: "CRWD", sector: "Cyber Security / Tech" },
  { symbol: "META", name: "Meta", type: "stock", yahoo: "META", finnhub: "META", sector: "AI / Social / VR" },
  { symbol: "GOOGL", name: "Alphabet", type: "stock", yahoo: "GOOGL", finnhub: "GOOGL", sector: "AI / Cloud / Search" },
  { symbol: "AAPL", name: "Apple", type: "stock", yahoo: "AAPL", finnhub: "AAPL", sector: "Consumer Tech / Gaming Hardware" },
  { symbol: "AMZN", name: "Amazon", type: "stock", yahoo: "AMZN", finnhub: "AMZN", sector: "Cloud / Twitch / AI" },
  { symbol: "NFLX", name: "Netflix", type: "stock", yahoo: "NFLX", finnhub: "NFLX", sector: "Streaming / Games" },
  { symbol: "U", name: "Unity", type: "stock", yahoo: "U", finnhub: "U", sector: "Game Engine / Tools" },
  { symbol: "PLTR", name: "Palantir", type: "stock", yahoo: "PLTR", finnhub: "PLTR", sector: "AI / Data Platforms" },
  { symbol: "NET", name: "Cloudflare", type: "stock", yahoo: "NET", finnhub: "NET", sector: "Edge / Cyber Security" },
  { symbol: "PANW", name: "Palo Alto Networks", type: "stock", yahoo: "PANW", finnhub: "PANW", sector: "Cyber Security" },
  { symbol: "TSM", name: "TSMC", type: "stock", yahoo: "TSM", finnhub: "TSM", sector: "Semiconductors" },
  { symbol: "BTC", name: "Bitcoin", type: "asset", yahoo: "BTC-USD", finnhub: "BINANCE:BTCUSDT", sector: "Crypto / Risk Sentiment" },
  { symbol: "AUD/USD", name: "Australian Dollar", type: "asset", yahoo: "AUDUSD=X", finnhub: "OANDA:AUD_USD", sector: "FX / Australia" }
];

const defaultFeeds = {
  "Breaking Worldwide": [
    "https://feeds.bbci.co.uk/news/world/rss.xml"
  ],
  Gaming: [
    "https://www.pcgamer.com/rss/",
    "https://www.ign.com/rss/articles/feed?tags=games"
  ],
  Technology: [
    "https://feeds.arstechnica.com/arstechnica/index",
    "https://techcrunch.com/feed/"
  ],
  Finance: [
    "https://finance.yahoo.com/news/rssindex",
    "https://www.cnbc.com/id/100003114/device/rss/rss.html"
  ],
  Australia: [
    "https://www.pm.gov.au/rss.xml",
    "https://www.abc.net.au/news/feed/51120/rss.xml"
  ]
};

const newsQueries = {
  Gaming: {
    newsApi: '(gaming OR "video games" OR Steam OR PlayStation OR Xbox OR Nintendo)',
    newsApiAu: 'gaming OR "video games" OR Steam OR PlayStation OR Xbox OR Nintendo',
    newsApiCategory: "technology",
    mediastack: "gaming,video games,Steam,PlayStation,Xbox,Nintendo",
    mediastackCategories: "technology,entertainment",
    prioritizeAustralia: true
  },
  Technology: {
    newsApi: '(technology OR software OR programming OR "cyber security" OR AI OR "open source")',
    newsApiAu: 'technology OR software OR programming OR "cyber security" OR AI',
    newsApiCategory: "technology",
    mediastack: "technology,software,programming,cyber security,AI,open source",
    mediastackCategories: "technology",
    prioritizeAustralia: true
  },
  Finance: {
    newsApi: '(stocks OR markets OR earnings OR inflation OR "interest rates" OR Nvidia OR "S&P 500")',
    newsApiAu: 'stocks OR markets OR earnings OR inflation OR "interest rates" OR ASX OR RBA',
    newsApiCategory: "business",
    mediastack: "stocks,markets,earnings,inflation,interest rates,Nvidia,S&P 500",
    mediastackCategories: "business",
    prioritizeAustralia: true
  },
  Australia: {
    newsApi: '("Australian government" OR "Australia cyber security" OR "Australian defence" OR "digital identity" OR "Australian jobs")',
    newsApiAu: 'government OR cyber security OR defence OR "digital identity" OR jobs',
    mediastack: "Australian government,Australia cyber security,Australian defence,digital identity,Australian jobs",
    mediastackCountries: "au",
    strictAustralia: true
  },
  "Breaking Worldwide": {
    newsApi: '("breaking news" OR emergency OR evacuation OR earthquake OR wildfire OR cyclone OR "air strike" OR missile OR war OR conflict OR sanctions OR "state of emergency")',
    mediastack: "breaking news,emergency,evacuation,earthquake,wildfire,cyclone,air strike,missile,war,conflict,sanctions,state of emergency",
    mediastackCategories: "general",
    breaking: true
  }
};

const countryCodeNames = {
  au: "Australia",
  ca: "Canada",
  cn: "China",
  de: "Germany",
  fr: "France",
  gb: "United Kingdom",
  id: "Indonesia",
  il: "Israel",
  in: "India",
  ir: "Iran",
  jp: "Japan",
  kr: "South Korea",
  nz: "New Zealand",
  pk: "Pakistan",
  ru: "Russia",
  tw: "Taiwan",
  ua: "Ukraine",
  us: "United States"
};

const affectedPlacePatterns = [
  { label: "Australia", patterns: ["australia", "sydney", "melbourne", "canberra", "queensland", "victoria"] },
  { label: "United States", patterns: ["united states", "u.s.", "america", "washington", "california", "new york"] },
  { label: "United Kingdom", patterns: ["united kingdom", "uk ", "britain", "london", "england", "scotland"] },
  { label: "Ukraine", patterns: ["ukraine", "kyiv", "kharkiv", "odesa"] },
  { label: "Russia", patterns: ["russia", "moscow", "kremlin"] },
  { label: "Israel", patterns: ["israel", "tel aviv", "jerusalem"] },
  { label: "Gaza / Palestine", patterns: ["gaza", "palestine", "west bank", "rafah"] },
  { label: "Iran", patterns: ["iran", "tehran"] },
  { label: "China", patterns: ["china", "beijing", "hong kong"] },
  { label: "Taiwan", patterns: ["taiwan", "taipei"] },
  { label: "India", patterns: ["india", "new delhi", "mumbai"] },
  { label: "Pakistan", patterns: ["pakistan", "islamabad"] },
  { label: "Japan", patterns: ["japan", "tokyo"] },
  { label: "South Korea", patterns: ["south korea", "seoul"] },
  { label: "North Korea", patterns: ["north korea", "pyongyang"] },
  { label: "Indonesia", patterns: ["indonesia", "jakarta", "bali"] },
  { label: "Philippines", patterns: ["philippines", "manila"] },
  { label: "Europe", patterns: ["europe", "eu ", "european union", "nato"] },
  { label: "Middle East", patterns: ["middle east", "red sea", "yemen", "syria", "lebanon", "hezbollah"] },
  { label: "Worldwide", patterns: ["worldwide", "global", "international", "united nations"] }
];

const conflictTerms = [
  "war",
  "conflict",
  "invasion",
  "air strike",
  "airstrike",
  "missile",
  "drone attack",
  "shelling",
  "ceasefire",
  "troops",
  "military",
  "battlefield",
  "front line",
  "hamas",
  "hezbollah"
];

function articleSearchText(item) {
  return ` ${item?.title || ""} ${item?.snippet || ""} ${item?.source || ""} `.toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isWarArticle(item) {
  const text = articleSearchText(item);
  return conflictTerms.some((term) => {
    const phrase = escapeRegExp(term).replace(/\s+/g, "\\s+");
    return new RegExp(`(?:^|[^a-z0-9])${phrase}(?=$|[^a-z0-9])`, "i").test(text);
  });
}

function inferAffectedRegion(item) {
  if (item?.affectedRegion) return cleanText(item.affectedRegion);

  const country = cleanText(item?.country || "").toLowerCase();
  if (countryCodeNames[country]) return countryCodeNames[country];
  if (item?.regionalScope === "Australia" || item?.regionPriority) return "Australia";

  const text = articleSearchText(item);
  const matches = affectedPlacePatterns
    .filter((place) => place.patterns.some((pattern) => text.includes(pattern)))
    .map((place) => place.label);

  return uniqueStrings(matches).slice(0, 3).join(" / ") || "Worldwide";
}

function feedEnvName(name) {
  return String(name || "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function configuredFeeds(name, fallback) {
  const value = process.env[`NEWS_${feedEnvName(name)}_RSS`] || "";
  return value.split(",").map((item) => item.trim()).filter(Boolean).concat(value ? [] : fallback);
}

async function readExisting(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    return {};
  }
}

async function writeJson(path, data) {
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), fetchTimeoutMs);
  const headers = {
    Accept: "application/json, application/rss+xml, application/xml, text/xml, text/plain, */*",
    "User-Agent": "SilvaOps-Orbit portfolio data refresh (+https://silvaops-orbit.github.io/online-portfolio)",
    ...(options.headers || {})
  };

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetchWithTimeout(url, {
    ...options,
    headers: {
      Accept: "application/json",
      "User-Agent": "Alvis Leslie Gordon portfolio market refresh",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchText(url) {
  const response = await fetchWithTimeout(url, {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml, text/plain",
      "User-Agent": "Alvis Leslie Gordon portfolio news refresh"
    }
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.text();
}

function compact(value, maxLength = 180) {
  const text = cleanText(value || "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).replace(/\s+\S*$/, "")}...`;
}

function unwrapCdata(value) {
  return String(value || "").replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/g, "");
}

function cleanUrl(value) {
  return cleanText(unwrapCdata(value)).replace(/\s+/g, "");
}

function formatMoney(value, currency = "USD") {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "Price pending";

  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency,
      maximumFractionDigits: number >= 1000 ? 0 : 2
    }).format(number);
  } catch (error) {
    return number.toFixed(2);
  }
}

function formatPrice(target, value, currency = "USD") {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "Price pending";

  if (target?.symbol === "AUD/USD") {
    return `AUD/USD ${number.toFixed(4)}`;
  }

  return formatMoney(number, currency);
}

function formatChange(change, percent) {
  const changeNumber = Number(change);
  const percentNumber = Number(percent);
  if (!Number.isFinite(changeNumber) && !Number.isFinite(percentNumber)) {
    return "No movement yet";
  }

  const sign = changeNumber > 0 || percentNumber > 0 ? "+" : "";
  if (Number.isFinite(changeNumber) && Number.isFinite(percentNumber)) {
    const changeDecimals = Math.abs(changeNumber) > 0 && Math.abs(changeNumber) < 0.01 ? 4 : 2;
    return `${sign}${changeNumber.toFixed(changeDecimals)} (${sign}${percentNumber.toFixed(2)}%)`;
  }
  return `${sign}${(Number.isFinite(percentNumber) ? percentNumber : changeNumber).toFixed(2)}%`;
}

function yahooQuoteUrl(symbol) {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
}

async function yahooPublicQuote(symbol) {
  const data = await fetchJson(yahooQuoteUrl(symbol));
  const result = data?.chart?.result?.[0];
  const meta = result?.meta || {};
  const price = Number(meta.regularMarketPrice);
  const previousClose = Number(meta.previousClose || meta.chartPreviousClose);
  const change = Number.isFinite(price) && Number.isFinite(previousClose) ? price - previousClose : NaN;
  const changePercent = Number.isFinite(change) && previousClose ? (change / previousClose) * 100 : NaN;

  if (!Number.isFinite(price)) {
    return null;
  }

  return {
    source: "Yahoo Finance public chart fallback",
    price,
    previousClose,
    change,
    changePercent,
    currency: meta.currency || "USD",
    exchange: meta.exchangeName || meta.fullExchangeName || "",
    updatedAt: meta.regularMarketTime ? new Date(Number(meta.regularMarketTime) * 1000).toISOString() : generatedAt
  };
}

async function loadYfinanceQuotes(targets) {
  const symbols = [...new Set(targets.map((target) => target.yahoo).filter(Boolean))];
  if (!symbols.length) return {};

  const scriptPath = fileURLToPath(new URL("./yfinance-quotes.py", import.meta.url));
  const pythonBins = [process.env.PYTHON_BIN, "python3", "python", "py"].filter(Boolean);
  let lastError = null;

  for (const pythonBin of pythonBins) {
    try {
      const { stdout } = await execFileAsync(pythonBin, [scriptPath, ...symbols], {
        timeout: 25000,
        maxBuffer: 1024 * 1024
      });
      const parsed = JSON.parse(stdout || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      lastError = error;
    }
  }

  console.warn(`yfinance quote helper unavailable: ${cleanText(lastError?.message || "unknown error")}`);
  return {};
}

async function finnhubQuote(symbol) {
  if (!finnhubApiKey || !symbol) return null;
  const url = new URL("https://finnhub.io/api/v1/quote");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("token", finnhubApiKey);
  const quote = await fetchJson(url);
  const price = Number(quote?.c);

  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  return {
    source: "Finnhub",
    price,
    previousClose: Number(quote?.pc),
    change: Number(quote?.d),
    changePercent: Number(quote?.dp),
    currency: "USD",
    high: Number(quote?.h),
    low: Number(quote?.l),
    open: Number(quote?.o),
    updatedAt: quote?.t ? new Date(Number(quote.t) * 1000).toISOString() : generatedAt
  };
}

function signalFromMove(target, quote, crossReferenceNote) {
  const percent = Number(quote?.changePercent);
  const sector = String(target.sector || "").toLowerCase();

  if (crossReferenceNote) {
    return {
      signal: "Data check",
      reason: `Finnhub and yfinance are not perfectly aligned. ${crossReferenceNote} Treat this as a verification prompt before making any judgement.`
    };
  }

  if (Number.isFinite(percent) && percent >= 3) {
    return {
      signal: "Momentum watch",
      reason: `${target.name} is moving strongly today. Research whether the move is backed by earnings, product news, or wider market momentum before chasing it.`
    };
  }

  if (Number.isFinite(percent) && percent <= -3) {
    return {
      signal: "Sell-risk flag",
      reason: `${target.name} is under pressure. Check whether this is a company-specific issue or broad market weakness before treating it as a discount.`
    };
  }

  if (sector.includes("ai") || sector.includes("cyber")) {
    return {
      signal: "Research buy case",
      reason: `${target.name} sits in a high-attention tech theme. Look for revenue growth, margins, guidance, and valuation before calling it attractive.`
    };
  }

  if (sector.includes("gaming")) {
    return {
      signal: "Catalyst watch",
      reason: `${target.name} depends on release cycles, platform demand, and gaming sentiment. Watch upcoming launches and earnings commentary.`
    };
  }

  return {
    signal: "Watch",
    reason: `${target.name} is stable enough for watchlist tracking. Compare it against the S&P 500 before deciding whether it is leading or lagging.`
  };
}

async function buildQuoteItem(target, yfinanceQuotes = {}) {
  const yfinance = Number.isFinite(Number(yfinanceQuotes[target.yahoo]?.price)) ? yfinanceQuotes[target.yahoo] : null;
  const [finnhub, yahoo] = await Promise.all([
    finnhubQuote(target.finnhub).catch(() => null),
    yfinance ? Promise.resolve(yfinance) : yahooPublicQuote(target.yahoo).catch(() => null)
  ]);
  const primary = finnhub || yahoo;
  const crossReferenceDifference = finnhub && yahoo
    ? Math.abs(Number(finnhub.price) - Number(yahoo.price)) / Math.max(Number(finnhub.price), Number(yahoo.price)) * 100
    : 0;
  const crossReferenceNote = crossReferenceDifference > 1
    ? `Price difference is ${crossReferenceDifference.toFixed(2)}% between sources.`
    : "";
  const signal = signalFromMove(target, primary, crossReferenceNote);
  const history = Array.isArray(yfinance?.history) ? yfinance.history : [];
  const priceValue = Number(primary?.price);
  const changeValue = Number(primary?.change);
  const changePercent = Number(primary?.changePercent);

  return {
    symbol: target.symbol,
    name: target.name,
    sector: target.sector,
    price: formatPrice(target, primary?.price, primary?.currency || "USD"),
    change: formatChange(primary?.change, primary?.changePercent),
    priceValue: Number.isFinite(priceValue) ? priceValue : null,
    changeValue: Number.isFinite(changeValue) ? changeValue : null,
    changePercent: Number.isFinite(changePercent) ? changePercent : null,
    trend: Number.isFinite(changePercent) && changePercent > 0 ? "up" : Number.isFinite(changePercent) && changePercent < 0 ? "down" : "flat",
    signal: signal.signal,
    reason: signal.reason,
    source: [finnhub?.source, yahoo?.source].filter(Boolean).join(" + ") || "pending",
    crossReference: crossReferenceNote || (finnhub && yahoo ? "Finnhub and yfinance prices aligned within 1%." : "Single source or pending data."),
    history,
    chartLabel: "1W",
    updatedAt: primary?.updatedAt || generatedAt,
    url: `https://finance.yahoo.com/quote/${encodeURIComponent(target.yahoo)}`
  };
}

function buildMarketSignals(indexes, stocks) {
  const signals = [];
  const all = [...indexes, ...stocks];
  const index = indexes[0];
  const indexPercent = Number(index?.changePercent);
  const winners = stocks
    .filter((item) => Number.isFinite(Number(item.changePercent)) && Number(item.changePercent) > 0.75)
    .sort((a, b) => Number(b.changePercent) - Number(a.changePercent));
  const pressure = stocks
    .filter((item) => Number.isFinite(Number(item.changePercent)) && Number(item.changePercent) < -1)
    .sort((a, b) => Number(a.changePercent) - Number(b.changePercent));
  const sellRisk = all.find((item) => /sell-risk/i.test(item.signal));
  const momentum = all.find((item) => /momentum/i.test(item.signal));
  const research = all.find((item) => /research buy/i.test(item.signal));

  winners.slice(0, 3).forEach((winner) => {
    const percent = Number(winner.changePercent);
    const supportiveMarket = Number.isFinite(indexPercent) && indexPercent >= 0;
    signals.push({
      stance: percent >= 3 ? "Strong mover" : "Doing well",
      tone: "positive",
      symbol: winner.symbol,
      change: `${percent > 0 ? "+" : ""}${percent.toFixed(2)}% today`,
      title: `${winner.name} is showing strength`,
      why: `${winner.name} is up ${percent.toFixed(2)}%. ${supportiveMarket ? "The broad market is supportive, so this momentum is cleaner to research." : "The broad market is not clearly helping, so treat this as relative strength and confirm the catalyst."} Check news, earnings, and valuation before acting.`,
      drivers: ["Relative strength", "Catalyst check", "Do not chase blind"]
    });
  });

  if (pressure.length) {
    const item = pressure[0];
    const percent = Number(item.changePercent);
    signals.push({
      stance: "Risk check",
      tone: "caution",
      symbol: item.symbol,
      change: `${percent.toFixed(2)}% today`,
      title: `${item.name} is under pressure`,
      why: `${item.name} is down ${Math.abs(percent).toFixed(2)}%. Check whether the move is company-specific, sector-wide, or just broad market weakness before calling it a discount.`,
      drivers: ["News scan", "Support levels", "Position sizing"]
    });
  }

  if (research) {
    signals.push({
      stance: "Research buy case",
      tone: "research",
      symbol: research.symbol,
      title: `${research.name} has a theme worth investigating`,
      why: research.reason,
      drivers: [research.sector, "Earnings quality", "Valuation check"]
    });
  }

  if (sellRisk) {
    signals.push({
      stance: "Sell-risk flag",
      tone: "caution",
      symbol: sellRisk.symbol,
      title: `${sellRisk.name} needs risk review`,
      why: sellRisk.reason,
      drivers: ["Price pressure", "News check", "Do not average down blindly"]
    });
  }

  if (momentum) {
    signals.push({
      stance: "Momentum watch",
      tone: "positive",
      symbol: momentum.symbol,
      title: `${momentum.name} is moving faster than usual`,
      why: momentum.reason,
      drivers: ["Momentum", "Catalyst check", "Position sizing"]
    });
  }

  if (index) {
    signals.push({
      stance: Number.isFinite(indexPercent) && indexPercent >= 0 ? "Market support" : "Market filter",
      tone: Number.isFinite(indexPercent) && indexPercent < 0 ? "caution" : "market",
      symbol: index.symbol,
      change: Number.isFinite(indexPercent) ? `${indexPercent > 0 ? "+" : ""}${indexPercent.toFixed(2)}% today` : "",
      title: "Check the broad market before individual names",
      why: `${index.name} is the baseline mood check. Strong individual stocks are more convincing when the broad market is supportive.`,
      drivers: ["S&P 500 trend", "Rate expectations", "Market breadth"]
    });
  }

  return signals.slice(0, 9);
}

function tagValue(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!match) return "";
  return unwrapCdata(match[1]);
}

function attrValue(block, tagName, attrName) {
  const match = block.match(new RegExp(`<${tagName}[^>]*\\s${attrName}=["']([^"']+)["'][^>]*>`, "i"));
  return match ? match[1] : "";
}

function htmlImage(block) {
  const match = String(block || "").match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : "";
}

function rssImage(block) {
  return cleanUrl(
    attrValue(block, "media:content", "url")
      || attrValue(block, "media:thumbnail", "url")
      || attrValue(block, "enclosure", "url")
      || tagValue(block, "image")
      || htmlImage(block)
  );
}

function rssSourceName(hostname) {
  const host = String(hostname || "").replace(/^www\./, "").toLowerCase();
  const names = {
    "abc.net.au": "ABC News",
    "bbc.co.uk": "BBC News",
    "bbc.com": "BBC News",
    "feeds.bbci.co.uk": "BBC News",
    "cnbc.com": "CNBC",
    "finance.yahoo.com": "Yahoo Finance",
    "ign.com": "IGN",
    "pcgamer.com": "PC Gamer",
    "arstechnica.com": "Ars Technica",
    "feeds.arstechnica.com": "Ars Technica",
    "techcrunch.com": "TechCrunch",
    "pm.gov.au": "Prime Minister of Australia"
  };
  if (names[host]) return names[host];
  const label = host.split(".")[0] || "News Feed";
  return label.replace(/(^|-)([a-z])/g, (match) => match.toUpperCase()).replace(/-/g, " ");
}

function parseRssItems(xml, category, sourceName) {
  const text = String(xml || "");
  const itemBlocks = text.match(/<item[\s\S]*?<\/item>/gi) || [];
  const entryBlocks = text.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  return [...itemBlocks, ...entryBlocks].map((block) => {
    const url = cleanUrl(tagValue(block, "link") || attrValue(block, "link", "href"));
    return {
      category,
      title: cleanText(tagValue(block, "title")),
      snippet: compact(tagValue(block, "description") || tagValue(block, "summary") || tagValue(block, "content:encoded") || tagValue(block, "content"), 190),
      url,
      source: sourceName,
      sourceApi: sourceName,
      sourceApis: [sourceName],
      sourceGroup: "RSS",
      sourceGroups: ["RSS"],
      image: rssImage(block),
      publishedAt: cleanText(tagValue(block, "pubDate") || tagValue(block, "updated") || tagValue(block, "published"))
    };
  }).filter((item) => item.title && item.url);
}

function apiList(item) {
  if (Array.isArray(item?.sourceApis) && item.sourceApis.length) {
    return item.sourceApis.map((api) => cleanText(api)).filter(Boolean);
  }
  return [cleanText(item?.sourceApi || item?.apiSource || "")].filter(Boolean);
}

function sourceHas(item, api) {
  return apiList(item).includes(api)
    || item?.sourceGroup === api
    || (Array.isArray(item?.sourceGroups) && item.sourceGroups.includes(api));
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => cleanText(value)).filter(Boolean))];
}

function articleKey(item) {
  try {
    const url = new URL(item.url);
    return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch (error) {
    return cleanText(item.title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
}

function mergeNewsSources(items) {
  const merged = new Map();

  items.forEach((item) => {
    if (!item?.title || !item?.url) return;
    const key = articleKey(item);
    if (!key) return;
    const existing = merged.get(key);

    if (!existing) {
      const sourceApis = apiList(item);
      const sourceGroups = uniqueStrings([
        item.sourceGroup,
        ...(Array.isArray(item.sourceGroups) ? item.sourceGroups : [])
      ]);
      merged.set(key, {
        ...item,
        sourceApis,
        sourceApi: sourceApis.join(" + "),
        sourceGroups
      });
      return;
    }

    const sourceApis = uniqueStrings([...apiList(existing), ...apiList(item)]);
    const sourceGroups = uniqueStrings([
      existing.sourceGroup,
      item.sourceGroup,
      ...(Array.isArray(existing.sourceGroups) ? existing.sourceGroups : []),
      ...(Array.isArray(item.sourceGroups) ? item.sourceGroups : [])
    ]);
    const sources = uniqueStrings([existing.source, item.source]).slice(0, 3);
    existing.sourceApis = sourceApis;
    existing.sourceApi = sourceApis.join(" + ");
    existing.sourceGroups = sourceGroups;
    existing.source = sources.join(" / ") || existing.source;
    existing.snippet = existing.snippet || item.snippet;
    existing.image = existing.image || item.image;
    existing.publishedAt = existing.publishedAt || item.publishedAt;
    existing.regionPriority = Boolean(existing.regionPriority || item.regionPriority);
    existing.regionalScope = existing.regionPriority ? "Australia" : existing.regionalScope || item.regionalScope;
    existing.crossReference = sourceApis.length > 1
      ? `Cross-referenced by ${sourceApis.join(" + ")}.`
      : existing.crossReference;
  });

  return Array.from(merged.values());
}

function newsImportance(category, item) {
  const text = `${item.title} ${item.snippet}`.toLowerCase();
  const keywordSets = {
    Gaming: ["steam", "xbox", "playstation", "nintendo", "release", "delay", "studio", "layoffs", "acquisition", "ai", "security"],
    Technology: ["security", "cyber", "open source", "developer", "programming", "software", "hardware", "ai", "startup", "cloud", "privacy"],
    Finance: ["s&p", "stock", "market", "earnings", "inflation", "interest", "rate", "rba", "fed", "ai", "nvidia", "recession"],
    Australia: ["government", "defence", "cyber", "security", "budget", "policy", "legislation", "australia", "jobs", "digital"],
    "Breaking Worldwide": ["breaking", "emergency", "evacuation", "earthquake", "wildfire", "cyclone", "war", "conflict", "missile", "sanctions", "attack"]
  };
  const engagementScore = category === "Technology"
    ? Math.min(8, Math.floor(Number(item.hackerNewsPoints || 0) / 50) + Math.floor(Number(item.hackerNewsComments || 0) / 35))
    : 0;
  const score = (keywordSets[category] || []).reduce((total, keyword) => total + (text.includes(keyword) ? 2 : 0), 0)
    + Math.min(4, Math.floor(text.length / 120))
    + engagementScore;

  if (category === "Breaking Worldwide" && score >= 5) return { label: "Breaking", score: score + 3 };
  if (category === "Breaking Worldwide") return { label: "Developing", score: score + 1 };
  if (score >= 8) return { label: "High impact", score };
  if (score >= 5) return { label: category === "Finance" ? "Market impact" : "Important", score };
  return { label: "Watch", score };
}

function whyNewsMatters(category, item) {
  if (category === "Gaming") {
    return "Gaming updates keep the portfolio tied to releases, platforms, studios, and the culture around your Steam section.";
  }
  if (category === "Finance") {
    return "Finance headlines can explain stock moves and help visitors understand the watchlist context.";
  }
  if (category === "Technology") {
    return sourceHas(item, "Hacker News")
      ? "Hacker News adds developer, cyber security, AI, startup, and open-source signals that connect directly to the work behind this portfolio."
      : "Technology coverage connects current software, cyber security, AI, hardware, and open-source changes to the work behind this portfolio.";
  }
  if (category === "Australia") {
    return "Australian updates connect the site to local policy, defence, cyber, jobs, and public life.";
  }
  if (category === "Breaking Worldwide") {
    return `Breaking worldwide items are kept short so visitors can spot urgent events and the affected region fast: ${inferAffectedRegion(item)}.`;
  }
  return "This item was kept because it may affect the wider story the portfolio is tracking.";
}

async function loadRssCategory(category, urls) {
  const groups = await Promise.all(urls.map(async (url) => {
    try {
      const xml = await fetchText(url);
      const host = new URL(url).hostname.replace(/^www\./, "");
      return parseRssItems(xml, category, rssSourceName(host));
    } catch (error) {
      return [];
    }
  }));
  return groups.flat();
}

function mapNewsApiArticles(category, articles, regionalScope) {
  return (Array.isArray(articles) ? articles : []).map((item) => ({
    category,
    title: cleanText(item.title),
    snippet: compact(item.description || item.content, 190),
    url: cleanUrl(item.url),
    source: cleanText(item.source?.name || "NewsAPI source"),
    sourceApi: "NewsAPI",
    sourceApis: ["NewsAPI"],
    sourceGroup: "NewsAPI",
    sourceGroups: ["NewsAPI"],
    image: cleanUrl(item.urlToImage),
    language: "en",
    regionalScope,
    regionPriority: regionalScope === "Australia",
    publishedAt: cleanText(item.publishedAt || generatedAt)
  })).filter((item) => item.title && item.url);
}

async function loadNewsApiTopHeadlines(category, query) {
  if (!newsApiKey || !query?.newsApiAu) return [];
  const url = new URL("https://newsapi.org/v2/top-headlines");
  url.searchParams.set("country", "au");
  url.searchParams.set("q", query.newsApiAu);
  url.searchParams.set("pageSize", "20");
  if (query.newsApiCategory) {
    url.searchParams.set("category", query.newsApiCategory);
  }

  const data = await fetchJson(url, {
    headers: {
      "X-Api-Key": newsApiKey
    }
  }).catch(() => null);

  return mapNewsApiArticles(category, data?.articles, "Australia");
}

async function loadNewsApiEverything(category, query) {
  if (!newsApiKey) return [];
  if (!query?.newsApi) return [];

  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", query.newsApi);
  url.searchParams.set("searchIn", "title,description");
  url.searchParams.set("language", "en");
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", "20");

  const data = await fetchJson(url, {
    headers: {
      "X-Api-Key": newsApiKey
    }
  }).catch(() => null);

  return mapNewsApiArticles(category, data?.articles, "Global");
}

async function loadNewsApiCategory(category) {
  const query = newsQueries[category];
  if (!newsApiKey || !query) return [];

  if (query.strictAustralia) {
    return loadNewsApiTopHeadlines(category, query);
  }

  const [australia, global] = await Promise.all([
    query.prioritizeAustralia ? loadNewsApiTopHeadlines(category, query) : Promise.resolve([]),
    loadNewsApiEverything(category, query)
  ]);

  return [...australia, ...global];
}

function mapMediastackArticles(category, articles, regionalScope) {
  return (Array.isArray(articles) ? articles : []).map((item) => ({
    category,
    title: cleanText(item.title),
    snippet: compact(item.description, 190),
    url: cleanUrl(item.url),
    source: cleanText(item.source || "Mediastack source"),
    sourceApi: "Mediastack",
    sourceApis: ["Mediastack"],
    sourceGroup: "Mediastack",
    sourceGroups: ["Mediastack"],
    image: cleanUrl(item.image),
    country: cleanText(item.country),
    language: cleanText(item.language || "en"),
    regionalScope,
    regionPriority: regionalScope === "Australia",
    publishedAt: cleanText(item.published_at || generatedAt)
  })).filter((item) => item.title && item.url);
}

async function loadMediastackRequest(category, regionalScope) {
  if (!mediastackApiKey) return [];
  const query = newsQueries[category];
  if (!query?.mediastack) return [];

  const url = new URL(mediastackBaseUrl);
  url.searchParams.set("access_key", mediastackApiKey);
  url.searchParams.set("keywords", query.mediastack);
  url.searchParams.set("languages", "en");
  url.searchParams.set("limit", "20");
  url.searchParams.set("sort", "published_desc");
  if (query.mediastackCategories) {
    url.searchParams.set("categories", query.mediastackCategories);
  }
  const countries = regionalScope === "Australia" ? "au" : query.mediastackCountries;
  if (countries) {
    url.searchParams.set("countries", countries);
  }

  const data = await fetchJson(url).catch(() => null);
  return mapMediastackArticles(category, data?.data, regionalScope);
}

async function loadMediastackCategory(category) {
  const query = newsQueries[category];
  if (!mediastackApiKey || !query) return [];

  if (query.strictAustralia) {
    return loadMediastackRequest(category, "Australia");
  }

  const [australia, global] = await Promise.all([
    query.prioritizeAustralia ? loadMediastackRequest(category, "Australia") : Promise.resolve([]),
    loadMediastackRequest(category, "Global")
  ]);

  return [...australia, ...global];
}

async function loadFinnhubFinanceNews() {
  if (!finnhubApiKey) return [];
  const url = new URL("https://finnhub.io/api/v1/news");
  url.searchParams.set("category", "general");
  url.searchParams.set("token", finnhubApiKey);
  const items = await fetchJson(url).catch(() => []);
  return (Array.isArray(items) ? items : []).map((item) => ({
    category: "Finance",
    title: cleanText(item.headline),
    snippet: compact(item.summary, 190),
    url: item.url || "",
    source: cleanText(item.source || "Finnhub"),
    sourceApi: "Finnhub",
    sourceApis: ["Finnhub"],
    sourceGroup: "Finnhub",
    sourceGroups: ["Finnhub"],
    image: cleanText(item.image),
    publishedAt: item.datetime ? new Date(Number(item.datetime) * 1000).toISOString() : generatedAt
  })).filter((item) => item.title && item.url);
}

async function loadHackerNewsTechnology() {
  const storyIds = await fetchJson(`${hackerNewsBaseUrl}/topstories.json`).catch(() => []);
  if (!Array.isArray(storyIds) || !storyIds.length) return [];

  const stories = await Promise.all(storyIds.slice(0, hackerNewsCandidateLimit).map(async (id) => {
    const item = await fetchJson(`${hackerNewsBaseUrl}/item/${encodeURIComponent(id)}.json`).catch(() => null);
    if (!item || item.type !== "story" || item.deleted || item.dead || !item.title) return null;

    const discussionUrl = `https://news.ycombinator.com/item?id=${encodeURIComponent(item.id)}`;
    const points = Math.max(0, Number(item.score) || 0);
    const comments = Math.max(0, Number(item.descendants) || 0);
    const author = cleanText(item.by || "community member", 60);
    return {
      category: "Technology",
      title: cleanText(item.title),
      snippet: `${points.toLocaleString("en-AU")} points, ${comments.toLocaleString("en-AU")} comments, submitted by ${author}.`,
      url: cleanUrl(item.url) || discussionUrl,
      discussionUrl,
      source: "Hacker News",
      sourceApi: "Hacker News",
      sourceApis: ["Hacker News"],
      sourceGroup: "Hacker News",
      sourceGroups: ["Hacker News"],
      image: "",
      language: "en",
      regionalScope: "Global",
      publishedAt: item.time ? new Date(Number(item.time) * 1000).toISOString() : generatedAt,
      hackerNewsId: Number(item.id),
      hackerNewsPoints: points,
      hackerNewsComments: comments
    };
  }));

  return stories.filter(Boolean);
}

async function buildNewsItems() {
  const [
    breakingRss,
    gamingRss,
    technologyRss,
    financeRss,
    financeFinnhub,
    australiaRss,
    gamingNewsApi,
    technologyNewsApi,
    financeNewsApi,
    australiaNewsApi,
    breakingNewsApi,
    gamingMediastack,
    technologyMediastack,
    financeMediastack,
    australiaMediastack,
    breakingMediastack,
    hackerNewsTechnology
  ] = await Promise.all([
    loadRssCategory("Breaking Worldwide", configuredFeeds("Breaking Worldwide", defaultFeeds["Breaking Worldwide"])),
    loadRssCategory("Gaming", configuredFeeds("Gaming", defaultFeeds.Gaming)),
    loadRssCategory("Technology", configuredFeeds("Technology", defaultFeeds.Technology)),
    loadRssCategory("Finance", configuredFeeds("Finance", defaultFeeds.Finance)),
    loadFinnhubFinanceNews(),
    loadRssCategory("Australia", configuredFeeds("Australia", defaultFeeds.Australia)),
    loadNewsApiCategory("Gaming"),
    loadNewsApiCategory("Technology"),
    loadNewsApiCategory("Finance"),
    loadNewsApiCategory("Australia"),
    loadNewsApiCategory("Breaking Worldwide"),
    loadMediastackCategory("Gaming"),
    loadMediastackCategory("Technology"),
    loadMediastackCategory("Finance"),
    loadMediastackCategory("Australia"),
    loadMediastackCategory("Breaking Worldwide"),
    loadHackerNewsTechnology()
  ]);

  const mergedItems = mergeNewsSources([
    ...breakingRss,
    ...gamingRss,
    ...technologyRss,
    ...financeRss,
    ...financeFinnhub,
    ...australiaRss,
    ...gamingNewsApi,
    ...technologyNewsApi,
    ...financeNewsApi,
    ...australiaNewsApi,
    ...breakingNewsApi,
    ...gamingMediastack,
    ...technologyMediastack,
    ...financeMediastack,
    ...australiaMediastack,
    ...breakingMediastack,
    ...hackerNewsTechnology
  ]);

  const withScoring = mergedItems.map((item) => {
    const importance = newsImportance(item.category, item);
    const apis = apiList(item);
    const breaking = item.category === "Breaking Worldwide";
    const warArticle = breaking && isWarArticle(item);
    return {
      ...item,
      importance: warArticle ? "War / conflict" : importance.label,
      importanceScore: importance.score + (item.regionPriority ? 3 : 0) + (warArticle ? 2 : 0),
      why: item.crossReference || whyNewsMatters(item.category, item),
      sourceApi: apis.join(" + "),
      sourceApis: apis,
      affectedRegion: breaking ? inferAffectedRegion(item) : item.affectedRegion,
      isBreaking: breaking,
      isWar: warArticle,
      tags: uniqueStrings([
        ...(Array.isArray(item.tags) ? item.tags : []),
        breaking ? "Breaking" : "",
        warArticle ? "War" : ""
      ]),
      sourceGroups: uniqueStrings([
        item.sourceGroup,
        ...(Array.isArray(item.sourceGroups) ? item.sourceGroups : [])
      ])
    };
  });

  const sourceQuotas = {
    "Breaking Worldwide": { NewsAPI: 5, Mediastack: 5, RSS: 4 },
    Gaming: { NewsAPI: 4, Mediastack: 4, RSS: 4 },
    Technology: { NewsAPI: 3, Mediastack: 3, RSS: 3, "Hacker News": 3 },
    Finance: { Finnhub: 4, NewsAPI: 3, Mediastack: 3, RSS: 2 },
    Australia: { NewsAPI: 4, Mediastack: 4, RSS: 4 }
  };

  function pickCategory(category) {
    const sorted = withScoring
      .filter((item) => item.category === category)
      .sort((a, b) => b.importanceScore - a.importanceScore);
    const picked = [];
    const seen = new Set();
    const add = (item) => {
      const key = articleKey(item);
      if (picked.length >= 12 || seen.has(key)) return;
      seen.add(key);
      picked.push(item);
    };

    Object.entries(sourceQuotas[category] || {}).forEach(([api, limit]) => {
      sorted.filter((item) => sourceHas(item, api)).slice(0, limit).forEach(add);
    });
    if (category === "Technology") return picked;
    sorted.forEach(add);
    return picked;
  }

  return newsCategoryOrder.flatMap(pickCategory);
}

function fallbackNewsItems(previous) {
  return Array.isArray(previous.items) && previous.items.length ? previous.items : [];
}

function preserveMissingNewsRows(currentItems, previousItems) {
  const currentCategories = new Set(currentItems.map((item) => cleanText(item?.category || "Other")));
  const missingCategories = newsCategoryOrder.filter((category) => !currentCategories.has(category));
  const preserved = previousItems.filter((item) => missingCategories.includes(cleanText(item?.category || "Other")));
  const merged = [...currentItems, ...preserved];
  return {
    items: newsCategoryOrder.flatMap((category) => merged.filter((item) => item.category === category)),
    preservedCategories: missingCategories.filter((category) => preserved.some((item) => item.category === category))
  };
}

async function main() {
  const [previousMarket, previousNews] = await Promise.all([
    readExisting(marketOutputPath),
    readExisting(newsOutputPath)
  ]);

  const yfinanceQuotes = await loadYfinanceQuotes(quoteTargets);
  const quoteItems = await Promise.all(quoteTargets.map((target) => buildQuoteItem(target, yfinanceQuotes).catch(() => null)));
  const indexes = quoteItems.filter((item, index) => item && quoteTargets[index].type === "index");
  const stocks = quoteItems.filter((item, index) => item && quoteTargets[index].type !== "index");
  const signals = buildMarketSignals(indexes, stocks);
  const newsItems = await buildNewsItems().catch((error) => {
    console.warn(`News refresh failed before fallback: ${cleanText(error.message || "unknown error")}`);
    return fallbackNewsItems(previousNews);
  });
  const previousNewsItems = fallbackNewsItems(previousNews);
  const mergedNewsRows = preserveMissingNewsRows(newsItems, previousNewsItems);
  const outputNewsItems = mergedNewsRows.items.length ? mergedNewsRows.items : previousNewsItems;
  const newsUsingSnapshot = mergedNewsRows.preservedCategories.length > 0 || (!newsItems.length && outputNewsItems.length > 0);

  const marketOutput = {
    generatedAt,
    source: finnhubApiKey ? "finnhub-yfinance-cross-reference" : "yfinance-fallback",
    status: finnhubApiKey
      ? "Market data refreshed with Finnhub quotes and yfinance cross-reference."
      : "Add FINNHUB_API_KEY to GitHub Actions for Finnhub quotes/news. yfinance was used as the stock fallback.",
    disclaimer:
      "Educational research only, not personal financial advice. Signals are prompts to investigate risk, momentum, valuation, and news before making any decision.",
    indexes: indexes.length ? indexes : previousMarket.indexes || [],
    stocks: stocks.length ? stocks : previousMarket.stocks || [],
    signals: signals.length ? signals : previousMarket.signals || []
  };

  const newsOutput = {
    generatedAt,
    source: [
      finnhubApiKey ? "Finnhub" : "",
      newsApiKey ? "NewsAPI" : "",
      mediastackApiKey ? "Mediastack" : "",
      outputNewsItems.some((item) => item.sourceGroup === "Hacker News") ? "Hacker News" : "",
      "RSS"
    ].filter(Boolean).join(" + "),
    stale: newsUsingSnapshot,
    lastGoodAt: newsItems.length ? generatedAt : previousNews.lastGoodAt || previousNews.generatedAt || null,
    status: newsItems.length && !newsUsingSnapshot
      ? "News refreshed, cross-referenced, and ranked into breaking worldwide, gaming, technology, finance, and Australia rows."
      : newsItems.length && newsUsingSnapshot
        ? `News refreshed with the last saved ${mergedNewsRows.preservedCategories.join(", ")} row${mergedNewsRows.preservedCategories.length === 1 ? "" : "s"} preserved while its source catches up.`
      : newsUsingSnapshot
        ? "News refresh did not return articles. Showing the last saved RSS/API snapshot while GitHub refresh catches up."
        : "News refresh did not return articles. Showing saved values when available.",
    items: outputNewsItems
  };

  await Promise.all([
    writeJson(marketOutputPath, marketOutput),
    writeJson(newsOutputPath, newsOutput)
  ]);
  console.log(`Wrote ${marketOutput.indexes.length} index rows, ${marketOutput.stocks.length} stock rows, and ${newsOutput.items.length} news items.`);
}

main().catch(async (error) => {
  const [previousMarket, previousNews] = await Promise.all([
    readExisting(marketOutputPath),
    readExisting(newsOutputPath)
  ]);

  await Promise.all([
    writeJson(marketOutputPath, {
      ...previousMarket,
      generatedAt,
      stale: true,
      status: `Market refresh failed: ${cleanText(error.message || "unknown error")}. Showing saved values when available.`
    }),
    writeJson(newsOutputPath, {
      ...previousNews,
      generatedAt,
      stale: true,
      status: `News refresh failed: ${cleanText(error.message || "unknown error")}. Showing saved values when available.`
    })
  ]);
  console.error(error);
});
