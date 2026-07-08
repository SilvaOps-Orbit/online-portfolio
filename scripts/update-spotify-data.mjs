import { mkdir, readFile, writeFile } from "node:fs/promises";
import { cleanText } from "./text-sanitizer.mjs";

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

function spotifyIdFromUri(value, expectedType) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  const parts = value.split(":");
  if (parts.length === 3 && parts[0] === "spotify" && (!expectedType || parts[1] === expectedType)) {
    return parts[2];
  }

  const match = value.match(/\/(?:playlist|artist|album|track)\/([A-Za-z0-9]+)/);
  return match?.[1] || "";
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function compactFacts(facts) {
  return facts.filter(Boolean).slice(0, 5);
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

function isUsefulTrack(track) {
  if (!track || typeof track !== "object") {
    return false;
  }

  return Boolean(track.title)
    && track.title !== "Spotify not connected yet"
    && track.meta !== "Live listening needs Spotify API secrets";
}

function lastUsefulTrack(previous) {
  if (isUsefulTrack(previous?.current)) {
    return previous.current;
  }

  if (isUsefulTrack(previous?.lastTrack)) {
    return previous.lastTrack;
  }

  return null;
}

function idleTrack(previous) {
  const lastTrack = lastUsefulTrack(previous);

  return {
    title: "Nothing playing right now",
    meta: "Spotify is connected",
    note: lastTrack
      ? `Last saved track: ${lastTrack.title}`
      : "No active playback was reported during the latest refresh.",
    image: lastTrack?.image || "",
    url: lastTrack?.url || "",
    isPlaying: false
  };
}

function withLastValues(output, previous) {
  const result = { ...output };
  const previousTrack = lastUsefulTrack(previous);

  if (!result.current && previousTrack) {
    result.current = previousTrack;
    result.lastTrack = previousTrack;
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
    const hint = data.error === "invalid_grant"
      ? " Refresh token expired or was revoked; generate a new SPOTIFY_REFRESH_TOKEN."
      : "";
    throw new Error(`Spotify token refresh failed: ${data.error || response.status}.${hint}`);
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

async function loadArtistDetails(item, token) {
  const primaryArtist = item?.artists?.[0];
  const artistId = primaryArtist?.id || spotifyIdFromUri(primaryArtist?.uri, "artist");

  if (!artistId) {
    return null;
  }

  return spotifyGet(`artists/${encodeURIComponent(artistId)}`, token).catch(() => null);
}

async function loadPlaylistContext(playback, token) {
  const context = playback?.context;
  if (context?.type !== "playlist") {
    return null;
  }

  const playlistId = spotifyIdFromUri(context.uri, "playlist") || spotifyIdFromUri(context.href, "playlist");
  if (!playlistId) {
    return {
      type: "playlist",
      title: "Spotify playlist",
      url: externalUrl(context)
    };
  }

  const playlist = await spotifyGet(`playlists/${encodeURIComponent(playlistId)}`, token, {
    fields: "id,name,external_urls,images,owner(display_name)"
  }).catch(() => null);

  return {
    id: playlistId,
    type: "playlist",
    title: playlist?.name || "Spotify playlist",
    meta: playlist?.owner?.display_name ? `By ${playlist.owner.display_name}` : "",
    image: imageFrom(playlist?.images),
    url: externalUrl(playlist) || externalUrl(context)
  };
}

function songFacts(item, album) {
  return compactFacts([
    album?.name ? `Album: ${album.name}` : "",
    album?.releaseDate ? `Released: ${album.releaseDate}` : "",
    item?.track_number ? `Track ${item.track_number}${album?.totalTracks ? ` of ${album.totalTracks}` : ""}` : "",
    item?.duration_ms ? `Length: ${formatDuration(item.duration_ms)}` : "",
    Number.isFinite(item?.popularity) ? `Spotify popularity score: ${item.popularity}/100` : "",
    item?.explicit ? "Marked explicit on Spotify." : ""
  ]);
}

function artistFacts(artist) {
  return compactFacts([
    artist?.followers?.total ? `${formatNumber(artist.followers.total)} Spotify followers` : "",
    Number.isFinite(artist?.popularity) ? `Artist popularity score: ${artist.popularity}/100` : "",
    Array.isArray(artist?.genres) && artist.genres.length ? `Known for: ${artist.genres.slice(0, 3).join(", ")}` : "",
    artist?.name ? `Primary artist: ${artist.name}` : ""
  ]);
}

async function toCurrentTrack(playback, token, generatedAt) {
  const item = playback?.item;
  if (!item) {
    return null;
  }

  const isEpisode = item.type === "episode";
  const artists = isEpisode ? item.show?.name : (item.artists || []).map((artist) => artist.name).join(", ");
  const images = isEpisode ? item.images : item.album?.images;
  const album = !isEpisode && item.album
    ? {
        id: item.album.id || "",
        name: item.album.name || "",
        releaseDate: item.album.release_date || "",
        totalTracks: item.album.total_tracks || 0,
        image: imageFrom(item.album.images),
        url: externalUrl(item.album)
      }
    : null;
  const [artist, context] = isEpisode
    ? [null, await loadPlaylistContext(playback, token)]
    : await Promise.all([
        loadArtistDetails(item, token),
        loadPlaylistContext(playback, token)
      ]);

  return {
    title: item.name || "Spotify track",
    meta: artists || (isEpisode ? "Episode" : "Track"),
    note: playback.is_playing ? "Listening now" : "Paused or recently active",
    image: imageFrom(images),
    url: externalUrl(item),
    isPlaying: Boolean(playback.is_playing),
    source: playback.device ? "playback-state" : "currently-playing",
    observedAt: generatedAt,
    progressMs: playback.progress_ms || 0,
    durationMs: item.duration_ms || 0,
    album,
    context,
    artist: artist
      ? {
          id: artist.id || "",
          name: artist.name || artists || "",
          image: imageFrom(artist.images),
          url: externalUrl(artist),
          genres: artist.genres || [],
          followers: artist.followers?.total || 0,
          popularity: artist.popularity
        }
      : null,
    songFacts: songFacts(item, album),
    artistFacts: artistFacts(artist)
  };
}

function toPlaylist(playlist) {
  return {
    id: playlist.id,
    title: playlist.name || "Spotify playlist",
    meta: `${playlist.items?.total || playlist.tracks?.total || 0} tracks`,
    note: playlist.description ? cleanText(playlist.description) : "Public playlist",
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
  const [profile, currentlyPlaying, playbackState] = await Promise.all([
    spotifyGet("me", token),
    spotifyGet("me/player/currently-playing", token, { additional_types: "track,episode" }).catch(() => null),
    spotifyGet("me/player", token, { additional_types: "track,episode" }).catch(() => null)
  ]);
  const playlists = await loadPlaylists(token, profile?.id);
  const generatedAt = new Date().toISOString();
  const current = await toCurrentTrack(currentlyPlaying, token, generatedAt) || await toCurrentTrack(playbackState, token, generatedAt);
  const lastTrack = current || lastUsefulTrack(previous);
  const status = current?.isPlaying
    ? "Spotify is live from the Web API."
    : "Spotify refreshed. No active playback was reported; private sessions, ads, local files, or paused devices may not expose a current track.";

  const output = withLastValues(
    {
      generatedAt,
      source: "spotify-web-api",
      status,
      profile: {
        id: profile?.id || "",
        displayName: profile?.display_name || "Spotify Profile",
        url: externalUrl(profile),
        image: imageFrom(profile?.images)
      },
      current: current || idleTrack(previous),
      lastTrack,
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
