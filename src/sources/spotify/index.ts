import { NowPlayingData } from "../../types.ts";
import { process_art_from_url } from "../../utils/image_processing.ts";
import { get_valid_access_token } from "./auth.ts";
import { create_logger } from "../../utils/logger.ts";

const log = create_logger("Spotify");

const SPOTIFY_API_URL = "https://api.spotify.com/v1";
const DEFAULT_CACHE_TTL_MS = 30_000;
const MIN_CACHE_TTL_MS = 5_000;

function get_cache_ttl(): number {
  const env = Deno.env.get("SOURCE_CACHE_TTL_MS");
  if (!env) return DEFAULT_CACHE_TTL_MS;
  const val = parseInt(env);
  if (isNaN(val) || val < MIN_CACHE_TTL_MS) return MIN_CACHE_TTL_MS;
  return val;
}

let cached_data: NowPlayingData | null = null;
let cache_time = 0;
let pending_request: Promise<NowPlayingData | null> | null = null;

interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

interface SpotifyArtist {
  name: string;
}

interface SpotifyAlbum {
  name: string;
  images: SpotifyImage[];
}

interface SpotifyTrack {
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  type: "track";
}

interface SpotifyEpisode {
  name: string;
  show: { name: string };
  images: SpotifyImage[];
  type: "episode";
}

interface SpotifyCurrentlyPlaying {
  is_playing: boolean;
  item: SpotifyTrack | SpotifyEpisode | null;
}

interface SpotifyRecentlyPlayed {
  items: {
    track: SpotifyTrack;
    played_at: string;
  }[];
}

function get_largest_image_url(
  images: SpotifyImage[],
): string | null {
  if (!images?.length) return null;
  const sorted = [...images].sort(
    (a, b) => (b.width ?? 0) - (a.width ?? 0),
  );
  return sorted[0]?.url || null;
}

function extract_track_info(item: SpotifyTrack | SpotifyEpisode): {
  title: string;
  artist: string;
  album: string;
  art_url: string | null;
} {
  if (item.type === "episode") {
    return {
      title: item.name || "Unknown Episode",
      artist: (item as SpotifyEpisode).show?.name || "Unknown Show",
      album: "",
      art_url: get_largest_image_url(
        (item as SpotifyEpisode).images,
      ),
    };
  }

  const track = item as SpotifyTrack;
  return {
    title: track.name || "Unknown Track",
    artist: track.artists?.map((a) => a.name).join(", ") ||
      "Unknown Artist",
    album: track.album?.name || "",
    art_url: get_largest_image_url(track.album?.images || []),
  };
}

async function fetch_currently_playing(
  access_token: string,
): Promise<SpotifyCurrentlyPlaying | null> {
  try {
    const response = await fetch(
      `${SPOTIFY_API_URL}/me/player/currently-playing` +
        "?additional_types=track,episode",
      {
        headers: { "Authorization": `Bearer ${access_token}` },
        signal: AbortSignal.timeout(5_000),
      },
    );

    if (response.status === 204) {
      log.debug("Currently playing: 204 (nothing playing)");
      return null;
    }

    if (!response.ok) {
      const text = await response.text();
      log.warn(`Currently playing API error: ${response.status}`, {
        body: text,
      });
      return null;
    }

    const data = await response.json() as SpotifyCurrentlyPlaying;
    log.debug("Currently playing response", {
      is_playing: data?.is_playing,
      has_item: !!data?.item,
      type: data?.item?.type,
    });
    return data;
  } catch (err) {
    log.error("Failed to fetch currently playing", err);
    return null;
  }
}

async function fetch_recently_played(
  access_token: string,
): Promise<SpotifyRecentlyPlayed | null> {
  try {
    const response = await fetch(
      `${SPOTIFY_API_URL}/me/player/recently-played?limit=1`,
      {
        headers: { "Authorization": `Bearer ${access_token}` },
        signal: AbortSignal.timeout(5_000),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      log.warn(`Recently played API error: ${response.status}`, {
        body: text,
      });
      return null;
    }

    const data = await response.json() as SpotifyRecentlyPlayed;
    log.debug("Recently played response", {
      item_count: data?.items?.length ?? 0,
    });
    return data;
  } catch (err) {
    log.error("Failed to fetch recently played", err);
    return null;
  }
}

async function fetch_spotify_inner(
  kv: Deno.Kv,
): Promise<NowPlayingData | null> {
  const access_token = await get_valid_access_token(kv);
  if (!access_token) return null;

  const current = await fetch_currently_playing(access_token);

  if (current?.item) {
    const info = extract_track_info(current.item);
    const art = info.art_url ? await process_art_from_url(info.art_url) : null;

    const result: NowPlayingData = {
      title: info.title,
      artist: info.artist,
      album: info.album,
      status: current.is_playing ? "playing" : "last-played",
      art_base64: art?.base64 || null,
      colors: art?.colors || null,
      updated_at: Date.now(),
    };

    cached_data = result;
    cache_time = Date.now();
    return result;
  }

  log.info("Nothing currently playing, checking recent tracks");
  const recent = await fetch_recently_played(access_token);

  if (!recent?.items?.length) {
    log.info("No recently played tracks found");
    return null;
  }

  const track = recent.items[0].track;
  const info = extract_track_info(track);
  const art = info.art_url ? await process_art_from_url(info.art_url) : null;

  const result: NowPlayingData = {
    title: info.title,
    artist: info.artist,
    album: info.album,
    status: "last-played",
    art_base64: art?.base64 || null,
    colors: art?.colors || null,
    updated_at: Date.now(),
  };

  cached_data = result;
  cache_time = Date.now();
  return result;
}

export function fetch_spotify(
  kv: Deno.Kv,
): Promise<NowPlayingData | null> {
  if (cached_data && Date.now() - cache_time < get_cache_ttl()) {
    log.debug("Returning cached data");
    return Promise.resolve(cached_data);
  }

  if (pending_request) {
    log.debug("Dedup: reusing in-flight request");
    return pending_request;
  }

  log.debug("Starting new Spotify API request");
  pending_request = fetch_spotify_inner(kv).finally(() => {
    pending_request = null;
  });

  return pending_request;
}
