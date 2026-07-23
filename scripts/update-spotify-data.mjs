import { mkdir, readFile, writeFile } from "node:fs/promises";
import { loadMusicEnrichment } from "./music-enrichment.mjs";
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

function factScore(fact) {
  const text = String(fact || "").toLowerCase();
  let score = 0;

  [
    "biography",
    "formed",
    "from ",
    "mood",
    "style",
    "also known",
    "annotation",
    "page views",
    "released",
    "explicit"
  ].forEach((term) => {
    if (text.includes(term)) {
      score += 3;
    }
  });

  [
    "popularity score",
    "followers",
    "primary artist",
    "track number",
    "length:",
    "album:"
  ].forEach((term) => {
    if (text.includes(term)) {
      score -= 2;
    }
  });

  if (text.length > 70) {
    score += 1;
  }

  return score;
}

function compactFacts(facts, limit = 10) {
  const seen = new Set();
  const uniqueFacts = [];

  facts.filter(Boolean).forEach((fact) => {
    const key = String(fact).toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueFacts.push(fact);
    }
  });

  return uniqueFacts
    .map((fact, index) => ({ fact, index, score: factScore(fact) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((item) => item.fact);
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

  if (previous.insights) {
    if (!result.insights || !Object.keys(result.insights).length) {
      result.insights = previous.insights;
      result.stale = true;
    } else {
      const currentTaste = result.insights.taste || {};
      const previousTaste = previous.insights.taste || {};
      ["shortTerm", "mediumTerm", "longTerm"].forEach((range) => {
        if (!currentTaste[range]?.artists?.length && previousTaste[range]?.artists?.length) {
          currentTaste[range] = previousTaste[range];
        }
      });
      result.insights.taste = currentTaste;
      if (!result.insights.recentlyPlayed?.length && previous.insights.recentlyPlayed?.length) {
        result.insights.recentlyPlayed = previous.insights.recentlyPlayed;
      }
      if (!result.insights.discovery?.length && previous.insights.discovery?.length) {
        result.insights.discovery = previous.insights.discovery;
      }
      if (!result.insights.playlistAnalytics?.sampledTracks && previous.insights.playlistAnalytics?.sampledTracks) {
        result.insights.playlistAnalytics = previous.insights.playlistAnalytics;
      }
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

function playbackScore(playback, sourceName) {
  if (!playback?.item) {
    return -1;
  }

  let score = sourceName === "playback-state" ? 2 : 0;

  if (playback.is_playing) {
    score += 10;
  }

  if (playback.device?.is_active) {
    score += 3;
  }

  if (Number.isFinite(Number(playback.progress_ms))) {
    score += 1;
  }

  if (playback.currently_playing_type === "track") {
    score += 1;
  }

  return score;
}

function selectActivePlayback(currentlyPlaying, playbackState) {
  return [
    { playback: playbackState, sourceName: "playback-state" },
    { playback: currentlyPlaying, sourceName: "currently-playing" }
  ]
    .filter((candidate) => candidate.playback?.item)
    .map((candidate) => ({
      ...candidate,
      score: playbackScore(candidate.playback, candidate.sourceName)
    }))
    .sort((a, b) => b.score - a.score)[0]?.playback || null;
}

function selectedPlaybackSource(playback) {
  return playback?.device ? "me/player" : "me/player/currently-playing";
}

function selectedPlaybackSummary(playback) {
  if (!playback?.item) {
    return null;
  }

  return {
    endpoint: selectedPlaybackSource(playback),
    isPlaying: Boolean(playback.is_playing),
    device: playback.device?.name || "",
    deviceActive: Boolean(playback.device?.is_active),
    trackUri: playback.item.uri || ""
  };
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
    album?.releaseDate ? `Released: ${album.releaseDate}` : "",
    item?.explicit ? "Marked explicit on Spotify." : ""
  ], 4);
}

function artistFacts(artist) {
  return compactFacts([
    Array.isArray(artist?.genres) && artist.genres.length ? `Known for: ${artist.genres.slice(0, 3).join(", ")}` : "",
    artist?.name ? `Primary artist: ${artist.name}` : ""
  ], 4);
}

function spotifySourceReport(track, baseSongFacts, baseArtistFacts) {
  return {
    source: "Spotify",
    status: "matched",
    matched: {
      song: track.title || "",
      artist: track.meta || "",
      album: track.album?.name || "",
      trackId: track.url ? spotifyIdFromUri(track.url, "track") : ""
    },
    usedFor: [
      "playback state",
      "progress timing",
      "base track metadata",
      baseSongFacts.length ? "song facts" : "",
      baseArtistFacts.length ? "artist facts" : "",
      track.image ? "primary artwork" : ""
    ].filter(Boolean),
    facts: {
      song: baseSongFacts.length,
      artist: baseArtistFacts.length
    },
    links: track.url ? 1 : 0,
    artwork: Boolean(track.image),
    note: "Spotify is the source of the live playback state, progress, current track, album, artist, and fallback artwork."
  };
}

function buildPublishedUsing(baseTrack, enrichment, baseSongFacts, baseArtistFacts) {
  const sourceReports = [
    spotifySourceReport(baseTrack, baseSongFacts, baseArtistFacts),
    ...(enrichment.sourceReports || [])
  ];
  const enrichmentSources = enrichment.sources || [];
  const imageSource = enrichment.imageSource || (baseTrack.image ? "Spotify" : "");
  const songFactSources = [
    baseSongFacts.length ? "Spotify" : "",
    ...enrichmentSources
  ].filter(Boolean);
  const artistFactSources = [
    baseArtistFacts.length ? "Spotify" : "",
    ...enrichmentSources
  ].filter(Boolean);
  const mixedFactSources = [...new Set([...songFactSources, ...artistFactSources])];
  const matchedExternalSources = enrichment.crossReference?.matchedSources || [];
  const crossReferenceSummary = matchedExternalSources.length
    ? `${matchedExternalSources.join(" and ")} were cross-referenced against the Spotify track. Published facts mix ${mixedFactSources.join(", ") || "no sources"}; artwork uses ${imageSource || "none"}; playback and progress use Spotify.`
    : `Genius and TheAudioDB were checked against the Spotify track but did not publish external facts. Published facts use ${mixedFactSources.join(", ") || "no sources"}; playback and progress use Spotify.`;

  return {
    dataSources: sourceReports,
    enrichment: {
      sources: enrichmentSources,
      links: enrichment.links || [],
      sourceReports: enrichment.sourceReports || [],
      crossReference: {
        ...(enrichment.crossReference || {}),
        summary: crossReferenceSummary,
        spotifyMatch: {
          song: baseTrack.title || "",
          artist: baseTrack.meta || "",
          album: baseTrack.album?.name || ""
        }
      }
    },
    publishedUsing: {
      playback: "Spotify",
      progress: "Spotify",
      baseMetadata: "Spotify",
      artwork: imageSource || "none",
      songFacts: songFactSources,
      artistFacts: artistFactSources,
      sourceLinks: [
        baseTrack.url ? "Spotify" : "",
        ...(enrichment.links || []).map((link) => link.source || link.label || "").filter(Boolean)
      ].filter(Boolean)
    }
  };
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
  const progressMs = playback.progress_ms || 0;

  if (context) {
    context.listenedMs = progressMs;
    context.observedAt = generatedAt;
    context.isPlaying = Boolean(playback.is_playing);
  }

  const baseSongFacts = songFacts(item, album);
  const baseArtistFacts = artistFacts(artist);
  const baseTrack = {
    title: item.name || "Spotify track",
    meta: artists || (isEpisode ? "Episode" : "Track"),
    note: playback.is_playing ? "Listening now" : "Paused or recently active",
    image: imageFrom(images),
    url: externalUrl(item),
    isPlaying: Boolean(playback.is_playing),
    source: playback.device ? "playback-state" : "currently-playing",
    observedAt: generatedAt,
    progressMs,
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
    songFacts: baseSongFacts,
    artistFacts: baseArtistFacts
  };

  const enrichment = await loadMusicEnrichment({
    title: baseTrack.title,
    meta: baseTrack.meta,
    artistName: baseTrack.artist?.name || artists,
    albumName: album?.name || ""
  });

  const publishAudit = buildPublishedUsing(baseTrack, enrichment, baseSongFacts, baseArtistFacts);

  return {
    ...baseTrack,
    image: enrichment.image || baseTrack.image,
    songFacts: compactFacts([
      ...baseTrack.songFacts,
      ...(enrichment.songFacts || [])
    ]),
    artistFacts: compactFacts([
      ...baseTrack.artistFacts,
      ...(enrichment.artistFacts || [])
    ]),
    enrichmentSources: enrichment.sources || [],
    enrichmentLinks: enrichment.links || [],
    dataSources: publishAudit.dataSources,
    enrichment: publishAudit.enrichment,
    publishedUsing: publishAudit.publishedUsing
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

function toInsightTrack(item, extra = {}) {
  if (!item) return null;
  return {
    id: item.id || "",
    title: item.name || "Spotify track",
    meta: (item.artists || []).map((artist) => artist.name).filter(Boolean).join(", ") || "Spotify",
    artists: (item.artists || []).map((artist) => artist.name).filter(Boolean),
    image: imageFrom(item.album?.images || item.images),
    url: externalUrl(item),
    albumTitle: item.album?.name || "",
    releaseDate: item.album?.release_date || item.release_date || "",
    durationMs: Number(item.duration_ms || 0),
    popularity: Number(item.popularity || 0),
    ...extra
  };
}

async function resolvePlaybackContext(entry, token, playlistCache) {
  const context = entry?.context;
  const track = entry?.track;
  const fallback = {
    contextType: "Album",
    contextTitle: track?.album?.name || "",
    contextUrl: externalUrl(track?.album)
  };

  if (context?.type !== "playlist") {
    return fallback;
  }

  const playlistId = spotifyIdFromUri(context.uri || context.href, "playlist");
  if (!playlistId) {
    return { ...fallback, contextType: "Playlist" };
  }

  if (!playlistCache.has(playlistId)) {
    playlistCache.set(playlistId, spotifyGet(`playlists/${encodeURIComponent(playlistId)}`, token, {
      fields: "id,name,external_urls"
    }).catch(() => null));
  }

  const playlist = await playlistCache.get(playlistId);
  return playlist?.name
    ? { contextType: "Playlist", contextTitle: playlist.name, contextUrl: externalUrl(playlist) }
    : { ...fallback, contextType: "Playlist" };
}

function toInsightArtist(item) {
  return {
    id: item.id || "",
    title: item.name || "Spotify artist",
    meta: Array.isArray(item.genres) && item.genres.length ? item.genres.slice(0, 2).join(" / ") : "Top artist",
    genres: item.genres || [],
    image: imageFrom(item.images),
    url: externalUrl(item),
    popularity: Number(item.popularity || 0)
  };
}

async function loadTaste(token) {
  const ranges = [["shortTerm", "short_term"], ["mediumTerm", "medium_term"], ["longTerm", "long_term"]];
  const output = {};
  let successfulRanges = 0;
  await Promise.all(ranges.map(async ([key, timeRange]) => {
    try {
      const [artists, tracks] = await Promise.all([
        spotifyGet("me/top/artists", token, { time_range: timeRange, limit: 10 }),
        spotifyGet("me/top/tracks", token, { time_range: timeRange, limit: 10 })
      ]);
      output[key] = {
        artists: (artists?.items || []).map(toInsightArtist),
        tracks: (tracks?.items || []).map((item) => toInsightTrack(item)).filter(Boolean)
      };
      successfulRanges += 1;
    } catch (error) {
      output[key] = { artists: [], tracks: [] };
    }
  }));
  return { ranges: output, ready: successfulRanges > 0 };
}

async function loadRecentlyPlayed(token) {
  try {
    const page = await spotifyGet("me/player/recently-played", token, { limit: 20 });
    const playlistCache = new Map();
    const tracks = await Promise.all((page?.items || []).map(async (entry) => {
      const context = await resolvePlaybackContext(entry, token, playlistCache);
      return toInsightTrack(entry.track, {
        playedAt: entry.played_at || "",
        ...context
      });
    }));
    return tracks.filter(Boolean);
  } catch (error) {
    console.warn(`Spotify recently played history unavailable: ${error.message}`);
    return [];
  }
}

async function loadPlaylistAnalytics(token, playlists, taste) {
  const sample = playlists.slice(0, 8);
  const artistCounts = new Map();
  const decadeCounts = new Map();
  let sampledTracks = 0;
  let durationMs = 0;
  await Promise.all(sample.map(async (playlist) => {
    try {
      const page = await spotifyGet(`playlists/${encodeURIComponent(playlist.id)}/items`, token, {
        limit: 100,
        fields: "items(item(id,name,duration_ms,artists(id,name),album(release_date)))"
      });
      (page?.items || []).forEach((entry) => {
        const track = entry.item || entry.track;
        if (!track) return;
        sampledTracks += 1;
        durationMs += Number(track.duration_ms || 0);
        (track.artists || []).forEach((artist) => {
          if (!artist.name) return;
          const key = artist.id || artist.name.toLowerCase();
          const existing = artistCounts.get(key) || { id: artist.id || "", title: artist.name, count: 0 };
          existing.count += 1;
          artistCounts.set(key, existing);
        });
        const year = Number(String(track.album?.release_date || "").slice(0, 4));
        if (year) {
          const decade = `${Math.floor(year / 10) * 10}s`;
          decadeCounts.set(decade, (decadeCounts.get(decade) || 0) + 1);
        }
      });
    } catch (error) {
      // A private or unavailable playlist should not block the rest of the snapshot.
    }
  }));
  const genreCounts = new Map();
  Object.values(taste || {}).flatMap((range) => range.artists || []).forEach((artist) => {
    (artist.genres || []).forEach((genre) => genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1));
  });
  const sorted = (map) => [...map.entries()].sort((a, b) => b[1] - a[1]);
  const recurring = [...artistCounts.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  const recurringIds = recurring.map((artist) => artist.id).filter(Boolean);
  const tasteArtists = new Map(
    Object.values(taste || {})
      .flatMap((range) => range.artists || [])
      .flatMap((artist) => [
        [artist.id || "", artist],
        [String(artist.title || "").toLowerCase(), artist]
      ])
      .filter(([key]) => key)
  );
  const profileResults = await Promise.all(
    recurringIds.map((id) => spotifyGet(`artists/${encodeURIComponent(id)}`, token).catch(() => null))
  );
  const artistProfiles = new Map(profileResults.filter(Boolean).map((artist) => [artist.id, artist]));
  return {
    playlistCount: playlists.length,
    trackCount: playlists.reduce((sum, playlist) => sum + Number(String(playlist.meta || "").match(/\d+/)?.[0] || 0), 0),
    estimatedHours: Number((durationMs / 3600000).toFixed(1)),
    recurringArtists: recurring.map((artist) => {
      const profile = artistProfiles.get(artist.id)
        || tasteArtists.get(artist.id)
        || tasteArtists.get(artist.title.toLowerCase());
      return {
        id: artist.id,
        title: artist.title,
        meta: `${artist.count} sampled appearances`,
        count: artist.count,
        image: imageFrom(profile?.images) || profile?.image || "",
        url: externalUrl(profile) || profile?.url || ""
      };
    }),
    genres: sorted(genreCounts).slice(0, 8).map(([label, value]) => ({ label, value })),
    decades: sorted(decadeCounts).map(([label, value]) => ({ label, value })),
    sampledPlaylists: sample.length,
    sampledTracks
  };
}

async function loadDiscovery(token, taste) {
  const artists = taste?.shortTerm?.artists?.length ? taste.shortTerm.artists : taste?.mediumTerm?.artists || [];
  const releases = [];
  await Promise.all(artists.slice(0, 6).map(async (artist) => {
    if (!artist.id) return;
    try {
      const page = await spotifyGet(`artists/${encodeURIComponent(artist.id)}/albums`, token, { include_groups: "album,single", market: "AU", limit: 4 });
      const newest = (page?.items || []).sort((a, b) => String(b.release_date || "").localeCompare(String(a.release_date || "")))[0];
      const release = toInsightTrack(newest, { meta: `${artist.title} · ${newest?.album_type || "release"}` });
      if (release) releases.push(release);
    } catch (error) {
      // Discovery is additive; the rest of Spotify should still publish.
    }
  }));
  return releases.sort((a, b) => String(b.releaseDate || "").localeCompare(String(a.releaseDate || "")));
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
  const tasteResult = await loadTaste(token);
  const [recentlyPlayed, playlistAnalytics, discovery] = await Promise.all([
    loadRecentlyPlayed(token),
    loadPlaylistAnalytics(token, playlists, tasteResult.ranges),
    loadDiscovery(token, tasteResult.ranges)
  ]);
  const generatedAt = new Date().toISOString();
  const selectedPlayback = selectActivePlayback(currentlyPlaying, playbackState);
  const current = await toCurrentTrack(selectedPlayback, token, generatedAt);
  const lastTrack = current || lastUsefulTrack(previous);
  const status = current?.isPlaying
    ? "Spotify is live from the Web API."
    : "Spotify refreshed. No active playback was reported; private sessions, ads, local files, or paused devices may not expose a current track.";

  const output = withLastValues(
    {
      generatedAt,
      source: "spotify-web-api",
      status,
      selectedPlayback: selectedPlaybackSummary(selectedPlayback),
      profile: {
        id: profile?.id || "",
        displayName: profile?.display_name || "Spotify Profile",
        url: externalUrl(profile),
        image: imageFrom(profile?.images)
      },
      current: current || idleTrack(previous),
      lastTrack,
      playlists,
      insights: {
        taste: tasteResult.ranges,
        recentlyPlayed,
        playlistAnalytics,
        discovery,
        scopesReady: tasteResult.ready && recentlyPlayed.length > 0
      }
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
