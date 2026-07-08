import { mkdir, readFile, writeFile } from "node:fs/promises";

const clientId = process.env.SPOTIFY_CLIENT_ID || "";
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || "";
const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN || "";
const outputPath = new URL("../data/spotify.json", import.meta.url);

async function readExistingData() {
  try {
    return JSON.parse(await readFile(outputPath, "utf8"));
  } catch (error) {
    return {};
  }
}

function imageFrom(images) {
  return Array.isArray(images) && images.length ? images[0].url : "";
}

function externalUrl(item) {
  return item?.external_urls?.spotify || "";
}

function fallbackData(reason) {
  return {
    generatedAt: new Date().toISOString(),
    source: reason,
    status: "Spotify is ready for API secrets. Add the Spotify GitHub secrets to publish live listening and playlists.",
    profile: {
      displayName: "Spotify",
      url: ""
    }
  };
}

function withLastValues(output, previous) {
  const result = { ...output };

  if (!result.current && previous.current) {
    result.current = previous.current;
    result.lastTrack = previous.current;
    result.stale = true;
  }

  if (!Array.isArray(result.playlists) || !result.playlists.length) {
    if (Array.isArray(previous.playlists) && previous.playlists.length) {
      result.playlists = previous.playlists;
      result.stale = true;
    }
  }

  if (!result.profile?.url && previous.profile) {
    result.profile = previous.profile;
    result.stale = true;
  }

  if (result.source === "spotify-web-api") {
    result.lastGoodAt = result.generatedAt;
    result.stale = false;
  } else if (previous.lastGoodAt || previous.generatedAt) {
    result.lastGoodAt = previous.lastGoodAt || previous.generatedAt;
    result.stale = true;
  }

  if (result.stale) {
    result.status = result.lastGoodAt
      ? `Showing last saved Spotify values from ${result.lastGoodAt}.`
      : "Spotify could not refresh right now, so saved values are being shown.";
  }

  return result;
}

async function getAccessToken() {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Spotify token refresh failed: ${data.error || response.status}`);
  }

  return data.access_token;
}

async function spotifyGet(path, token, params = {}) {
  const url = new URL(`https://api.spotify.com/v1/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Spotify API returned ${response.status} for ${path}`);
  }

  return response.json();
}

function toCurrentTrack(playback) {
  const item = playback?.item;
  if (!item) {
    return null;
  }

  const isEpisode = item.type === "episode";
  const artists = isEpisode ? item.show?.name : (item.artists || []).map((artist) => artist.name).join(", ");
  const images = isEpisode ? item.images : item.album?.images;

  return {
    title: item.name || "Spotify track",
    meta: artists || (isEpisode ? "Episode" : "Track"),
    note: playback.is_playing ? "Listening now" : "Paused or recently active",
    image: imageFrom(images),
    url: externalUrl(item),
    isPlaying: Boolean(playback.is_playing),
    progressMs: playback.progress_ms || 0,
    durationMs: item.duration_ms || 0
  };
}

function toPlaylist(playlist) {
  return {
    id: playlist.id,
    title: playlist.name || "Spotify playlist",
    meta: `${playlist.items?.total || playlist.tracks?.total || 0} tracks`,
    note: playlist.description ? playlist.description.replace(/<[^>]+>/g, "") : "Public playlist",
    image: imageFrom(playlist.images),
    url: externalUrl(playlist)
  };
}

async function loadPlaylists(token, profileId) {
  const playlists = [];

  for (let offset = 0; offset < 500; offset += 50) {
    const page = await spotifyGet("me/playlists", token, { limit: 50, offset });
    const items = page?.items || [];

    items.forEach((playlist) => {
      const ownedByProfile = !profileId || playlist.owner?.id === profileId;
      if (ownedByProfile && playlist.public !== false) {
        playlists.push(toPlaylist(playlist));
      }
    });

    if (!page?.next || !items.length) {
      break;
    }
  }

  return playlists;
}

async function main() {
  const previous = await readExistingData();

  if (!clientId || !clientSecret || !refreshToken) {
    const output = withLastValues(fallbackData("spotify-missing-secrets"), previous);
    await mkdir(new URL("../data/", import.meta.url), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    return;
  }

  const token = await getAccessToken();
  const [profile, playback] = await Promise.all([
    spotifyGet("me", token),
    spotifyGet("me/player/currently-playing", token, { additional_types: "track,episode" }).catch(() => null)
  ]);
  const playlists = await loadPlaylists(token, profile?.id);
  const current = toCurrentTrack(playback);

  const output = withLastValues(
    {
      generatedAt: new Date().toISOString(),
      source: "spotify-web-api",
      status: current?.isPlaying ? "Spotify is live from the Web API." : "Spotify refreshed. Nothing is actively playing right now.",
      profile: {
        id: profile?.id || "",
        displayName: profile?.display_name || "Spotify Profile",
        url: externalUrl(profile),
        image: imageFrom(profile?.images)
      },
      current,
      lastTrack: current || previous.current || previous.lastTrack,
      playlists
    },
    previous
  );

  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Wrote Spotify data to ${outputPath.pathname}`);
}

main().catch(async (error) => {
  console.error(error);
  const previous = await readExistingData();
  const output = withLastValues(fallbackData("spotify-api-error"), previous);
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
});
