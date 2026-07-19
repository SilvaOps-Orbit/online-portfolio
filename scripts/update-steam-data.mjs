import { mkdir, readFile, writeFile } from "node:fs/promises";
import { stripPriceText } from "./text-sanitizer.mjs";

const steamId = process.env.STEAM_ID || "76561199192411740";
const apiKey = process.env.STEAM_API_KEY || "";
const accountValue = process.env.STEAM_ACCOUNT_VALUE || process.env.STEAMDB_ACCOUNT_VALUE || "";
const achievementScanLimit = Number(process.env.STEAM_ACHIEVEMENT_SCAN_LIMIT || 0);
const achievementOutputLimit = Number(process.env.STEAM_ACHIEVEMENT_OUTPUT_LIMIT || 0);
const storeCountry = process.env.STEAM_STORE_COUNTRY || "AU";
const steamDbUrl = `https://steamdb.info/calculator/${steamId}/`;
const profileUrl = `https://steamcommunity.com/profiles/${steamId}`;
const outputPath = new URL("../data/steam.json", import.meta.url);

function gameUrl(appid) {
  return `https://store.steampowered.com/app/${appid}/`;
}

function headerImage(appid) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

function storeItemUrl(appid) {
  return `https://store.steampowered.com/app/${appid}/`;
}

function formatHours(minutes) {
  const hours = Math.round(Number(minutes || 0) / 60);
  if (hours >= 1000) {
    return `${new Intl.NumberFormat("en-US").format(hours)} hrs`;
  }
  return `${hours} hrs`;
}

function formatDate(timestamp) {
  if (!timestamp) return "";
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(new Date(timestamp * 1000));
}

function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours && minutes) {
    return `${hours}h ${minutes}m`;
  }

  if (hours) {
    return `${hours}h`;
  }

  if (minutes) {
    return `${minutes}m`;
  }

  return "just started";
}

function formatPrice(value, currency) {
  if (value === undefined || value === null || value === "") {
    return "Price TBA";
  }

  const numericValue = Number(value);
  if (!numericValue) {
    return "Free";
  }

  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: currency || "AUD"
    }).format(numericValue / 100);
  } catch (error) {
    return `${currency || "AUD"} ${(numericValue / 100).toFixed(2)}`;
  }
}

function normalizeSteamImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  return value
    .trim()
    .replace(/^http:\/\//i, "https://")
    .replace("shared.akamai.steamstatic.com", "shared.fastly.steamstatic.com");
}

function editionLabel(sub, group) {
  const primary = stripPriceText(sub.name || sub.option_text || "");
  const fallback = stripPriceText(group.title || "");
  return (primary || fallback || "Edition").replace(/^(buy|purchase)\s+/i, "").trim() || "Edition";
}

