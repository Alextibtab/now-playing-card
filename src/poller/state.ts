import { TauonStatus } from "../types.ts";

/**
 * Decide whether the poller should send an update.
 *
 * @param status Current Tauon status snapshot.
 * @param lastSentTrackId Last track id successfully sent.
 * @param lastSentStatus Last playback status successfully sent.
 * @param lastSeenStatus Last playback status observed locally.
 * @returns True when an update should be sent.
 */
export function shouldUpdate(
  status: TauonStatus,
  lastSentTrackId: number | null,
  lastSentStatus: string | null,
  lastSeenStatus: string | null,
): boolean {
  const trackId = status.id;
  const statusStr = status.status;
  const isPlayableStatus = statusStr === "playing" || statusStr === "paused";

  if (!isPlayableStatus) {
    return false;
  }

  if (trackId !== lastSentTrackId) {
    return true;
  }

  if (statusStr !== lastSentStatus) {
    return true;
  }

  if (lastSeenStatus === "stopped") {
    return true;
  }

  return false;
}
