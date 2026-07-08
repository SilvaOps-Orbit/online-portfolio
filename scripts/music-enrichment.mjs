import { cleanText } from "./text-sanitizer.mjs";

const geniusAccessToken = process.env.GENIUS_ACCESS_TOKEN || "";
const audioDbBaseUrl = (process.env.AUDIODB_BASE_URL || "https://www.theaudiodb.com/api/v1/json").replace(/\/+$/, "");
const audioDbApiKey = process.env.AUDIODB_API_KEY || "123";
const maxFactLength = 180;

function normalizeText(value) {
  const text = cleanText(String(value || "")).replace(/\s+/g, " ").trim();
  return text.length > maxFactLength ? `${text.slice(0, maxFactLength - 3).trim()}...` : text;
}

function addFact(facts, value, source) {
  const text = normalizeText(value);
  if (!text) return;

  const fact = source ? `${source}: ${text}` : text;
  const exists = facts.some((item) => item.toLowerCase() === fact.toLowerCase());
  if (!exists) {
    facts.push(fact);
  }
}

function firstSentence(value) {
  const text = normalizeText(value);
  if (!text) return "";

  const match = text.match(/^(.+?[.!?])\s/);
  return normalizeText(match?.[1] || text);
}

function formatDuration(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const milliseconds = Number(raw);
  if (Number.isFinite(milliseconds) && milliseconds > 999) {
    const totalSeconds = Math.round(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  return normalizeText(raw);
}

function firstArrayItem(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length) {
      return value[0];
    }
  }

  return null;
}

function firstHttpsUrl(...values) {
  return values.find((value) => typeof value === "string" && /^https:\/\//i.test(value)) || "";
}

function sourceReport({ source, status, matched = {}, usedFor = [], note = "", facts = {}, links = 0, artwork = false }) {
  return {
    source,
    status,
    matched,
    usedFor,
    facts,
    links,
    artwork,
    note
  };
}

async function fetchJson(url, headers = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...headers
      }
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    return null;
  }
}

