import { ColorPalette, NowPlayingData } from "../types.ts";
import { fetch_and_resize_art } from "./album_art.ts";
import { send_to_deploy } from "./api_client.ts";
import { should_update } from "./state.ts";
import { fetch_tauon_status } from "./tauon_api.ts";

// Configuration from environment
const TAUON_URL = Deno.env.get("TAUON_URL") || "http://localhost:7814";
const DEPLOY_URL = Deno.env.get("DEPLOY_URL");
const API_KEY = Deno.env.get("API_KEY");
const POLL_INTERVAL_MS = parseInt(Deno.env.get("POLL_INTERVAL_MS") || "10000");

// State to track last sent/seen data to avoid unnecessary updates
let last_sent_track_id: number | null = null;
let last_sent_status: string | null = null;
let last_seen_status: string | null = null;
let last_album_name: string | null = null;
let last_art_base64: string | null = null;
let last_colors: ColorPalette | null = null;

if (!DEPLOY_URL) {
  console.error("DEPLOY_URL environment variable is required");
  Deno.exit(1);
}

if (!API_KEY) {
  console.error("API_KEY environment variable is required");
  Deno.exit(1);
}

const deploy_url = DEPLOY_URL!;
const api_key = API_KEY!;

async function poll(): Promise<void> {
  const status = await fetch_tauon_status(TAUON_URL);

  if (!status) {
    console.log("Tauon unreachable, skipping update");
    return;
  }

  if (status.status !== "playing" && status.status !== "paused") {
    last_seen_status = status.status;
    return;
  }

  if (
    !should_update(
      status,
      last_sent_track_id,
      last_sent_status,
      last_seen_status,
    )
  ) {
    last_seen_status = status.status;
    return;
  }

  let art_base64: string | null = null;
  let colors: ColorPalette | null = null;
  const album_name = (status.track?.album || status.album || "").trim();
  const is_playable_status = status.status === "playing" ||
    status.status === "paused";
  const has_cached_art = album_name.length > 0 &&
    album_name === last_album_name &&
    last_art_base64 && last_colors;

  if (is_playable_status && status.id > 0) {
    if (has_cached_art) {
      art_base64 = last_art_base64;
      colors = last_colors;
    } else {
      const art_result = await fetch_and_resize_art(TAUON_URL, status.id);
      if (art_result) {
        art_base64 = art_result.base64;
        colors = art_result.colors;
        if (album_name.length > 0) {
          last_album_name = album_name;
          last_art_base64 = art_base64;
          last_colors = colors;
        }
      }
    }
  }

  const now_playing_data: NowPlayingData = {
    title: status.title || status.track?.title || "Unknown Title",
    artist: status.artist || status.track?.artist || "Unknown Artist",
    album: status.album || status.track?.album || "Unknown Album",
    status: status.status === "playing" ? "playing" : "last-played",
    art_base64,
    colors,
    updated_at: Date.now(),
  };

  const success = await send_to_deploy(deploy_url, api_key, now_playing_data);

  if (success) {
    last_sent_track_id = status.id;
    last_sent_status = status.status;
    last_seen_status = status.status;
    console.log(
      `Updated: ${now_playing_data.title} by ${now_playing_data.artist}`,
    );
  }
}

export async function main(): Promise<void> {
  console.log("Tauon Now Playing Poller");
  console.log(`  Tauon URL: ${TAUON_URL}`);
  console.log(`  Deploy URL: ${DEPLOY_URL}`);
  console.log(`  Poll interval: ${POLL_INTERVAL_MS}ms`);

  await poll();

  setInterval(poll, POLL_INTERVAL_MS);

  console.log("Poller running. Press Ctrl+C to stop.");
}

if (import.meta.main) {
  await main();
}