function shuffleItems(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

async function readExistingData() {
  try {
    return JSON.parse(await readFile(outputPath, "utf8"));
  } catch (error) {
    return {};
  }
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Alvis Leslie Gordon portfolio Steam data updater"
    }
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Expected JSON response for ${url}`);
  }

  return response.json();
}

async function steamApi(path, params) {
  const url = new URL(`https://api.steampowered.com/${path}`);
  Object.entries({ key: apiKey, format: "json", ...params }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return fetchJson(url);
}

function toGame(item, note) {
  return {
    appid: item.appid,
    title: item.name || item.title || "Untitled game",
    meta: item.playtime_forever !== undefined ? formatHours(item.playtime_forever) : item.meta,
    note,
    image: item.appid ? headerImage(item.appid) : item.image,
    url: item.appid ? gameUrl(item.appid) : item.url
  };
}

function toRecentGame(game) {
  return {
    ...toGame(game, `${formatHours(game.playtime_forever)} total`),
    meta: "Recently played",
    note: game.playtime_2weeks ? `${formatHours(game.playtime_2weeks)} in the last 2 weeks` : `${formatHours(game.playtime_forever)} total`,
    playtimeForeverMinutes: Number(game.playtime_forever || 0)
  };
}

function toStoreHighlight(item, category) {
  const appid = item.id || item.appid || item.steam_appid;
  const price = formatPrice(item.final_price, item.currency);
  const discount = Number(item.discount_percent || 0);

  return {
    appid,
    title: item.name || "Steam game",
    category,
    price,
    originalPrice: discount ? formatPrice(item.original_price, item.currency) : "",
    discount,
    tag: category,
    image: normalizeSteamImageUrl(item.header_image || item.large_capsule_image || item.small_capsule_image || item.capsule_image || (appid ? headerImage(appid) : "")),
    url: appid ? storeItemUrl(appid) : "https://store.steampowered.com/"
  };
}

function priceOverviewText(priceOverview) {
  if (!priceOverview) {
    return {
      price: "Price TBA",
      originalPrice: "",
      discount: 0
    };
  }

  const discount = Number(priceOverview.discount_percent || 0);
  return {
    price: priceOverview.final_formatted || formatPrice(priceOverview.final, priceOverview.currency),
    originalPrice: discount ? priceOverview.initial_formatted || formatPrice(priceOverview.initial, priceOverview.currency) : "",
    discount
  };
}

function extractEditions(details) {
  const currency = details?.price_overview?.currency || "AUD";
  const seen = new Set();
  const editions = [];

  (details?.package_groups || []).forEach((group) => {
    (group.subs || []).forEach((sub) => {
      const label = editionLabel(sub, group);
      const price = sub.price_in_cents_with_discount !== undefined
        ? formatPrice(sub.price_in_cents_with_discount, currency)
        : sub.is_free_license
          ? "Free"
          : "";
      const key = `${label.toLowerCase()}|${price}`;
      if (!label || seen.has(key)) {
        return;
      }

      seen.add(key);
      editions.push({
        label,
        price
      });
    });
  });

  return editions.slice(0, 4);
}

async function loadAppDetails(appid) {
  if (!appid) {
    return null;
  }

  try {
    const data = await fetchJson(`https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(appid)}&cc=${encodeURIComponent(storeCountry)}&l=en`);
    const record = data?.[appid];
    return record?.success ? record.data : null;
  } catch (error) {
    return null;
  }
}

async function enrichGameArtwork(items = []) {
  return Promise.all(items.map(async (item) => {
    if (!item?.appid) return item;
    const details = await loadAppDetails(item.appid);
    return {
      ...item,
      image: normalizeSteamImageUrl(details?.header_image || details?.capsule_image || item.image || headerImage(item.appid))
    };
  }));
}

async function enrichStoreWatchItem(item) {
  const details = await loadAppDetails(item.appid);
  if (!details) {
    return item;
  }

  const pricing = priceOverviewText(details.price_overview);
  const editions = extractEditions(details);
  const price = pricing.price !== "Price TBA" ? pricing.price : editions[0]?.price || item.price || "Price TBA";

  return {
    ...item,
    title: details.name || item.title,
    price,
    originalPrice: pricing.originalPrice || item.originalPrice || "",
    discount: pricing.discount || item.discount || 0,
    image: normalizeSteamImageUrl(details.header_image || details.capsule_image || item.image || (item.appid ? headerImage(item.appid) : "")),
    editions,
    note: editions.length
      ? `Store page lists ${editions.length} edition${editions.length === 1 ? "" : "s"}.`
      : item.note
  };
}

async function toStoreWatchItem(item, category, note) {
  const highlight = toStoreHighlight(item, category);

  return enrichStoreWatchItem({
    ...highlight,
    meta: category,
    note: note || `${highlight.price} on Steam`
  });
}

async function loadStoreCollections() {
  try {
    const data = await fetchJson(`https://store.steampowered.com/api/featuredcategories?cc=${encodeURIComponent(storeCountry)}&l=en`);
    const sources = [
      ["Special", data.specials?.items || []],
      ["Coming Soon", data.coming_soon?.items || []],
      ["Top Seller", data.top_sellers?.items || []],
      ["New Release", data.new_releases?.items || []]
    ];
    const seen = new Set();
    const items = [];

    sources.forEach(([category, list]) => {
      list.forEach((item) => {
        const appid = item?.id || item?.appid || item?.steam_appid;
        if (!appid || seen.has(appid) || items.length >= 24) {
          return;
        }

        seen.add(appid);
        items.push(toStoreHighlight(item, category));
      });
    });

    const watchSeeds = [];
    const watchSeen = new Set();
    const addWatchItem = (item, category, note) => {
      const appid = item?.id || item?.appid || item?.steam_appid;
      if (!appid || watchSeen.has(appid)) {
        return;
      }

      watchSeen.add(appid);
      watchSeeds.push({ item, category, note });
    };

    (data.coming_soon?.items || []).slice(0, 20).forEach((item) => {
      addWatchItem(item, "Pre-order", "Upcoming on Steam. Open the store page for release/pre-order details.");
    });

    (data.top_sellers?.items || []).slice(0, 20).forEach((item, index) => {
      addWatchItem(item, "Top 20", `Top seller #${index + 1} on Steam right now.`);
    });

    if (!watchSeeds.length) {
      const fallback = (data.specials?.items || data.new_releases?.items || []).find((item) => item?.id);
      if (fallback) {
        addWatchItem(fallback, "Popular now", "No pre-order or top 20 entries were returned, so this shows a popular Steam game.");
      }
    }

    const preorderWatch = await Promise.all(
      shuffleItems(watchSeeds).map(({ item, category, note }) => toStoreWatchItem(item, category, note))
    );

    return {
      storeHighlights: items,
      preorderWatch
    };
  } catch (error) {
    return {
      storeHighlights: [],
      preorderWatch: []
    };
  }
}

function withLastValues(output, previous) {
  const result = { ...output };
  const arrayKeys = ["currentlyPlaying", "mostPlayed", "achievements", "completedGames", "storeHighlights", "preorderWatch"];

  arrayKeys.forEach((key) => {
    if ((!Array.isArray(result[key]) || !result[key].length) && Array.isArray(previous[key]) && previous[key].length) {
      result[key] = previous[key];
      result.stale = true;
    }
  });

  ["profile", "accountValue"].forEach((key) => {
    if (!result[key] && previous[key]) {
      result[key] = previous[key];
      result.stale = true;
    }
  });

  if (!result.replay && previous.replay) {
    result.replay = previous.replay;
  }

  if (previous.insights) {
    if (!result.insights) {
      result.insights = previous.insights;
      result.stale = true;
    } else {
      ["ownedGames", "recentGames", "genreMix", "playstyle", "rareAchievements", "dlcHeavyGames"].forEach((key) => {
        if (!result.insights[key]?.length && previous.insights[key]?.length) {
          result.insights[key] = previous.insights[key];
        }
      });
      result.insights.metadataSampleSize ||= previous.insights.metadataSampleSize;
      result.insights.availableDlcCount ||= previous.insights.availableDlcCount;
      result.insights.averageHoursPerGame ||= previous.insights.averageHoursPerGame;
      result.insights.deepDiveGames ||= previous.insights.deepDiveGames;
      result.insights.lowPlaytimeGames ||= previous.insights.lowPlaytimeGames;
    }
  }

  if ((!Array.isArray(result.stats) || !result.stats.length) && Array.isArray(previous.stats) && previous.stats.length) {
    result.stats = previous.stats;
    result.stale = true;
  }

  if (result.source === "steam-web-api") {
    result.lastGoodAt = result.generatedAt;
    result.stale = false;
  } else if (previous.lastGoodAt || previous.generatedAt) {
    result.lastGoodAt = previous.lastGoodAt || previous.generatedAt;
    result.stale = true;
  }

  if (result.stale) {
    result.status = result.lastGoodAt
      ? `Showing last saved Steam values from ${result.lastGoodAt}.`
      : "Steam could not refresh right now, so saved values are being shown.";
  } else if (result.source === "steam-web-api") {
    result.status = "Steam data refreshed successfully.";
  } else if (!result.status) {
    result.status = apiKey ? "Steam could not refresh right now." : "Add STEAM_API_KEY to publish owned games, achievements, and 100% games.";
  }

  return result;
}

function achievementKey(achievement) {
  return achievement.apiname || achievement.name || "";
}

function achievementUnlocked(achievement) {
  return Number(achievement.achieved || 0) > 0;
}

function findPreviousGame(previous, appid) {
  return [
    ...((previous || {}).currentlyPlaying || []),
    ...((previous || {}).mostPlayed || [])
  ].find((game) => String(game.appid || "") === String(appid || ""));
}

function activeStartedAtFromSteam(activeAppId, currentPlaytime, previous, generatedAt) {
  const previousGame = findPreviousGame(previous, activeAppId);

  if (previousGame?.activeStartedAt && previousGame?.meta === "Playing now") {
    return previousGame.activeStartedAt;
  }

  const previousPlaytime = Number(previousGame?.playtimeForeverMinutes);
  const observedAt = Date.parse(previousGame?.lastObservedAt || previous?.generatedAt || previous?.lastGoodAt || generatedAt);
  const now = Date.parse(generatedAt);

  if (Number.isFinite(currentPlaytime) && Number.isFinite(previousPlaytime) && currentPlaytime > previousPlaytime) {
    const deltaMs = (currentPlaytime - previousPlaytime) * 60000;
    const elapsedMs = Number.isFinite(observedAt) ? Math.max(0, now - observedAt) : deltaMs;
    return new Date(now - Math.min(deltaMs, elapsedMs || deltaMs)).toISOString();
  }

  return generatedAt;
}

function activeSteamGame(profile, gameData, previous, generatedAt) {
  const activeAppId = profile?.gameid ? String(profile.gameid) : "";

  if (!activeAppId) {
    return {
      title: "No active Steam game detected",
      meta: "Steam activity",
      note: "When Steam reports an open game, it will appear here."
    };
  }

  const currentPlaytime = Number(gameData?.playtime_forever || 0);
  const activeStartedAt = activeStartedAtFromSteam(activeAppId, currentPlaytime, previous, generatedAt);
  const activeFor = formatDuration(Date.parse(generatedAt) - Date.parse(activeStartedAt));
  const totalText = currentPlaytime ? ` - Steam total ${formatHours(currentPlaytime)}` : "";

  return {
    appid: activeAppId,
    title: profile.gameextrainfo || gameData?.name || "Steam game",
    meta: "Playing now",
    note: `Active for ${activeFor}${totalText}`,
    image: headerImage(activeAppId),
    url: gameUrl(activeAppId),
    activeStartedAt,
    playtimeForeverMinutes: currentPlaytime,
    lastObservedAt: generatedAt
  };
}

async function loadAchievementCollections(ownedGames) {
  const scanSource = [...ownedGames]
    .filter((game) => game.appid)
    .sort((a, b) => Number(b.playtime_forever || 0) - Number(a.playtime_forever || 0));
  const gamesToScan = achievementScanLimit > 0 ? scanSource.slice(0, achievementScanLimit) : scanSource;
  const achievements = [];
  const completedGames = [];
  let achievementGameCount = 0;
  let totalAchievements = 0;
  let unlockedAchievements = 0;

  for (const game of gamesToScan) {
    try {
      const [player, schema, globalPercentages] = await Promise.all([
        steamApi("ISteamUserStats/GetPlayerAchievements/v0001/", {
          steamid: steamId,
          appid: game.appid,
          l: "english"
        }),
        steamApi("ISteamUserStats/GetSchemaForGame/v2/", {
          appid: game.appid,
          l: "english"
        }).catch(() => null),
        steamApi("ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/", {
          gameid: game.appid
        }).catch(() => null)
      ]);

      const playerAchievements = player?.playerstats?.achievements || [];
      const schemaAchievements = schema?.game?.availableGameStats?.achievements || [];
      const schemaByName = new Map(schemaAchievements.map((achievement) => [achievement.name, achievement]));
      const globalByName = new Map((globalPercentages?.achievementpercentages?.achievements || []).map((achievement) => [achievement.name, Number(achievement.percent || 0)]));
      const achievementTotal = schemaAchievements.length || playerAchievements.length;
      const unlocked = playerAchievements.filter(achievementUnlocked);

      if (!achievementTotal) {
        continue;
      }

      achievementGameCount += 1;
      totalAchievements += achievementTotal;
      unlockedAchievements += unlocked.length;

      if (unlocked.length >= achievementTotal) {
        completedGames.push({
          appid: game.appid,
          title: game.name || "100% game",
          meta: `${unlocked.length}/${achievementTotal} achievements`,
          note: `${formatHours(game.playtime_forever)} played`,
          image: headerImage(game.appid),
          url: gameUrl(game.appid)
        });
      }

      unlocked.forEach((achievement) => {
        const key = achievementKey(achievement);
        const details = schemaByName.get(key) || {};
        const unlocktime = Number(achievement.unlocktime || 0);
        achievements.push({
          appid: game.appid,
          title: details.displayName || achievement.name || key || "Unlocked achievement",
          meta: game.name || "Steam achievement",
          note: unlocktime ? `Unlocked ${formatDate(unlocktime)}` : "Unlocked",
          image: details.icon || headerImage(game.appid),
          url: gameUrl(game.appid),
          achievementPercent: globalByName.get(key),
          unlocktime
        });
      });
    } catch (error) {
      continue;
    }
  }

  const sortedAchievements = achievements.sort((a, b) => Number(b.unlocktime || 0) - Number(a.unlocktime || 0));
  const visibleAchievements = achievementOutputLimit > 0 ? sortedAchievements.slice(0, achievementOutputLimit) : sortedAchievements;

  return {
    achievements: visibleAchievements.map(({ unlocktime, ...achievement }) => achievement),
    rareAchievements: [...visibleAchievements]
      .filter((achievement) => Number.isFinite(achievement.achievementPercent))
      .sort((a, b) => Number(a.achievementPercent) - Number(b.achievementPercent))
      .slice(0, 12)
      .map(({ unlocktime, ...achievement }) => achievement),
    completedGames: completedGames.sort((a, b) => Number.parseInt(b.meta, 10) - Number.parseInt(a.meta, 10)),
    stats: [
      { label: "Achievement Games", value: new Intl.NumberFormat("en-US").format(achievementGameCount), note: "Visible achievement data" },
      { label: "Achievements", value: `${new Intl.NumberFormat("en-US").format(unlockedAchievements)}/${new Intl.NumberFormat("en-US").format(totalAchievements)}` },
      { label: "100% Games", value: new Intl.NumberFormat("en-US").format(completedGames.length) }
    ]
  };
}

async function loadLibraryInsights(ownedGames, recentGames, achievementData) {
  const sample = [...ownedGames]
    .filter((game) => game.appid)
    .sort((a, b) => Number(b.playtime_forever || 0) - Number(a.playtime_forever || 0))
    .slice(0, 24);
  const details = await Promise.all(sample.map(async (game) => ({ game, details: await loadAppDetails(game.appid) })));
  const metadata = new Map();
  const genreCounts = new Map();
  let sampledMinutes = 0;
  let singleMinutes = 0;
  let multiMinutes = 0;
  let controllerMinutes = 0;
  let availableDlcCount = 0;

  details.forEach(({ game, details: app }) => {
    if (!app) return;
    const genres = (app.genres || []).map((genre) => genre.description).filter(Boolean);
    const categories = (app.categories || []).map((category) => category.description).filter(Boolean);
    const minutes = Number(game.playtime_forever || 0);
    const dlcAvailable = Array.isArray(app.dlc) ? app.dlc.length : 0;
    sampledMinutes += minutes;
    genres.forEach((genre) => genreCounts.set(genre, (genreCounts.get(genre) || 0) + minutes));
    if (categories.some((category) => /single-player/i.test(category))) singleMinutes += minutes;
    if (categories.some((category) => /multi-player|co-op/i.test(category))) multiMinutes += minutes;
    if (categories.some((category) => /controller/i.test(category))) controllerMinutes += minutes;
    availableDlcCount += dlcAvailable;
    metadata.set(String(game.appid), {
      genres,
      categories,
      controllerSupport: app.controller_support || (categories.some((category) => /controller/i.test(category)) ? "supported" : ""),
      dlcAvailable
    });
  });

  const percent = (value) => sampledMinutes ? Math.round(value / sampledMinutes * 100) : 0;
  const toOwned = (game) => ({
    appid: game.appid,
    title: game.name || "Steam game",
    meta: formatHours(game.playtime_forever),
    note: Number(game.playtime_forever || 0) < 120 ? "Low-playtime library pick" : "Owned library game",
    image: headerImage(game.appid),
    url: gameUrl(game.appid),
    playtimeMinutes: Number(game.playtime_forever || 0),
    recentMinutes: Number(game.playtime_2weeks || 0),
    ...(metadata.get(String(game.appid)) || {})
  });

  return {
    ownedGames: ownedGames.map(toOwned),
    recentGames: recentGames.map(toOwned),
    genreMix: [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, minutes]) => ({ label, value: Math.round(minutes / 60) })),
    playstyle: [
      { label: "Single-player", value: percent(singleMinutes), note: `${percent(singleMinutes)}% of sampled playtime` },
      { label: "Multiplayer / co-op", value: percent(multiMinutes), note: `${percent(multiMinutes)}% of sampled playtime` },
      { label: "Controller-friendly", value: percent(controllerMinutes), note: `${percent(controllerMinutes)}% of sampled playtime` }
    ],
    rareAchievements: achievementData.rareAchievements || [],
    metadataSampleSize: metadata.size,
    availableDlcCount,
    dlcHeavyGames: sample.map(toOwned).filter((game) => Number(game.dlcAvailable || 0) > 0).sort((a, b) => Number(b.dlcAvailable || 0) - Number(a.dlcAvailable || 0)).slice(0, 5),
    averageHoursPerGame: ownedGames.length ? Math.round(ownedGames.reduce((sum, game) => sum + Number(game.playtime_forever || 0), 0) / ownedGames.length / 60) : 0,
    deepDiveGames: ownedGames.filter((game) => Number(game.playtime_forever || 0) >= 6000).length,
    lowPlaytimeGames: ownedGames.filter((game) => Number(game.playtime_forever || 0) < 120).length
  };
}

