import { mkdir, readFile, writeFile } from "node:fs/promises";

const outputPath = new URL("../data/release-calendar.json", import.meta.url);
const allowedHosts = new Set(["callofduty.com", "www.callofduty.com", "gamescom.global", "www.gamescom.global", "fortnite.com", "www.fortnite.com", "store.steampowered.com", "youtube.com", "www.youtube.com", "x.com", "www.x.com", "detonated.com", "www.detonated.com"]);
const fetchableHosts = new Set(["callofduty.com", "www.callofduty.com", "gamescom.global", "www.gamescom.global", "fortnite.com", "www.fortnite.com", "store.steampowered.com"]);
const timeoutMs = 18_000;
const socialCacheMs = 60 * 60 * 1_000;
const socialWatchBatchSize = 4;
const ensembleDataRoot = "https://ensembledata.com/apis";

// These are official, allowlisted seeds. The Call of Duty blog index is also scanned for
// relevant new MW4 posts, but no external giveaway or reseller pages are ever imported.
const sourceSeeds = [
  {
    title: "Call of Duty: MW4 NEXT early intel and PC specs",
    url: "https://www.callofduty.com/au/en/blog/2026/08/call-of-duty-modern-warfare-4-next-early-intel-pc-specs"
  },
  {
    title: "Call of Duty: MW4 beta and NEXT intel",
    url: "https://www.callofduty.com/blog/2026/07/call-of-duty-modern-warfare-4-open-beta-next-fanatics-fest-recap-serialized-camo-preorder-bonus"
  },
  {
    title: "Call of Duty: official MW4 beta page",
    url: "https://www.callofduty.com/uk/en/modernwarfare4/beta?path=beta"
  },
  {
    title: "gamescom live events",
    url: "https://www.gamescom.global/en/live/events"
  }
];

