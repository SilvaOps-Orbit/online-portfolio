import { mkdir, readFile, writeFile } from "node:fs/promises";

const steamId = process.env.STEAM_ID || "76561199192411740";
const apiKey = process.env.STEAM_API_KEY || "";
const accountValue = process.env.STEAM_ACCOUNT_VALUE || process.env.STEAMDB_ACCOUNT_VALUE || "";
const achievementScanLimit = Number(process.env.STEAM_ACHIEVEMENT_SCAN_LIMIT || 0);
const achievementOutputLimit = Number(process.env.STEAM_ACHIEVEMENT_OUTPUT_LIMIT || 0);
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
    note: game.playtime_2weeks ? `${formatHours(game.playtime_2weeks)} in the last 2 weeks` : `${formatHours(game.playtime_forever)} total`
  };
}

function withLastValues(output, previous) {
  const result = { ...output };
  const arrayKeys = ["currentlyPlaying", "mostPlayed", "achievements", "completedGames"];

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

function activeSteamGame(profile, ownedGames, previous, generatedAt) {
  const activeAppId = profile?.gameid ? String(profile.gameid) : "";

  if (!activeAppId) {
    return {
      title: "No active Steam game detected",
      meta: "Steam activity",
      note: "When Steam reports an open game, it will appear here."
    };
  }

  const ownedGame = ownedGames.find((game) => String(game.appid) === activeAppId) || {};
  const previousActive = Array.isArray(previous.currentlyPlaying) ? previous.currentlyPlaying[0] : {};
  const activeStartedAt = String(previousActive?.appid || "") === activeAppId && previousActive?.activeStartedAt
    ? previousActive.activeStartedAt
    : generatedAt;
  const activeFor = formatDuration(Date.parse(generatedAt) - Date.parse(activeStartedAt));

  return {
    appid: activeAppId,
    title: profile.gameextrainfo || ownedGame.name || "Steam game",
    meta: "Playing now",
    note: `Active for ${activeFor}`,
    image: headerImage(activeAppId),
    url: gameUrl(activeAppId),
    activeStartedAt
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
      const [player, schema] = await Promise.all([
        steamApi("ISteamUserStats/GetPlayerAchievements/v0001/", {
          steamid: steamId,
          appid: game.appid,
          l: "english"
        }),
        steamApi("ISteamUserStats/GetSchemaForGame/v2/", {
          appid: game.appid,
          l: "english"
        }).catch(() => null)
      ]);

      const playerAchievements = player?.playerstats?.achievements || [];
      const schemaAchievements = schema?.game?.availableGameStats?.achievements || [];
      const schemaByName = new Map(schemaAchievements.map((achievement) => [achievement.name, achievement]));
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
    completedGames: completedGames.sort((a, b) => Number.parseInt(b.meta, 10) - Number.parseInt(a.meta, 10)),
    stats: [
      { label: "Achievement Games", value: new Intl.NumberFormat("en-US").format(achievementGameCount), note: "Visible achievement data" },
      { label: "Achievements", value: `${new Intl.NumberFormat("en-US").format(unlockedAchievements)}/${new Intl.NumberFormat("en-US").format(totalAchievements)}` },
      { label: "100% Games", value: new Intl.NumberFormat("en-US").format(completedGames.length) }
    ]
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

    const generatedAt = new Date().toISOString();
    const activeGame = activeSteamGame(profile, ownedGames, previous, generatedAt);

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
        ? [activeGame]
        : recentGames.length
          ? recentGames.slice(0, 4).map(toRecentGame)
          : mostPlayed.slice(0, 2).map((game) => toGame(game, "Most played fallback because recent games are private or empty.")),
      mostPlayed: mostPlayed.map((game) => toGame(game, `${formatHours(game.playtime_windows_forever || 0)} on Windows`)),
      achievements: achievementData.achievements,
      completedGames: achievementData.completedGames
    };
  }

  output = withLastValues(output, previous);
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Wrote Steam data for ${steamId} to ${outputPath.pathname}`);
}

main().catch(async (error) => {
  console.error(error);
  const previous = await readExistingData();
  const output = withLastValues(fallbackData("steam-api-error"), previous);
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
});
