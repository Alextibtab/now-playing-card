import { NowPlayingData } from "../../types.ts";
import { processArtFromUrl } from "../../utils/image-processing.ts";

const LASTFM_API_URL = "https://ws.audioscrobbler.com/2.0/";

interface LastFmImage {
  "#text": string;
  size: string;
}

interface LastFmRecentTrack {
  artist: { "#text": string; mbid?: string };
  name: string;
  album?: { "#text": string };
  image: LastFmImage[];
  "@attr"?: { nowplaying?: string };
  mbid?: string;
}

interface LastFmRecentTracksResponse {
  recenttracks?: {
    track: LastFmRecentTrack[];
    "@attr"?: { user: string };
  };
  error?: number;
  message?: string;
}

interface LastFmTrackInfoResponse {
  track?: {
    name: string;
    artist: { name: string };
    album?: {
      artist: string;
      title: string;
      image: LastFmImage[];
    };
  };
  error?: number;
  message?: string;
}

let cachedData: NowPlayingData | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 30000;

function getLargestImageUrl(images: LastFmImage[]): string | null {
  if (!images?.length) return null;
  const sizeOrder = ["extralarge", "large", "medium", "small"];
  for (const size of sizeOrder) {
    const img = images.find((i) => i.size === size);
    if (img?.["#text"]) return img["#text"];
  }
  return images[0]?.["#text"] || null;
}

async function fetchTrackInfo(
  apiKey: string,
  artist: string,
  track: string,
): Promise<{ album: string; artUrl: string | null } | null> {
  const params = new URLSearchParams({
    method: "track.getInfo",
    api_key: apiKey,
    artist: artist,
    track: track,
    format: "json",
  });

  try {
    const response = await fetch(`${LASTFM_API_URL}?${params}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;

    const data: LastFmTrackInfoResponse = await response.json();

    if (data.error || !data.track) return null;

    return {
      album: data.track.album?.title || "",
      artUrl: getLargestImageUrl(data.track.album?.image || []),
    };
  } catch {
    return null;
  }
}

export async function fetchLastFm(
  apiKey: string,
  username: string,
): Promise<NowPlayingData | null> {
  if (cachedData && Date.now() - cacheTime < CACHE_TTL_MS) {
    return cachedData;
  }

  const params = new URLSearchParams({
    method: "user.getrecenttracks",
    user: username,
    api_key: apiKey,
    format: "json",
    limit: "1",
  });

  try {
    const response = await fetch(`${LASTFM_API_URL}?${params}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;

    const data: LastFmRecentTracksResponse = await response.json();

    if (data.error || !data.recenttracks?.track?.length) return null;

    const track = data.recenttracks.track[0];
    const isNowPlaying = track["@attr"]?.nowplaying === "true";

    let album = track.album?.["#text"] || "";
    let artUrl = getLargestImageUrl(track.image);

    if (!album || !artUrl) {
      const trackInfo = await fetchTrackInfo(
        apiKey,
        track.artist["#text"],
        track.name,
      );
      if (trackInfo) {
        if (!album) album = trackInfo.album;
        if (!artUrl) artUrl = trackInfo.artUrl;
      }
    }

    const art = artUrl ? await processArtFromUrl(artUrl) : null;

    const result: NowPlayingData = {
      title: track.name || "Unknown Track",
      artist: track.artist["#text"] || "Unknown Artist",
      album: album || "",
      status: isNowPlaying ? "playing" : "last-played",
      artBase64: art?.base64 || null,
      colors: art?.colors || null,
      updatedAt: Date.now(),
    };

    cachedData = result;
    cacheTime = Date.now();

    return result;
  } catch {
    return null;
  }
}
