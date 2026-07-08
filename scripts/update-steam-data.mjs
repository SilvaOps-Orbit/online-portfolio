import { mkdir, writeFile } from "node:fs/promises";

const steamId = process.env.STEAM_ID || "76561199192411740";
const apiKey = process.env.STEAM_API_KEY || "";
const accountValue = process.env.STEAMDB_ACCOUNT_VALUE || process.env.STEAM_ACCOUNT_VALUE || "";
const steamDbUrl = `https://steamdb.info/calculator/${steamId}/`;
const profileUrl = `https://steamcommunity.com/profiles/${steamId}`;
const outputPath = new URL("../data/steam.json", import.meta.url);

function gameUrl(appid) {
  return `https://store.steampowered.com/app/${appid}/`;
}

function headerImage(appid) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
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

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Alvis Leslie Gordon portfolio Steam data updater"
    }
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
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

async function loadWishlist() {
  try {
    const data = await fetchJson(`https://store.steampowered.com/wishlist/profiles/${steamId}/wishlistdata/?p=0`);
    return Object.entries(data)
      .slice(0, 6)
      .map(([appid, item]) => ({
        appid,
        title: item.name || "Wishlist game",
        meta: item.release_string || "",
        note: item.review_desc || "On wishlist",
        image: headerImage(appid),
        url: gameUrl(appid)
      }));
  } catch (error) {
    return [];
  }
}

async function loadAchievementHighlights(games) {
  const highlights = [];

  for (const game of games.slice(0, 6)) {
    try {
      const [player, schema] = await Promise.all([
        steamApi("ISteamUserStats/GetPlayerAchievements/v0001/", {
          steamid: steamId,
          appid: game.appid
        }),
        steamApi("ISteamUserStats/GetSchemaForGame/v2/", {
          appid: game.appid
        })
      ]);

      const schemaByName = new Map((schema?.game?.availableGameStats?.achievements || []).map((achievement) => [achievement.name, achievement]));
      const unlocked = (player?.playerstats?.achievements || [])
        .filter((achievement) => achievement.achieved && achievement.unlocktime)
        .sort((a, b) => b.unlocktime - a.unlocktime);

      unlocked.slice(0, 2).forEach((achievement) => {
        const details = schemaByName.get(achievement.apiname) || {};
        highlights.push({
          title: details.displayName || achievement.apiname || "Unlocked achievement",
          meta: game.name || game.title || "Steam achievement",
          note: `Unlocked ${formatDate(achievement.unlocktime)}`,
          image: details.icon || headerImage(game.appid),
          url: gameUrl(game.appid)
        });
      });
    } catch (error) {
      continue;
    }

    if (highlights.length >= 6) {
      break;
    }
  }

  return highlights.slice(0, 6);
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
          note: "Manual SteamDB value from GitHub repository variable."
        }
      : undefined,
    stats: [
      { label: "Steam ID", value: steamId },
      { label: "Live Steam API", value: apiKey ? "Unavailable" : "Needs key", note: apiKey ? "Steam returned no deploy data." : "Add STEAM_API_KEY as a GitHub secret." }
    ]
  };
}

async function main() {
  let output = fallbackData("fallback");

  if (apiKey) {
    const [profileResponse, ownedResponse, recentResponse, levelResponse, wishlist] = await Promise.all([
      steamApi("ISteamUser/GetPlayerSummaries/v0002/", { steamids: steamId }),
      steamApi("IPlayerService/GetOwnedGames/v0001/", {
        steamid: steamId,
        include_appinfo: true,
        include_played_free_games: true
      }),
      steamApi("IPlayerService/GetRecentlyPlayedGames/v0001/", { steamid: steamId, count: 6 }).catch(() => ({ response: { games: [] } })),
      steamApi("IPlayerService/GetSteamLevel/v1/", { steamid: steamId }).catch(() => ({ response: {} })),
      loadWishlist()
    ]);

    const profile = profileResponse?.response?.players?.[0] || {};
    const ownedGames = ownedResponse?.response?.games || [];
    const recentGames = recentResponse?.response?.games || [];
    const totalMinutes = ownedGames.reduce((sum, game) => sum + Number(game.playtime_forever || 0), 0);
    const recentMinutes = recentGames.reduce((sum, game) => sum + Number(game.playtime_2weeks || 0), 0);
    const mostPlayed = [...ownedGames].sort((a, b) => Number(b.playtime_forever || 0) - Number(a.playtime_forever || 0)).slice(0, 6);
    const achievementHighlights = await loadAchievementHighlights(mostPlayed);

    output = {
      generatedAt: new Date().toISOString(),
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
            note: "Manual SteamDB value from GitHub repository variable."
          }
        : {
            value: "See SteamDB",
            note: "SteamDB has no official account-value API; open the calculator link for the live estimate."
          },
      stats: [
        { label: "Owned Games", value: new Intl.NumberFormat("en-US").format(ownedGames.length) },
        { label: "Total Playtime", value: formatHours(totalMinutes) },
        { label: "Recent Playtime", value: formatHours(recentMinutes), note: "Last 2 weeks" },
        { label: "Steam Level", value: levelResponse?.response?.player_level ? String(levelResponse.response.player_level) : "Private" }
      ],
      currentlyPlaying: recentGames.length
        ? recentGames.slice(0, 4).map((game) => ({
            ...toGame(game, `${formatHours(game.playtime_forever)} total`),
            meta: `${formatHours(game.playtime_2weeks)} last 2 weeks`
          }))
        : mostPlayed.slice(0, 2).map((game) => toGame(game, "Most played fallback because recent games are private or empty.")),
      wishlist,
      mostPlayed: mostPlayed.map((game) => toGame(game, `${formatHours(game.playtime_windows_forever || 0)} on Windows`)),
      achievements: achievementHighlights
    };
  }

  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Wrote Steam data for ${steamId} to ${outputPath.pathname}`);
}

main().catch(async (error) => {
  console.error(error);
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(fallbackData("steam-api-error"), null, 2)}\n`, "utf8");
});
