import { mkdir, readFile, writeFile } from "node:fs/promises";

const steamId = process.env.STEAM_ID || "76561199192411740";
const apiKey = process.env.STEAM_API_KEY || "";
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

function toRecentGame(game) {
  return {
    appid: game.appid,
    title: game.name || "Steam game",
    meta: "Recently played",
    note: game.playtime_2weeks ? `${formatHours(game.playtime_2weeks)} in the last 2 weeks` : `${formatHours(game.playtime_forever)} total`,
    image: game.appid ? headerImage(game.appid) : "",
    url: game.appid ? gameUrl(game.appid) : ""
  };
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

function activeSteamGame(profile, previous, generatedAt) {
  const activeAppId = profile?.gameid ? String(profile.gameid) : "";

  if (!activeAppId) {
    return {
      title: "No active Steam game detected",
      meta: "Steam activity",
      note: "Last checked by the scheduled activity refresh."
    };
  }

  const previousActive = Array.isArray(previous.currentlyPlaying) ? previous.currentlyPlaying[0] : {};
  const activeStartedAt = String(previousActive?.appid || "") === activeAppId && previousActive?.activeStartedAt
    ? previousActive.activeStartedAt
    : generatedAt;
  const activeFor = formatDuration(Date.parse(generatedAt) - Date.parse(activeStartedAt));

  return {
    appid: activeAppId,
    title: profile.gameextrainfo || "Steam game",
    meta: "Playing now",
    note: `Active for ${activeFor}`,
    image: headerImage(activeAppId),
    url: gameUrl(activeAppId),
    activeStartedAt
  };
}

async function main() {
  const previous = await readExistingData();

  if (!apiKey) {
    return;
  }

  const generatedAt = new Date().toISOString();
  const [profileResponse, recentResponse] = await Promise.all([
    steamApi("ISteamUser/GetPlayerSummaries/v0002/", { steamids: steamId }),
    steamApi("IPlayerService/GetRecentlyPlayedGames/v0001/", { steamid: steamId, count: 4 }).catch(() => ({ response: { games: [] } }))
  ]);
  const profile = profileResponse?.response?.players?.[0] || {};
  const recentGames = recentResponse?.response?.games || [];
  const activeGame = activeSteamGame(profile, previous, generatedAt);
  const currentGames = activeGame.appid
    ? [activeGame]
    : recentGames.length
      ? recentGames.map(toRecentGame)
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