const fallbackEvents = [
  {
    id: "cod-next-2026",
    title: "Call of Duty: NEXT",
    game: "Modern Warfare 4",
    type: "showcase",
    startDate: "2026-08-21T00:00:00+10:00",
    timezone: "AEST",
    summary: "Official Modern Warfare 4 reveal briefing before the beta.",
    details: "Call of Duty's verified presentation covers gameplay, developer insight, Multiplayer, and beta information.",
    maps: ["Official Multiplayer map briefing", "Zodiac first-look coverage when confirmed"],
    modes: ["6v6 Multiplayer", "Kill Block gameplay"],
    rewards: ["Watch verified Call of Duty broadcasts for any announced drops or code windows."],
    access: ["Use official Call of Duty channels only for beta access information."],
    links: [{ label: "Official NEXT and beta intel", url: sourceSeeds[1].url, official: true }]
  },
  {
    id: "mw4-early-beta-2026",
    title: "MW4 Early Access Beta",
    game: "Call of Duty: Modern Warfare 4",
    type: "beta",
    startDate: "2026-08-21T00:00:00+10:00",
    endDate: "2026-08-25T23:59:00+10:00",
    timezone: "AEST",
    summary: "Early access beta weekend for eligible pre-orders.",
    details: "The official beta page remains the source of truth for platform access and local timings.",
    maps: ["Multiple Multiplayer maps"],
    modes: ["Search & Destroy", "Kill Block", "3v3 skirmishes", "Training Mobility Course"],
    rewards: ["Check the official beta briefing for participation and edition benefits."],
    access: ["Eligible pre-order access on supported platforms."],
    links: [{ label: "Official beta page", url: sourceSeeds[2].url, official: true }]
  },
  {
    id: "mw4-open-beta-2026",
    title: "MW4 Open Beta",
    game: "Call of Duty: Modern Warfare 4",
    type: "beta",
    startDate: "2026-08-28T00:00:00+10:00",
    endDate: "2026-09-01T23:59:00+10:00",
    timezone: "AEST",
    summary: "Open beta weekend across the officially announced platforms.",
    details: "No unverified code page is needed for the open portion. Check the official beta page before downloading.",
    maps: ["Early-access maps", "Additional content confirmed at NEXT"],
    modes: ["Multiplayer playlists", "Open-beta playlist updates"],
    rewards: ["Any participation rewards are announced by Call of Duty."],
    access: ["Open to supported platforms; follow the official beta page."],
    links: [{ label: "Official open-beta details", url: sourceSeeds[2].url, official: true }]
  },
  {
    id: "gamescom-2026",
    title: "gamescom 2026",
    game: "Industry showcase",
    type: "convention",
    startDate: "2026-08-25T00:00:00+02:00",
    endDate: "2026-08-30T23:59:00+02:00",
    timezone: "CEST",
    summary: "Opening Night Live followed by the Cologne industry showcase.",
    details: "A major official games showcase for publisher reveals, hands-on demos, and live streams.",
    maps: ["Show floor and publisher reveals"],
    modes: ["Opening Night Live", "Hands-on demos", "Developer sessions"],
    rewards: ["Check verified publisher channels for event-specific drops or demos."],
    access: ["Follow the official gamescom schedule."],
    links: [{ label: "Official gamescom events", url: sourceSeeds[3].url, official: true }]
  },
  {
    id: "codm-season-6-to-7-2026",
    title: "COD Mobile: Season 6 to Season 7",
    game: "Call of Duty: Mobile",
    type: "season",
    startDate: "2026-08-06T10:00:00+10:00",
    timezone: "AEST",
    summary: "Season 7: Terminated takes over from Season 6, with a Terminator 2 collaboration.",
    details: "Season 7 launched at 5 PM Pacific on 5 August. The new season adds Multiplayer and Battle Royale content, a Nuketown refresh, a new Battle Pass, and seasonal events.",
    maps: ["Nuketown map refresh"],
    modes: ["Operator Skill Overdrive", "Hardpoint: Mayhem", "Battle Royale: Lockdown"],
    rewards: ["Terminated Battle Pass", "Season 7 Challenge Pass", "Cronen Squall Assault Rifle", "Overload Battle Royale class"],
    access: ["Available through Call of Duty: Mobile."],
    links: [{ label: "Official Season 7 briefing", url: "https://www.callofduty.com/au/en/blog/2026/07/call-of-duty-mobile-season-7-terminated", official: true }]
  },
  {
    id: "fortnite-season-watch",
    title: "Fortnite Season Transition Watch",
    game: "Fortnite",
    type: "season",
    summary: "Monitoring Epic's official newsroom for the next confirmed season handover.",
    details: "This card stays on watch until Epic publishes a start or end time. Rumours and unverified social posts are not used as calendar dates.",
    maps: ["Map changes will be listed after Epic confirms them."],
    modes: ["Playlist changes will be listed after Epic confirms them."],
    rewards: ["Battle Pass and event rewards will be listed after Epic confirms them."],
    access: ["Follow the official Fortnite news channel for the confirmed schedule."],
    links: [{ label: "Official Fortnite news", url: "https://www.fortnite.com/news", official: true }]
  },
  {
    id: "bo7-warzone-season-05-2026",
    title: "Black Ops 7 + Warzone Season 05",
    game: "Call of Duty: Black Ops 7 and Warzone",
    type: "season",
    startDate: "2026-07-24T02:00:00+10:00",
    timezone: "AEST",
    summary: "Season 05 launch briefing for Black Ops 7 and Warzone.",
    details: "Season 05 launched at 9 AM Pacific on 23 July, with new Multiplayer, Zombies, Endgame, Warzone, and Battle Pass content.",
    maps: ["Jubilee Multiplayer map", "Eidskallen Lighthouse Zombies Survival map", "Drone Labs POI on Verdansk"],
    modes: ["Burn Run Endgame Assignment", "Resurgence Ranked Play", "New Warzone modes"],
    rewards: ["Season 05 Battle Pass", "100+ Battle Pass rewards", "FG42 Assault Rifle", "Gremlin SMG", "BlackCell rewards"],
    access: ["Battle Pass is available for 1,100 COD Points; the Battle Pass Bundle is 2,400 COD Points."],
    links: [{ label: "Official Season 05 briefing", url: "https://www.callofduty.com/blog/2026/07/call-of-duty-black-ops-7-warzone-season-05-announcement", official: true }]
  },
  {
    id: "bo7-warzone-season-06-watch",
    title: "Black Ops 7 + Warzone Season 06 Watch",
    game: "Call of Duty: Black Ops 7 and Warzone",
    type: "season",
    summary: "Monitoring official Call of Duty channels for the Season 05 handover and Season 06 launch order.",
    details: "This is a watch card until Call of Duty confirms the date, maps, modes, Battle Pass, and rewards. It will not turn rumours into calendar facts.",
    maps: ["Awaiting official Season 06 confirmation."],
    modes: ["Awaiting official Season 06 confirmation."],
    rewards: ["Awaiting official Battle Pass and reward confirmation."],
    access: ["Follow official Black Ops 7 and Warzone news."],
    links: [{ label: "Official Black Ops 7 news", url: "https://www.callofduty.com/au/en/blog/blackops7", official: true }]
  }
];

function cleanText(value, maxLength = 360) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function ensureOfficialUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname)) throw new Error(`Blocked non-official source: ${url.hostname}`);
  return url;
}