async function geniusGet(path, params = {}) {
  if (!geniusAccessToken) {
    return null;
  }

  const url = new URL(`https://api.genius.com/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return fetchJson(url, {
    Authorization: `Bearer ${geniusAccessToken}`
  });
}

async function audioDbGet(endpoint, params = {}) {
  if (!audioDbApiKey) {
    return null;
  }

  const url = new URL(`${audioDbBaseUrl}/${encodeURIComponent(audioDbApiKey)}/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return fetchJson(url);
}

async function loadGeniusProvider(track) {
  if (!geniusAccessToken || !track?.title) {
    return {
      source: "Genius",
      status: "not-configured",
      songFacts: [],
      artistFacts: [],
      image: "",
      links: [],
      report: sourceReport({
        source: "Genius",
        status: "not-configured",
        note: "GENIUS_ACCESS_TOKEN is not set, so Genius was not used for this publish."
      })
    };
  }

  const query = [track.title, track.artistName || track.meta].filter(Boolean).join(" ");
  const search = await geniusGet("search", { q: query });
  const hit = search?.response?.hits?.find((entry) => entry?.type === "song" && entry?.result?.id)?.result;
  if (!hit) {
    return {
      source: "Genius",
      status: "no-match",
      songFacts: [],
      artistFacts: [],
      image: "",
      links: [],
      report: sourceReport({
        source: "Genius",
        status: "no-match",
        matched: { searchQuery: query },
        note: "Genius was checked but did not return a usable song match."
      })
    };
  }

  const songResponse = await geniusGet(`songs/${encodeURIComponent(hit.id)}`);
  const song = songResponse?.response?.song || hit;
  const primaryArtist = song?.primary_artist || hit.primary_artist || {};
  const artistResponse = primaryArtist?.id ? await geniusGet(`artists/${encodeURIComponent(primaryArtist.id)}`) : null;
  const artist = artistResponse?.response?.artist || primaryArtist;
  const songFacts = [];
  const artistFacts = [];

  addFact(songFacts, song.full_title ? `Matched ${song.full_title}` : "", "Genius");
  addFact(songFacts, song.release_date_for_display ? `Released ${song.release_date_for_display}` : "", "Genius");
  addFact(songFacts, Number.isFinite(song.stats?.pageviews) ? `${song.stats.pageviews.toLocaleString("en-US")} Genius page views` : "", "Genius");
  addFact(songFacts, Number.isFinite(song.annotation_count) ? `${song.annotation_count.toLocaleString("en-US")} Genius annotations` : "", "Genius");

  addFact(artistFacts, artist.name ? `Primary artist page is ${artist.name}` : "", "Genius");
  addFact(artistFacts, Number.isFinite(artist.followers_count) ? `${artist.followers_count.toLocaleString("en-US")} Genius followers` : "", "Genius");
  addFact(artistFacts, Array.isArray(artist.alternate_names) && artist.alternate_names.length
    ? `Also known as ${artist.alternate_names.slice(0, 3).join(", ")}`
    : "", "Genius");
  addFact(artistFacts, firstSentence(artist.description_preview?.plain), "Genius");

  const links = [
    song.url
      ? { label: "Genius Song", url: song.url, source: "Genius" }
      : null,
    artist.url
      ? { label: "Genius Artist", url: artist.url, source: "Genius" }
      : null
  ].filter(Boolean);
  const image = song.song_art_image_url || song.header_image_thumbnail_url || "";
  const usedFor = [
    songFacts.length ? "song facts" : "",
    artistFacts.length ? "artist facts" : "",
    image ? "artwork candidate" : "",
    links.length ? "source links" : ""
  ].filter(Boolean);

  return {
    source: "Genius",
    status: "matched",
    songFacts,
    artistFacts,
    image,
    imageSource: image ? "Genius" : "",
    links,
    report: sourceReport({
      source: "Genius",
      status: "matched",
      matched: {
        searchQuery: query,
        song: song.full_title || hit.full_title || song.title || "",
        artist: artist.name || primaryArtist.name || "",
        geniusSongId: song.id || hit.id || ""
      },
      usedFor,
      facts: {
        song: songFacts.length,
        artist: artistFacts.length
      },
      links: links.length,
      artwork: Boolean(image)
    })
  };
}

async function loadAudioDbProvider(track) {
  const artistName = track?.artistName || track?.meta || "";
  const trackTitle = track?.title || "";
  const albumName = track?.albumName || "";

  if (!artistName && !trackTitle) {
    return {
      source: "TheAudioDB",
      status: "no-input",
      songFacts: [],
      artistFacts: [],
      image: "",
      links: [],
      report: sourceReport({
        source: "TheAudioDB",
        status: "no-input",
        note: "TheAudioDB was not checked because the current item had no artist or track title."
      })
    };
  }

  const [artistData, trackData, albumData] = await Promise.all([
    artistName ? audioDbGet("search.php", { s: artistName }) : null,
    artistName && trackTitle ? audioDbGet("searchtrack.php", { s: artistName, t: trackTitle }) : null,
    artistName && albumName ? audioDbGet("searchalbum.php", { s: artistName, a: albumName }) : null
  ]);

  const artist = firstArrayItem(artistData?.artists);
  const audioTrack = firstArrayItem(trackData?.track, trackData?.tracks, trackData?.songs);
  const album = firstArrayItem(albumData?.album, albumData?.albums);

  if (!artist && !audioTrack && !album) {
    return {
      source: "TheAudioDB",
      status: "no-match",
      songFacts: [],
      artistFacts: [],
      image: "",
      links: [],
      report: sourceReport({
        source: "TheAudioDB",
        status: "no-match",
        matched: {
          artistSearch: artistName,
          trackSearch: trackTitle,
          albumSearch: albumName
        },
        note: "TheAudioDB was checked but did not return a usable artist, track, or album match."
      })
    };
  }

  const songFacts = [];
  const artistFacts = [];

  addFact(songFacts, audioTrack?.strAlbum ? `Album: ${audioTrack.strAlbum}` : "", "TheAudioDB");
  addFact(songFacts, album?.intYearReleased ? `Album released in ${album.intYearReleased}` : "", "TheAudioDB");
  addFact(songFacts, audioTrack?.strGenre || album?.strGenre ? `Genre: ${audioTrack?.strGenre || album?.strGenre}` : "", "TheAudioDB");
  addFact(songFacts, audioTrack?.strMood ? `Mood: ${audioTrack.strMood}` : "", "TheAudioDB");
  addFact(songFacts, audioTrack?.intDuration ? `Length: ${formatDuration(audioTrack.intDuration)}` : "", "TheAudioDB");
  addFact(songFacts, audioTrack?.intTrackNumber ? `Track number ${audioTrack.intTrackNumber}` : "", "TheAudioDB");
  addFact(songFacts, firstSentence(audioTrack?.strDescriptionEN || album?.strDescriptionEN), "TheAudioDB");

  addFact(artistFacts, artist?.strGenre ? `Artist genre: ${artist.strGenre}` : "", "TheAudioDB");
  addFact(artistFacts, artist?.strStyle ? `Style: ${artist.strStyle}` : "", "TheAudioDB");
  addFact(artistFacts, artist?.strMood ? `Mood: ${artist.strMood}` : "", "TheAudioDB");
  addFact(artistFacts, artist?.intFormedYear ? `Formed in ${artist.intFormedYear}` : "", "TheAudioDB");
  addFact(artistFacts, artist?.strCountry ? `From ${artist.strCountry}` : "", "TheAudioDB");
  addFact(artistFacts, firstSentence(artist?.strBiographyEN), "TheAudioDB");

  const image = firstHttpsUrl(
    audioTrack?.strTrackThumb,
    album?.strAlbumThumb,
    artist?.strArtistThumb,
    artist?.strArtistFanart,
    artist?.strArtistFanart2
  );
  const usedFor = [
    songFacts.length ? "song facts" : "",
    artistFacts.length ? "artist facts" : "",
    image ? "artwork candidate" : ""
  ].filter(Boolean);

  return {
    source: "TheAudioDB",
    status: "matched",
    songFacts,
    artistFacts,
    image,
    imageSource: image ? "TheAudioDB" : "",
    links: [],
    report: sourceReport({
      source: "TheAudioDB",
      status: "matched",
      matched: {
        artist: artist?.strArtist || "",
        track: audioTrack?.strTrack || "",
        album: album?.strAlbum || audioTrack?.strAlbum || "",
        artistId: artist?.idArtist || "",
        trackId: audioTrack?.idTrack || "",
        albumId: album?.idAlbum || ""
      },
      usedFor,
      facts: {
        song: songFacts.length,
        artist: artistFacts.length
      },
      artwork: Boolean(image)
    })
  };
}

function mergeProviderResults(results) {
  const output = {
    songFacts: [],
    artistFacts: [],
    image: "",
    imageSource: "",
    links: [],
    sources: [],
    sourceReports: [],
    crossReference: {
      summary: "",
      matchedSources: [],
      usedSources: []
    }
  };

  results
    .filter((result) => result.status === "fulfilled" && result.value)
    .map((result) => result.value)
    .forEach((provider) => {
      provider.songFacts?.forEach((fact) => addFact(output.songFacts, fact));
      provider.artistFacts?.forEach((fact) => addFact(output.artistFacts, fact));
      if (!output.image && provider.image) {
        output.image = provider.image;
        output.imageSource = provider.imageSource || provider.source || "";
      }
      provider.links?.forEach((link) => output.links.push(link));
      if (provider.report) {
        output.sourceReports.push(provider.report);
      }
      if (provider.source && provider.status === "matched" && provider.report?.usedFor?.length) {
        output.sources.push(provider.source);
      }
    });

  output.sources = [...new Set(output.sources)];
  output.crossReference.matchedSources = output.sourceReports
    .filter((report) => report.status === "matched")
    .map((report) => report.source);
  output.crossReference.usedSources = output.sources;
  output.crossReference.summary = output.crossReference.matchedSources.length
    ? `${output.crossReference.matchedSources.join(" and ")} matched the Spotify track data. Published enrichment uses ${output.crossReference.usedSources.join(", ") || "no external source facts"}; Spotify remains the source for playback state.`
    : "Genius and TheAudioDB were checked, but no external match was published; Spotify remains the source for playback state.";
  return output;
}

export async function loadMusicEnrichment(track) {
  const providers = [
    loadGeniusProvider(track),
    loadAudioDbProvider(track)
  ];

  return mergeProviderResults(await Promise.allSettled(providers));
}
