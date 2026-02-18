import { ColorPalette, NowPlayingData } from "../types.ts";
import { fetchAndResizeArt } from "./art.ts";
import { sendToDeploy } from "./deploy.ts";
import { shouldUpdate } from "./state.ts";
import { fetchTauonStatus } from "./tauon.ts";

// Configuration from environment
const TAUON_URL = Deno.env.get("TAUON_URL") || "http://localhost:7814";
const DEPLOY_URL = Deno.env.get("DEPLOY_URL");
const API_KEY = Deno.env.get("API_KEY");
const POLL_INTERVAL_MS = parseInt(Deno.env.get("POLL_INTERVAL_MS") || "10000");

// State to track last sent/seen data to avoid unnecessary updates
let lastSentTrackId: number | null = null;
let lastSentStatus: string | null = null;
let lastSeenStatus: string | null = null;
let lastAlbumName: string | null = null;
let lastArtBase64: string | null = null;
let lastColors: ColorPalette | null = null;

if (!DEPLOY_URL) {
  console.error("DEPLOY_URL environment variable is required");
  Deno.exit(1);
}

if (!API_KEY) {
  console.error("API_KEY environment variable is required");
  Deno.exit(1);
}

const deployUrl = DEPLOY_URL!;
const apiKey = API_KEY!;

async function poll(): Promise<void> {
  const status = await fetchTauonStatus(TAUON_URL);

  if (!status) {
    console.log("Tauon unreachable, skipping update");
    return;
  }

  if (status.status !== "playing" && status.status !== "paused") {
    lastSeenStatus = status.status;
    return;
  }

  if (!shouldUpdate(status, lastSentTrackId, lastSentStatus, lastSeenStatus)) {
    lastSeenStatus = status.status;
    return;
  }

  let artBase64: string | null = null;
  let colors: ColorPalette | null = null;
  const albumName = (status.track?.album || status.album || "").trim();
  const isPlayableStatus = status.status === "playing" ||
    status.status === "paused";
  const hasCachedArt = albumName.length > 0 && albumName === lastAlbumName &&
    lastArtBase64 && lastColors;

  if (isPlayableStatus && status.id > 0) {
    if (hasCachedArt) {
      artBase64 = lastArtBase64;
      colors = lastColors;
    } else {
      const artResult = await fetchAndResizeArt(TAUON_URL, status.id);
      if (artResult) {
        artBase64 = artResult.base64;
        colors = artResult.colors;
        if (albumName.length > 0) {
          lastAlbumName = albumName;
          lastArtBase64 = artBase64;
          lastColors = colors;
        }
      }
    }
  }

  const nowPlayingData: NowPlayingData = {
    title: status.title || status.track?.title || "Unknown Title",
    artist: status.artist || status.track?.artist || "Unknown Artist",
    album: status.album || status.track?.album || "Unknown Album",
    albumArtist: status.track?.album_artist || status.artist ||
      "Unknown Artist",
    trackNumber: status.track?.track_number || "",
    duration: status.track?.duration || 0,
    progress: status.progress,
    status: status.status,
    artBase64,
    colors,
    updatedAt: Date.now(),
  };

  const success = await sendToDeploy(deployUrl, apiKey, nowPlayingData);

  if (success) {
    lastSentTrackId = status.id;
    lastSentStatus = status.status;
    lastSeenStatus = status.status;
    console.log(`Updated: ${nowPlayingData.title} by ${nowPlayingData.artist}`);
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