function htmlToText(html) {
  return cleanText(String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"'));
}

async function fetchOfficialHtml(url) {
  const safeUrl = ensureOfficialUrl(url);
  if (!fetchableHosts.has(safeUrl.hostname)) throw new Error(`Link-only official source: ${safeUrl.hostname}`);
  const response = await fetch(safeUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "EchoOps-Portfolio-Release-Radar/1.0 (+https://silvaops-orbit.github.io/online-portfolio/)"
    },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`${safeUrl.hostname} returned ${response.status}`);
  return response.text();
}

async function fetchOfficial(url) {
  return htmlToText(await fetchOfficialHtml(url));
}

function discoverCallOfDutyPosts(html) {
  const seen = new Set();
  const matches = String(html || "").matchAll(/href=["']([^"']+)["']/gi);
  for (const match of matches) {
    try {
      const url = new URL(match[1].replace(/&amp;/g, "&"), "https://www.callofduty.com/au/en/blog/");
      const path = url.pathname.toLowerCase();
      if (!allowedHosts.has(url.hostname) || !/\/blog\/2026\//.test(path)) continue;
      if (!/(modern-warfare-4|mw4|beta|call-of-duty-next)/.test(path)) continue;
      seen.add(url.toString());
    } catch {
      // Ignore malformed markup: source discovery is optional and never broadens the allowlist.
    }
  }
  return [...seen].slice(0, 8).map((url) => ({ title: "Call of Duty blog update", url }));
}

function includesAny(text, terms) {
  return terms.some((term) => text.toLowerCase().includes(term.toLowerCase()));
}

function onlyConfirmed(text, values) {
  return values.filter((value) => includesAny(text, [value]));
}

function buildEvents(textByUrl) {
  const codText = [...textByUrl.entries()]
    .filter(([url]) => url.includes("callofduty.com"))
    .map(([, text]) => text)
    .join(" ");
  const gamescomText = [...textByUrl.entries()]
    .filter(([url]) => url.includes("gamescom"))
    .map(([, text]) => text)
    .join(" ");
  const events = structuredClone(fallbackEvents);
  const early = events.find((event) => event.id === "mw4-early-beta-2026");
  const open = events.find((event) => event.id === "mw4-open-beta-2026");
  const next = events.find((event) => event.id === "cod-next-2026");
  const gamescom = events.find((event) => event.id === "gamescom-2026");

  if (early && codText) {
    early.maps = onlyConfirmed(codText, ["Zodiac", "Multiple Multiplayer maps", "Multiplayer maps"]);
    early.modes = onlyConfirmed(codText, ["Search & Destroy", "Kill Block", "3v3", "Training Mobility Course", "6v6"]);
    early.rewards = onlyConfirmed(codText, ["Vault Edition Operators", "Serialized Camo", "beta rewards"]);
    if (!early.maps.length) early.maps = ["Official map details are still being confirmed."];
    if (!early.modes.length) early.modes = ["Official playlist details are still being confirmed."];
    if (!early.rewards.length) early.rewards = ["No specific reward was confirmed in the latest official briefing."];
  }
  if (open && codText) {
    open.maps = onlyConfirmed(codText, ["Zodiac", "Multiplayer maps", "additional maps"]);
    open.modes = onlyConfirmed(codText, ["Search & Destroy", "Kill Block", "3v3", "6v6"]);
    open.rewards = onlyConfirmed(codText, ["Vault Edition Operators", "Serialized Camo", "beta rewards"]);
    if (!open.maps.length) open.maps = ["Open-beta content will be confirmed on the official beta page."];
    if (!open.modes.length) open.modes = ["Open-beta playlist details will be confirmed by Call of Duty."];
    if (!open.rewards.length) open.rewards = ["No specific open-beta reward was confirmed in the latest official briefing."];
  }
  if (next && codText) {
    next.maps = onlyConfirmed(codText, ["Zodiac", "Multiplayer maps"]);
    next.modes = onlyConfirmed(codText, ["6v6", "Kill Block", "Search & Destroy"]);
    next.rewards = onlyConfirmed(codText, ["Serialized Camo", "Vault Edition Operators", "beta rewards"]);
    if (!next.maps.length) next.maps = ["Official map briefing at NEXT."];
    if (!next.modes.length) next.modes = ["Official gameplay briefing at NEXT."];
    if (!next.rewards.length) next.rewards = ["Watch verified Call of Duty channels for announced drops or access windows."];
  }
  if (gamescom && gamescomText && !includesAny(gamescomText, ["2026"])) {
    gamescom.summary = "Official gamescom event details are being rechecked.";
  }
  return events;
}

async function readExisting() {
  try {
    return JSON.parse(await readFile(outputPath, "utf8"));
  } catch {
    return null;
  }
}

async function readSourceRegistry() {
  try {
    const payload = JSON.parse(await readFile(new URL("../data/release-source-registry.json", import.meta.url), "utf8"));
    return {
      profiles: Array.isArray(payload?.profiles) ? payload.profiles : [],
      socialWatchlist: Array.isArray(payload?.socialWatchlist) ? payload.socialWatchlist : []
    };
  } catch {
    return { profiles: [], socialWatchlist: [] };
  }
}

function matchingProfile(event, profiles) {
  const haystack = `${event.title || ""} ${event.game || ""}`.toLowerCase();
  return profiles.find((profile) => Array.isArray(profile?.keywords)
    && profile.keywords.some((keyword) => haystack.includes(String(keyword).toLowerCase())));
}

function attachOfficialProfileLinks(events, profiles) {
  return events.map((event) => {
    const profile = matchingProfile(event, profiles);
    if (!profile?.links) return event;
    const existing = Array.isArray(event.links) ? event.links : [];
    const additions = profile.links.filter((link) => {
      try {
        const url = ensureOfficialUrl(link?.url).toString();
        return !existing.some((item) => item?.url === url);
      } catch {
        return false;
      }
    });
    return { ...event, links: [...existing, ...additions] };
  });
}

function listFromUnknown(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.tweets)) return value.tweets;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.entries)) return value.entries;
  return [];
}

