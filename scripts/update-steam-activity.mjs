import { mkdir, readFile, writeFile } from "node:fs/promises";

const steamId = process.env.STEAM_ID || "76561199192411740";
const apiKey = process.env.STEAM_API_KEY || "";
const storeCountry = process.env.STEAM_STORE_COUNTRY || "AU";
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

  return value.trim().replace(/^http:\/\//i, "https://");
}

function stripText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function shuffleItems(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function toRecentGame(game) {
  return {
    appid: game.appid,
    title: game.name || "Steam game",
    meta: "Recently played",
    note: game.playtime_2weeks ? `${formatHours(game.playtime_2weeks)} in the last 2 weeks` : `${formatHours(game.playtime_forever)} total`,
    image: game.appid ? headerImage(game.appid) : "",
    url: game.appid ? gameUrl(game.appid) : "",
    playtimeForeverMinutes: Number(game.playtime_forever || 0)
  };
}

function toStoreHighlight(item, category) {
  const appid = item.id || item.appid || item.steam_appid;
  const discount = Number(item.discount_percent || 0);

  return {
    appid,
    title: item.name || "Steam game",
    category,
    price: formatPrice(item.final_price, item.currency),
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
      const label = stripText(sub.name || sub.option_text || group.title || "Edition");
      if (!label || seen.has(label)) {
        return;
      }

      seen.add(label);
      editions.push({
        label,
        price: sub.price_in_cents_with_discount !== undefined
          ? formatPrice(sub.price_in_cents_with_discount, currency)
          : sub.is_free_license
            ? "Free"
            : ""
      });
    });
  });

  return editions.slice(0, 4);
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
      "User-Agent": "Alvis Leslie Gordon portfolio Steam activity updater"
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
      note: "Last checked by the scheduled activity refresh."
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

async function writeSteamData(output) {
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Wrote Steam activity for ${steamId} to ${outputPath.pathname}`);
}

async function main() {
  const previous = await readExistingData();
  const generatedAt = new Date().toISOString();
  const storeCollections = await loadStoreCollections();
  const storeUpdates = {
    storeHighlights: storeCollections.storeHighlights.length ? storeCollections.storeHighlights : previous.storeHighlights,
    preorderWatch: storeCollections.preorderWatch.length ? storeCollections.preorderWatch : previous.preorderWatch
  };

  if (!apiKey) {
    await writeSteamData({
      ...previous,
      ...storeUpdates,
      generatedAt,
      source: previous.source || "steam-store",
      status: "Steam store watch refreshed. Active game detection needs STEAM_API_KEY.",
      stale: false
    });
    return;
  }

  const [profileResponse, recentResponse] = await Promise.all([
    steamApi("ISteamUser/GetPlayerSummaries/v0002/", { steamids: steamId }),
    steamApi("IPlayerService/GetRecentlyPlayedGames/v0001/", { steamid: steamId, count: 4 }).catch(() => ({ response: { games: [] } }))
  ]);
  const profile = profileResponse?.response?.players?.[0] || {};
  const recentGames = recentResponse?.response?.games || [];
  const activeAppId = profile?.gameid ? String(profile.gameid) : "";
  const activeGameData = recentGames.find((game) => String(game.appid) === activeAppId) || {};
  const activeGame = activeSteamGame(profile, activeGameData, previous, generatedAt);
  const recentGameList = recentGames
    .filter((game) => String(game.appid) !== String(activeGame.appid || ""))
    .slice(0, 3)
    .map((game) => ({ ...toRecentGame(game), lastObservedAt: generatedAt }));
  const currentGames = activeGame.appid
    ? [activeGame, ...recentGameList]
    : recentGames.length
      ? recentGames.map((game) => ({ ...toRecentGame(game), lastObservedAt: generatedAt }))
      : [activeGame];

  await writeSteamData({
    ...previous,
    ...storeUpdates,
    generatedAt,
    source: previous.source || "steam-activity",
    profile: {
      ...previous.profile,
      personaName: profile.personaname || previous.profile?.personaName || "Steam Profile",
      avatarFull: profile.avatarfull || previous.profile?.avatarFull || "",
      avatarMedium: profile.avatarmedium || previous.profile?.avatarMedium || "",
      profileState: profile.profilestate,
      visibilityState: profile.communityvisibilitystate
    },
    profileUrl: profile.profileurl || previous.profileUrl || `https://steamcommunity.com/profiles/${steamId}`,
    currentlyPlaying: currentGames,
    status: activeGame.appid
      ? "Steam activity refreshed. Active game is shown from Steam profile status."
      : "Steam activity refreshed. No active game detected, so recently played games are shown.",
    stale: false
  });
}

await main().catch((error) => {
  console.error(error);
});
