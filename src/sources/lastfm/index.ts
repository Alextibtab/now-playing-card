import { NowPlayingData } from "../../types.ts";
import { process_art_from_url } from "../../utils/image_processing.ts";

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

let cached_data: NowPlayingData | null = null;
let cache_time = 0;
const CACHE_TTL_MS = 30000;

function get_largest_image_url(images: LastFmImage[]): string | null {
  if (!images?.length) return null;
  const size_order = ["extralarge", "large", "medium", "small"];
  for (const size of size_order) {
    const img = images.find((i) => i.size === size);
    if (img?.["#text"]) return img["#text"];
  }
  return images[0]?.["#text"] || null;
}

async function fetch_track_info(
  api_key: string,
  artist: string,
  track: string,
): Promise<{ album: string; art_url: string | null } | null> {
  const params = new URLSearchParams({
    method: "track.getInfo",
    api_key: api_key,
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
      art_url: get_largest_image_url(data.track.album?.image || []),
    };
  } catch {
    return null;
  }
}

export async function fetch_lastfm(
  api_key: string,
  username: string,
): Promise<NowPlayingData | null> {
  if (cached_data && Date.now() - cache_time < CACHE_TTL_MS) {
    return cached_data;
  }

  const params = new URLSearchParams({
    method: "user.getrecenttracks",
    user: username,
    api_key: api_key,
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
    const is_now_playing = track["@attr"]?.nowplaying === "true";

    let album = track.album?.["#text"] || "";
    let art_url = get_largest_image_url(track.image);

    if (!album || !art_url) {
      const track_info = await fetch_track_info(
        api_key,
        track.artist["#text"],
        track.name,
      );
      if (track_info) {
        if (!album) album = track_info.album;
        if (!art_url) art_url = track_info.art_url;
      }
    }

    const art = art_url ? await process_art_from_url(art_url) : null;

    const result: NowPlayingData = {
      title: track.name || "Unknown Track",
      artist: track.artist["#text"] || "Unknown Artist",
      album: album || "",
      status: is_now_playing ? "playing" : "last-played",
      art_base64: art?.base64 || null,
      colors: art?.colors || null,
      updated_at: Date.now(),
    };

    cached_data = result;
    cache_time = Date.now();

    return result;
  } catch {
    return null;
  }
}