function socialUserId(payload) {
  const data = payload?.data ?? payload;
  const user = data?.user ?? data?.data?.user ?? data;
  return String(user?.id_str || user?.id || user?.rest_id || "").trim();
}

function socialPostText(post) {
  return cleanText(post?.full_text || post?.text || post?.legacy?.full_text || post?.tweet?.full_text || post?.tweet?.text, 800);
}

function socialPostId(post) {
  return String(post?.id_str || post?.id || post?.rest_id || post?.tweet?.id_str || post?.tweet?.id || "").trim();
}

async function fetchEnsembleData(path, params) {
  const url = new URL(`${ensembleDataRoot}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "EchoOps-Portfolio-Release-Radar/1.0" },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`EnsembleData returned ${response.status}`);
  return response.json();
}

function selectRotatingWatchEntries(profiles, watchlist) {
  const mandatory = profiles.filter((profile) => Array.isArray(profile?.socialHandles) && profile.socialHandles.length);
  const optional = watchlist.filter((profile) => Array.isArray(profile?.socialHandles) && profile.socialHandles.length);
  if (!optional.length) return mandatory;
  const cycle = Math.floor(Date.now() / socialCacheMs);
  const start = (cycle * socialWatchBatchSize) % optional.length;
  const rotated = Array.from({ length: Math.min(socialWatchBatchSize, optional.length) }, (_, index) => optional[(start + index) % optional.length]);
  return [...mandatory, ...rotated];
}

async function readOfficialSocialSignals(profiles, watchlist, existing) {
  const token = String(process.env.ENSEMBLEDATA_API_KEY || "").trim();
  const cached = existing?.socialSignals;
  const cachedAt = Date.parse(cached?.checkedAt || "");
  if (!token) return cached || { checkedAt: null, status: "Official X monitoring is ready when ENSEMBLEDATA_API_KEY is configured.", posts: [] };
  if (Number.isFinite(cachedAt) && Date.now() - cachedAt < socialCacheMs) return cached;

  const posts = [];
  const entries = selectRotatingWatchEntries(profiles, watchlist);
  for (const profile of entries) {
    const handles = Array.isArray(profile?.socialHandles) ? profile.socialHandles.slice(0, 3) : [];
    for (const handle of handles) {
      const safeHandle = String(handle || "").replace(/^@/, "").trim();
      if (!/^[A-Za-z0-9_]{1,15}$/.test(safeHandle)) continue;
      try {
        const user = await fetchEnsembleData("/twitter/user/info", { name: safeHandle, token });
        const id = socialUserId(user);
        if (!id) throw new Error("No public X user ID returned");
        const response = await fetchEnsembleData("/twitter/user/tweets", { id, token });
        const candidates = listFromUnknown(response?.data ?? response).slice(0, 20);
        for (const post of candidates) {
          const postId = socialPostId(post);
          const text = socialPostText(post);
          if (!postId || !text) continue;
          posts.push({ profileId: profile.id, handle: safeHandle, postId, text, url: `https://x.com/${safeHandle}/status/${postId}` });
        }
      } catch (error) {
        console.warn(`Could not refresh official X account @${safeHandle}: ${cleanText(error.message, 140)}`);
      }
    }
  }
  return {
    checkedAt: new Date().toISOString(),
    status: posts.length ? `${posts.length} public posts checked from ${entries.length} allowlisted official X accounts.` : "No usable official X posts were returned; official web sources remain active.",
    posts
  };
}

