import { TauonStatus } from "../../types.ts";
import { create_logger } from "../../utils/logger.ts";

const log = create_logger("Tauon");

/**
 * Fetch the current playback status from Tauon.
 *
 * @param tauon_url Base URL for the Tauon API.
 * @returns Parsed status or null when unavailable.
 */
export async function fetch_tauon_status(
  tauon_url: string,
): Promise<TauonStatus | null> {
  try {
    const response = await fetch(`${tauon_url}/api1/status`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      log.warn(`Tauon status fetch failed: ${response.status}`);
      return null;
    }
    return await response.json() as TauonStatus;
  } catch (error) {
    log.warn("Failed to fetch Tauon status", error);
    return null;
  }
}
