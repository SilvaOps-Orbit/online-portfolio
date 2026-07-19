import { readFile, writeFile } from "node:fs/promises";

const outputPath = new URL("../data/steam.json", import.meta.url);
const replayUrl = process.env.STEAM_REPLAY_URL || "https://s.team/y25/gnkcbvhr?l=english";

function decodeHtmlAttribute(value) {
  return value
    .replaceAll("&quot;", "\"")
    .replaceAll("&#039;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function normalizedImage(value) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replace(/^http:\/\//i, "https://")
    .replace("shared.akamai.steamstatic.com", "shared.fastly.steamstatic.com");
}

function gameUrl(appid) {
  return `https://store.steampowered.com/app/${appid}/`;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "EchoOps portfolio Steam Replay snapshot updater" },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Steam Replay returned ${response.status}`);
  return response.text();
}

function extractAttribute(html, pattern) {
  const match = html.match(pattern);
  return match ? decodeHtmlAttribute(match[1]) : "";
}

function extractReplay(html) {
  const payloadMatch = html.match(/data-yearinreview_\d+_(\d{4})="([^"]+)"/);
  if (!payloadMatch) throw new Error("Steam Replay data attribute was not found");
  const replay = JSON.parse(decodeHtmlAttribute(payloadMatch[2]));
  return { replay, year: Number(payloadMatch[1]) };
}

async function appDetails(appid) {
  try {
    const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(appid)}&cc=AU&l=en`, {
      headers: { "User-Agent": "EchoOps portfolio Steam Replay snapshot updater" },
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) return null;
    const result = await response.json();
    return result?.[appid]?.success ? result[appid].data : null;
  } catch {
    return null;
  }
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

async function buildReplaySnapshot(html, steamData) {
  const { replay, year } = extractReplay(html);
  const stats = replay.playtime_stats || {};
  const totals = stats.total_stats || {};
  const achievements = stats.summary_stats || {};
  const byNumbers = stats.by_numbers || {};
  const games = Array.isArray(stats.games) ? stats.games : [];
  const summary = Array.isArray(stats.game_summary) ? stats.game_summary : [];
  const knownGames = [
    ...(steamData.currentlyPlaying || []),
    ...(steamData.mostPlayed || []),
    ...(steamData.completedGames || []),
    ...(steamData.replay?.topGames || [])
  ];
  const knownById = new Map(knownGames.map((game) => [String(game.appid || ""), game]));
  const topEntries = [...games]
    .sort((left, right) => finiteNumber(left.playtime_ranks?.overall_rank || 9999) - finiteNumber(right.playtime_ranks?.overall_rank || 9999))
    .slice(0, 3);
  const topGames = await Promise.all(topEntries.map(async (game) => {
    const appid = finiteNumber(game.appid);
    const known = knownById.get(String(appid)) || {};
    const details = await appDetails(appid);
    return {
      appid,
      title: details?.name || known.title || known.name || `Steam app ${appid}`,
      image: normalizedImage(details?.header_image || known.image || `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`),
      url: gameUrl(appid),
      hours: Math.round((finiteNumber(game.stats?.total_playtime_seconds) / 3600) * 10) / 10,
      sessions: finiteNumber(game.stats?.total_sessions),
      playtimePercent: Math.round((finiteNumber(game.stats?.total_playtime_percentagex100) / 100) * 10) / 10
    };
  }));
  const generatedAt = new Date().toISOString();
  const canonical = extractAttribute(html, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)
    || extractAttribute(html, /<meta[^>]+property="og:url"[^>]+content="([^"]+)"/i)
    || replayUrl;

  return {
    year,
    generatedAt,
    lastGoodAt: generatedAt,
    stale: false,
    status: `Steam Replay ${year} refreshed from the public share page.`,
    source: "Steam Replay public share",
    sourceUrl: canonical,
    totalHours: Math.round(finiteNumber(totals.total_playtime_seconds) / 3600),
    totalSessions: finiteNumber(totals.total_sessions),
    gamesPlayed: summary.length,
    newGames: summary.filter((game) => finiteNumber(game.new_this_year) === 1).length,
    achievements: finiteNumber(achievements.total_achievements),
    rareAchievements: finiteNumber(achievements.total_rare_achievements),
    longestStreak: finiteNumber(stats.playtime_streak?.longest_consecutive_days),
    controllerPercent: Math.round((finiteNumber(totals.controller_playtime_percentagex100) / 100) * 10) / 10,
    gamesPercentile: finiteNumber(byNumbers.games_played_pct),
    achievementsPercentile: finiteNumber(byNumbers.achievements_pct),
    streakPercentile: finiteNumber(byNumbers.game_streak_pct),
    topGames
  };
}

async function main() {
  const steamData = JSON.parse(await readFile(outputPath, "utf8"));
  try {
    const html = await fetchText(replayUrl);
    steamData.replay = await buildReplaySnapshot(html, steamData);
  } catch (error) {
    if (!steamData.replay) throw error;
    steamData.replay = {
      ...steamData.replay,
      stale: true,
      status: `Steam Replay refresh unavailable; showing the last saved snapshot.`,
      lastAttemptAt: new Date().toISOString()
    };
    console.warn(error instanceof Error ? error.message : String(error));
  }

  const imageKeys = ["currentlyPlaying", "mostPlayed", "achievements", "completedGames", "storeHighlights", "preorderWatch"];
  imageKeys.forEach((key) => {
    if (Array.isArray(steamData[key])) {
      steamData[key] = steamData[key].map((item) => ({ ...item, image: normalizedImage(item.image) }));
    }
  });
  await writeFile(outputPath, `${JSON.stringify(steamData, null, 2)}\n`, "utf8");
  console.log(`Updated Steam Replay ${steamData.replay.year} snapshot.`);
}

await main();