function attachOfficialSocialLinks(events, profiles, socialSignals) {
  const posts = Array.isArray(socialSignals?.posts) ? socialSignals.posts : [];
  return events.map((event) => {
    const profile = matchingProfile(event, profiles);
    if (!profile) return event;
    const terms = [event.title, event.game, ...(profile.keywords || [])].map((term) => String(term || "").toLowerCase()).filter(Boolean);
    const post = posts.find((candidate) => candidate.profileId === profile.id
      && terms.some((term) => term.length > 3 && candidate.text.toLowerCase().includes(term)));
    if (!post) return event;
    const links = Array.isArray(event.links) ? event.links : [];
    if (links.some((link) => link?.url === post.url)) return event;
    return {
      ...event,
      links: [...links, { label: `Official social update from @${post.handle}`, url: post.url, official: true }]
    };
  });
}

function publicSocialSignals(socialSignals) {
  return {
    checkedAt: socialSignals?.checkedAt || null,
    status: cleanText(socialSignals?.status, 260),
    posts: (Array.isArray(socialSignals?.posts) ? socialSignals.posts : []).map(({ profileId, handle, postId, url }) => ({
      profileId,
      handle,
      postId,
      url
    }))
  };
}

const existing = await readExisting();
const checkedAt = new Date().toISOString();
const textByUrl = new Map();
const sources = [];
const candidates = [...sourceSeeds];
const sourceRegistry = await readSourceRegistry();
const sourceProfiles = sourceRegistry.profiles;
const socialSignals = await readOfficialSocialSignals(sourceProfiles, sourceRegistry.socialWatchlist, existing);
const safeSocialSignals = publicSocialSignals(socialSignals);

for (const profile of sourceProfiles) {
  for (const url of Array.isArray(profile?.feeds) ? profile.feeds : []) {
    try {
      const safeUrl = ensureOfficialUrl(url).toString();
      if (!candidates.some((candidate) => candidate.url === safeUrl)) {
        candidates.push({ title: `${cleanText(profile?.id, 60) || "Studio"} official update`, url: safeUrl });
      }
    } catch {
      console.warn(`Skipped invalid source profile link for ${cleanText(profile?.id, 60) || "studio"}.`);
    }
  }
}

try {
  const blogIndex = await fetchOfficialHtml("https://www.callofduty.com/au/en/blog/");
  for (const post of discoverCallOfDutyPosts(blogIndex)) {
    if (!candidates.some((candidate) => candidate.url === post.url)) candidates.push(post);
  }
} catch (error) {
  console.warn(`Could not search the official Call of Duty blog index: ${cleanText(error.message, 140)}`);
}

for (const seed of candidates) {
  try {
    const text = await fetchOfficial(seed.url);
    textByUrl.set(seed.url, text);
    sources.push({ ...seed, official: true, checkedAt });
  } catch (error) {
    console.warn(`Could not refresh ${seed.title}: ${cleanText(error.message, 140)}`);
  }
}

try {
  if (!textByUrl.size) throw new Error("No official release source was reachable");
  const snapshot = {
    schemaVersion: 1,
    generatedAt: checkedAt,
    lastGoodAt: checkedAt,
    stale: false,
    status: `${sources.length} official web sources checked. ${socialSignals.status} Only confirmed details and official access links are shown.`,
    sources,
    socialSignals: safeSocialSignals,
    events: attachOfficialSocialLinks(attachOfficialProfileLinks(buildEvents(textByUrl), sourceProfiles), sourceProfiles, socialSignals)
  };
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Updated data/release-calendar.json from ${sources.length} official sources.`);
} catch (error) {
  const fallback = Array.isArray(existing?.events) && existing.events.length ? existing.events : fallbackEvents;
  const snapshot = {
    schemaVersion: 1,
    generatedAt: existing?.generatedAt || checkedAt,
    lastGoodAt: existing?.lastGoodAt || existing?.generatedAt || checkedAt,
    stale: true,
    status: `Last good official briefing preserved while refresh retries: ${cleanText(error.message, 160)}`,
    sources: existing?.sources || sourceSeeds.map((source) => ({ ...source, official: true })),
    socialSignals: safeSocialSignals,
    events: attachOfficialSocialLinks(attachOfficialProfileLinks(fallback, sourceProfiles), sourceProfiles, socialSignals)
  };
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.warn(snapshot.status);
}