function fallbackData(reason) {
  return {
    generatedAt: new Date().toISOString(),
    source: reason,
    steamId,
    profileUrl,
    steamDbUrl,
    accountValue: accountValue
      ? {
          value: accountValue,
          note: "Manual account value from GitHub repository variable."
        }
      : undefined,
    stats: [
      { label: "Steam ID", value: steamId },
      { label: "Live Steam API", value: apiKey ? "Unavailable" : "Needs key", note: apiKey ? "Steam returned no deploy data." : "Add STEAM_API_KEY as a GitHub secret." }
    ]
  };
}

async function main() {
  const previous = await readExistingData();
  let output = fallbackData("fallback");
  const storeCollections = await loadStoreCollections();
  const { storeHighlights, preorderWatch } = storeCollections;

  if (apiKey) {
    const [profileResponse, ownedResponse, recentResponse, levelResponse] = await Promise.all([
      steamApi("ISteamUser/GetPlayerSummaries/v0002/", { steamids: steamId }),
      steamApi("IPlayerService/GetOwnedGames/v0001/", {
        steamid: steamId,
        include_appinfo: true,
        include_played_free_games: true
      }),
      steamApi("IPlayerService/GetRecentlyPlayedGames/v0001/", { steamid: steamId, count: 6 }).catch(() => ({ response: { games: [] } })),
      steamApi("IPlayerService/GetSteamLevel/v1/", { steamid: steamId }).catch(() => ({ response: {} }))
    ]);

    const profile = profileResponse?.response?.players?.[0] || {};
    const ownedGames = ownedResponse?.response?.games || [];
    const recentGames = recentResponse?.response?.games || [];
    const totalMinutes = ownedGames.reduce((sum, game) => sum + Number(game.playtime_forever || 0), 0);
    const recentMinutes = recentGames.reduce((sum, game) => sum + Number(game.playtime_2weeks || 0), 0);
    const mostPlayed = [...ownedGames].sort((a, b) => Number(b.playtime_forever || 0) - Number(a.playtime_forever || 0)).slice(0, 6);
    const achievementData = await loadAchievementCollections(ownedGames);
    const insights = await loadLibraryInsights(ownedGames, recentGames, achievementData);

    const generatedAt = new Date().toISOString();
    const activeAppId = profile?.gameid ? String(profile.gameid) : "";
    const activeGameData = recentGames.find((game) => String(game.appid) === activeAppId) || ownedGames.find((game) => String(game.appid) === activeAppId) || {};
    const activeGame = activeSteamGame(profile, activeGameData, previous, generatedAt);
    const recentGameList = recentGames
      .filter((game) => String(game.appid) !== String(activeGame.appid || ""))
      .slice(0, 3)
      .map((game) => ({ ...toRecentGame(game), lastObservedAt: generatedAt }));

    output = {
      generatedAt,
      source: "steam-web-api",
      steamId,
      profileUrl: profile.profileurl || profileUrl,
      steamDbUrl,
      profile: {
        personaName: profile.personaname || "Steam Profile",
        avatarFull: profile.avatarfull || "",
        avatarMedium: profile.avatarmedium || "",
        profileState: profile.profilestate,
        visibilityState: profile.communityvisibilitystate
      },
      accountValue: accountValue
        ? {
            value: accountValue,
            note: "Manual account value from GitHub repository variable."
          }
        : undefined,
      stats: [
        { label: "Owned Games", value: new Intl.NumberFormat("en-US").format(ownedGames.length) },
        { label: "Total Playtime", value: formatHours(totalMinutes) },
        { label: "Recent Playtime", value: formatHours(recentMinutes), note: "Last 2 weeks" },
        { label: "Steam Level", value: levelResponse?.response?.player_level ? String(levelResponse.response.player_level) : "Private" },
        ...achievementData.stats
      ],
      currentlyPlaying: activeGame.appid
        ? [activeGame, ...recentGameList]
        : recentGames.length
          ? recentGames.slice(0, 4).map((game) => ({ ...toRecentGame(game), lastObservedAt: generatedAt }))
          : mostPlayed.slice(0, 2).map((game) => toGame(game, "Most played fallback because recent games are private or empty.")),
      mostPlayed: mostPlayed.map((game) => toGame(game, `${formatHours(game.playtime_windows_forever || 0)} on Windows`)),
      achievements: achievementData.achievements,
      completedGames: achievementData.completedGames,
      insights,
      storeHighlights,
      preorderWatch
    };
  } else if (storeHighlights.length || preorderWatch.length) {
    output = {
      ...output,
      source: "steam-store",
      storeHighlights,
      preorderWatch
    };
  }

  output = withLastValues(output, previous);
  output.currentlyPlaying = await enrichGameArtwork(output.currentlyPlaying);
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Wrote Steam data for ${steamId} to ${outputPath.pathname}`);
}

await main().catch(async (error) => {
  console.error(error);
  const previous = await readExistingData();
  const output = withLastValues(fallbackData("steam-api-error"), previous);
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
});
