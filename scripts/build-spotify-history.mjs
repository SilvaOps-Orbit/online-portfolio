import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const sourceDir = process.env.SPOTIFY_EXPORT_DIR || "";
const outputPath = new URL("../data/spotify-history.json", import.meta.url);
const excludedPlaylistTitles = new Set(["sex"]);
const meaningfulPlayMs = 30_000;

if (!sourceDir) {
  throw new Error("Set SPOTIFY_EXPORT_DIR to the extracted Spotify Account Data folder.");
}

async function loadJson(name, fallback) {
  try {
    return JSON.parse(await readFile(resolve(sourceDir, name), "utf8"));
  } catch (error) {
    if (fallback !== undefined) return fallback;
    throw error;
  }
}

function cleanText(value, limit = 120) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function archiveTime(value) {
  const text = cleanText(value, 32);
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(text)
    ? `${text.replace(" ", "T")}:00`
    : "";
}

function sum(items, field) {
  return items.reduce((total, item) => total + Math.max(0, Number(item?.[field] || 0)), 0);
}

function ranked(items, key, limit = 10) {
  const groups = new Map();
  items.forEach((item) => {
    const label = cleanText(key(item));
    if (!label) return;
    const existing = groups.get(label) || { label, plays: 0, msPlayed: 0 };
    existing.plays += 1;
    existing.msPlayed += Math.max(0, Number(item.msPlayed || 0));
    groups.set(label, existing);
  });
  return [...groups.values()]
    .sort((left, right) => right.msPlayed - left.msPlayed || right.plays - left.plays || left.label.localeCompare(right.label))
    .slice(0, limit);
}

