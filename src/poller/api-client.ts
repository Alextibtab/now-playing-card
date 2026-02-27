import { NowPlayingData } from "../types.ts";

/**
 * Send the latest now playing data to the Deploy API.
 *
 * @param deployUrl Deploy endpoint base URL.
 * @param apiKey Shared API key for authorization.
 * @param data Payload to store.
 * @returns True when the request succeeds.
 */
export async function sendToDeploy(
  deployUrl: string,
  apiKey: string,
  data: NowPlayingData,
): Promise<boolean> {
  try {
    const body = JSON.stringify(data);
    console.log(
      `JSON payload size: ${body.length} chars (${
        (body.length / 1024).toFixed(1)
      }KB)`,
    );

    const response = await fetch(`${deployUrl}/tauon/api/now-playing`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.warn(`Deploy API error: ${response.status} - ${errorBody}`);
      return false;
    }

    return true;
  } catch (error) {
    console.warn("Failed to send to Deploy API:", error);
    return false;
  }
}
