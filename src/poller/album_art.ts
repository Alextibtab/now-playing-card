import { ColorPalette } from "../types.ts";
import { process_art_from_url as util_process_art_from_url } from "../utils/image_processing.ts";

export interface ArtResult {
  base64: string;
  colors: ColorPalette;
}

export async function fetch_and_resize_art(
  tauon_url: string,
  track_id: number,
): Promise<ArtResult | null> {
  try {
    const result = await util_process_art_from_url(
      `${tauon_url}/api1/pic/medium/${track_id}`,
    );
    if (!result) return null;
    return { base64: result.base64, colors: result.colors };
  } catch (error) {
    console.warn("Failed to fetch album art:", error);
    return null;
  }
}
