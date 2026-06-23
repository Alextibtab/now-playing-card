import { NowPlayingData } from "../types.ts";
import { create_logger } from "../utils/logger.ts";

const log = create_logger("API");

/**
 * Send the latest now playing data to the Deploy API.
 *
 * @param deploy_url Deploy endpoint base URL.
 * @param api_key Shared API key for authorization.
 * @param data Payload to store.
 * @returns True when the request succeeds.
 */
export async function send_to_deploy(
  deploy_url: string,
  api_key: string,
  data: NowPlayingData,
): Promise<boolean> {
  try {
    const body = JSON.stringify(data);
    log.debug(
      `JSON payload size: ${body.length} chars`,
      { kb: (body.length / 1024).toFixed(1) },
    );

    const response = await fetch(`${deploy_url}/tauon/api/now-playing`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${api_key}`,
        "Content-Type": "application/json",
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const error_body = await response.text();
      log.warn(
        `Deploy API error: ${response.status}`,
        { body: error_body },
      );
      return false;
    }

    return true;
  } catch (error) {
    log.warn("Failed to send to Deploy API", error);
    return false;
  }
}
