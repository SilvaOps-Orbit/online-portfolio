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
  const discount = Number(item.discount_percent || 0);

  return {
    appid: item.id,
    title: item.name || "Steam game",
    category,
    price: formatPrice(item.final_price, item.currency),
    originalPrice: discount ? formatPrice(item.original_price, item.currency) : "",
    discount,
    tag: category,
    image: item.header_image || item.small_capsule_image || "",
    url: storeItemUrl(item.id)
  };
}

function toStoreWatchItem(item, category, note) {
  const highlight = toStoreHighlight(item, category);

  return {
    ...highlight,
    meta: category,
    note: note || `${highlight.price} on Steam`
  };
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
        if (!item?.id || seen.has(item.id) || items.length >= 24) {
          return;
        }

        seen.add(item.id);
        items.push(toStoreHighlight(item, category));
      });
    });

    const preorderWatch = [];
    const preorderSeen = new Set();
    (data.coming_soon?.items || []).forEach((item) => {
      if (!item?.id || preorderSeen.has(item.id) || preorderWatch.length >= 18) {
        return;
      }

      preorderSeen.add(item.id);
      preorderWatch.push(toStoreWatchItem(item, "Pre-order", "Upcoming on Steam. Open the store page for release/pre-order details."));
    });

    if (!preorderWatch.length) {
      const fallback = (data.top_sellers?.items || data.specials?.items || data.new_releases?.items || []).find((item) => item?.id);
      if (fallback) {
        preorderWatch.push(toStoreWatchItem(fallback, "Popular now", "No pre-order entries were returned, so this shows a current popular Steam game."));
      }
    }

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

async function main() {
  const previous = await readExistingData();

  if (!apiKey) {
    return;
  }

  const generatedAt = new Date().toISOString();
  const [profileResponse, recentResponse, storeCollections] = await Promise.all([
    steamApi("ISteamUser/GetPlayerSummaries/v0002/", { steamids: steamId }),
    steamApi("IPlayerService/GetRecentlyPlayedGames/v0001/", { steamid: steamId, count: 4 }).catch(() => ({ response: { games: [] } })),
    loadStoreCollections()
  ]);
  const { storeHighlights, preorderWatch } = storeCollections;
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
  const output = {
    ...previous,
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
    storeHighlights: storeHighlights.length ? storeHighlights : previous.storeHighlights,
    preorderWatch: preorderWatch.length ? preorderWatch : previous.preorderWatch,
    status: activeGame.appid
      ? "Steam activity refreshed. Active game is shown from Steam profile status."
      : "Steam activity refreshed. No active game detected, so recently played games are shown.",
    stale: false
  };

  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Wrote Steam activity for ${steamId} to ${outputPath.pathname}`);
}

main().catch(async (error) => {
  console.error(error);
});
