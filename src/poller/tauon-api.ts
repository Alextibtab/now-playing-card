import { TauonStatus } from "../types.ts";

/**
 * Fetch the current playback status from Tauon.
 *
 * @param tauonUrl Base URL for the Tauon API.
 * @returns Parsed status or null when unavailable.
 */
export async function fetchTauonStatus(
  tauonUrl: string,
): Promise<TauonStatus | null> {
  try {
    const response = await fetch(`${tauonUrl}/api1/status`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.warn(`Tauon status fetch failed: ${response.status}`);
      return null;
    }
    return await response.json() as TauonStatus;
  } catch (error) {
    console.warn("Failed to fetch Tauon status:", error);
    return null;
  }
}
