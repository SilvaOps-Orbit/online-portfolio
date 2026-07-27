import { mkdir, readFile, writeFile } from "node:fs/promises";

const outputPath = new URL("../data/youtube.json", import.meta.url);
const clientId = process.env.YOUTUBE_CLIENT_ID || "";
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || "";
const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN || "";
const apiKey = process.env.YOUTUBE_API_KEY || "";
const configuredMonetizationStatus = process.env.YOUTUBE_MONETIZATION_STATUS || "";

function cleanText(value, maxLength = 300) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

async function readExisting() {
  try {
    return JSON.parse(await readFile(outputPath, "utf8"));
  } catch {
    return null;
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) {
    const detail = cleanText(await response.text(), 180);
    throw new Error(`YouTube API returned ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return response.json();
}

async function getAccessToken() {
  if (!clientId || !clientSecret || !refreshToken) return "";
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token"
  });
  const data = await fetchJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  return cleanText(data.access_token, 2048);
}

function youtubeHeaders(accessToken) {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

async function youtubeApi(path, accessToken) {
  const url = new URL(path, "https://www.googleapis.com/youtube/v3/");
  if (!accessToken && apiKey) url.searchParams.set("key", apiKey);
  return fetchJson(url, { headers: youtubeHeaders(accessToken) });
}

function sanitizeVideo(item) {
  const id = cleanText(item?.id?.videoId || item?.id, 80);
  const snippet = item?.snippet || {};
  return {
    id,
    title: cleanText(snippet.title, 180),
    publishedAt: cleanText(snippet.publishedAt, 40),
    image: cleanUrl(snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url),
    url: id ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` : ""
  };
}

async function buildSnapshot() {
  if (!apiKey && (!clientId || !clientSecret || !refreshToken)) {
    throw new Error("YouTube credentials are not configured.");
  }

  const accessToken = await getAccessToken();
  const mineQuery = accessToken
    ? "channels?part=snippet,statistics,contentDetails&mine=true"
    : "channels?part=snippet,statistics,contentDetails&forHandle=SilvaDevelops";
  const channelPayload = await youtubeApi(mineQuery, accessToken);
  const channel = channelPayload?.items?.[0];
  if (!channel) throw new Error("The connected Google account did not return a YouTube channel.");

  const uploadsPlaylist = cleanText(channel.contentDetails?.relatedPlaylists?.uploads, 120);
  let videos = [];
  if (uploadsPlaylist) {
    const playlistItems = await youtubeApi(
      `playlistItems?part=snippet&playlistId=${encodeURIComponent(uploadsPlaylist)}&maxResults=6`,
      accessToken
    );
    videos = (playlistItems?.items || []).map((item) => sanitizeVideo({
      id: item?.snippet?.resourceId,
      snippet: item?.snippet
    })).filter((item) => item.id && item.title);
  }

  const stats = channel.statistics || {};
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    generatedAt: now,
    lastGoodAt: now,
    source: accessToken ? "YouTube Data API via server-side OAuth" : "YouTube Data API public channel snapshot",
    stale: false,
    profile: {
      id: cleanText(channel.id, 100),
      title: cleanText(channel.snippet?.title || "SilvaDevelops", 120),
      description: cleanText(channel.snippet?.description, 500),
      handle: "@SilvaDevelops",
      url: "https://www.youtube.com/@SilvaDevelops",
      image: cleanUrl(channel.snippet?.thumbnails?.high?.url || channel.snippet?.thumbnails?.medium?.url || channel.snippet?.thumbnails?.default?.url)
    },
    statistics: {
      subscribers: Math.max(0, Number(stats.subscriberCount || 0)),
      views: Math.max(0, Number(stats.viewCount || 0)),
      videos: Math.max(0, Number(stats.videoCount || 0)),
      hiddenSubscriberCount: Boolean(stats.hiddenSubscriberCount)
    },
    monetization: {
      status: cleanText(configuredMonetizationStatus, 60) || "Unmonetised",
      source: "Channel owner configured"
    },
    latestVideos: videos
  };
}

const existing = await readExisting();

try {
  const snapshot = await buildSnapshot();
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Updated data/youtube.json for ${snapshot.profile.title}.`);
} catch (error) {
  if (!existing?.profile?.url) throw error;
  const fallback = {
    ...existing,
    stale: true,
    status: `Last successful YouTube snapshot preserved: ${cleanText(error.message, 180)}`
  };
  await writeFile(outputPath, `${JSON.stringify(fallback, null, 2)}\n`, "utf8");
  console.warn(fallback.status);
}