function toInsightItem(item, kind) {
  const hours = Number((item.msPlayed / 3_600_000).toFixed(1));
  return {
    id: `${kind}-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    title: item.label,
    meta: `${hours.toLocaleString("en-AU", { maximumFractionDigits: 1 })} hrs across ${item.plays.toLocaleString("en-AU")} plays`,
    count: item.plays
  };
}

function heatmap(events) {
  const cells = Array.from({ length: 7 }, () => Array(24).fill(0));
  events.forEach((event) => {
    const playedAt = archiveTime(event.endTime);
    if (!playedAt) return;
    const date = new Date(playedAt);
    if (Number.isNaN(date.getTime())) return;
    const day = (date.getDay() + 6) % 7;
    cells[day][date.getHours()] += Math.max(0, Number(event.msPlayed || 0));
  });
  const max = Math.max(1, ...cells.flat());
  return {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    hours: Array.from({ length: 24 }, (_, hour) => hour),
    maxMinutes: Math.round(max / 60_000),
    cells: cells.map((day) => day.map((msPlayed) => Math.round(msPlayed / 60_000)))
  };
}

function safeMoments(capsule) {
  return (Array.isArray(capsule?.highlights) ? capsule.highlights : [])
    .map((highlight, index) => {
      const type = cleanText(highlight?.highlightType, 56).replace(/([a-z])([A-Z])/g, "$1 $2");
      const date = cleanText(highlight?.date, 16);
      if (!type || !date) return null;
      return { id: `capsule-${index + 1}`, date, title: type, note: "Spotify Sound Capsule highlight" };
    })
    .filter(Boolean)
    .slice(-12)
    .reverse();
}

function minutesFrom(value) {
  return Math.round(Math.max(0, Number(value || 0)) / 60_000);
}

async function main() {
  const [historyFiles, playlistsSource, wrapped, taste, capsule, library, podcasts] = await Promise.all([
    Promise.all([0, 1, 2].map((index) => loadJson(`StreamingHistory_music_${index}.json`, []))),
    loadJson("Playlist1.json", { playlists: [] }),
    loadJson("Wrapped2025.json", {}),
    loadJson("TasteProfile.json", {}),
    loadJson("YourSoundCapsule.json", {}),
    loadJson("YourLibrary.json", {}),
    loadJson("StreamingHistory_podcast_0.json", [])
  ]);
  const music = historyFiles.flat().filter((event) => cleanText(event?.artistName) && cleanText(event?.trackName));
  const meaningful = music.filter((event) => Number(event.msPlayed || 0) >= meaningfulPlayMs);
  const ordered = [...meaningful].sort((left, right) => String(left.endTime || "").localeCompare(String(right.endTime || "")));
  const periodStart = archiveTime(ordered[0]?.endTime);
  const periodEnd = archiveTime(ordered.at(-1)?.endTime);
  const totalMs = sum(music, "msPlayed");
  const playlists = (Array.isArray(playlistsSource?.playlists) ? playlistsSource.playlists : [])
    .filter((playlist) => !excludedPlaylistTitles.has(cleanText(playlist?.name).toLowerCase()));
  const playlistTracks = playlists.reduce((total, playlist) => total + (Array.isArray(playlist?.items) ? playlist.items.length : 0), 0);
  const topArtists = ranked(meaningful, (event) => event.artistName).map((item) => toInsightItem(item, "artist"));
  const topTracks = ranked(meaningful, (event) => `${cleanText(event.trackName)} - ${cleanText(event.artistName)}`).map((item) => toInsightItem(item, "track"));
  const recent = [...ordered].reverse().slice(0, 24).map((event, index) => ({
    id: `archive-${index}-${cleanText(event.trackName).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    title: cleanText(event.trackName),
    artists: [cleanText(event.artistName)],
    meta: cleanText(event.artistName),
    contextType: "Archive replay",
    contextTitle: "Spotify listening history",
    playedAt: archiveTime(event.endTime),
    durationMs: Number(event.msPlayed || 0)
  }));
  const listeningAge = Number(wrapped?.listeningAge?.listeningAge || 22);
  const output = {
    schemaVersion: 2,
    updatedAt: new Date().toISOString(),
    privacy: "Curated public listening summaries only. Raw Spotify exports, identifiers, searches, private communications, billing records, and full play-by-play history are excluded. Only a short public recent-listening display is retained.",
    snapshots: [],
    archive: {
      periodStart,
      periodEnd,
      summary: {
        musicEvents: music.length,
        meaningfulPlays: meaningful.length,
        hours: Number((totalMs / 3_600_000).toFixed(1)),
        uniqueArtists: new Set(meaningful.map((event) => cleanText(event.artistName).toLowerCase())).size,
        uniqueTracks: new Set(meaningful.map((event) => `${cleanText(event.trackName).toLowerCase()}|${cleanText(event.artistName).toLowerCase()}`)).size
      },
      taste: {
        musicalIdentity: cleanText(taste?.tasteProfile?.musicalIdentity, 180),
        contentRhythms: cleanText(taste?.tasteProfile?.contentRhythms, 180),
        topArtists,
        topTracks
      },
      wrapped: {
        year: 2025,
        listeningAge,
        minutes: minutesFrom(wrapped?.yearlyMetrics?.totalMsListened),
        uniqueArtists: Number(wrapped?.topArtists?.numUniqueArtists || 0),
        uniqueTracks: Number(wrapped?.topTracks?.numUniqueTracks || 0),
        uniqueGenres: Number(wrapped?.topGenres?.totalNumGenres || 0),
        club: cleanText(wrapped?.clubs?.userClub, 80),
        clubPercentile: Number(wrapped?.clubs?.percentInClub || 0)
      },
      playlists: {
        count: playlists.length,
        tracks: playlistTracks,
        followers: playlists.reduce((total, playlist) => total + Math.max(0, Number(playlist?.numberOfFollowers || 0)), 0)
      },
      library: {
        savedTracks: Array.isArray(library?.tracks) ? library.tracks.length : 0,
        savedAlbums: Array.isArray(library?.albums) ? library.albums.length : 0,
        savedArtists: Array.isArray(library?.artists) ? library.artists.length : 0
      },
      podcasts: {
        plays: Array.isArray(podcasts) ? podcasts.length : 0,
        hours: Number((sum(Array.isArray(podcasts) ? podcasts : [], "msPlayed") / 3_600_000).toFixed(2))
      },
      recentlyPlayed: recent,
      heatmap: heatmap(meaningful),
      soundCapsule: safeMoments(capsule)
    }
  };
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Built public Spotify archive snapshot with ${meaningful.length} meaningful plays.`);
}

await main();
