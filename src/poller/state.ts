import { TauonStatus } from "../types.ts";

/**
 * Decide whether the poller should send an update.
 *
 * @param status Current Tauon status snapshot.
 * @param last_sent_track_id Last track id successfully sent.
 * @param last_sent_status Last playback status successfully sent.
 * @param last_seen_status Last playback status observed locally.
 * @returns True when an update should be sent.
 */
export function should_update(
  status: TauonStatus,
  last_sent_track_id: number | null,
  last_sent_status: string | null,
  last_seen_status: string | null,
): boolean {
  const track_id = status.id;
  const status_str = status.status;
  const is_playable_status = status_str === "playing" ||
    status_str === "paused";

  if (!is_playable_status) {
    return false;
  }

  if (track_id !== last_sent_track_id) {
    return true;
  }

  if (status_str !== last_sent_status) {
    return true;
  }

  if (last_seen_status === "stopped") {
    return true;
  }

  return false;
}
