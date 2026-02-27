import { ColorPalette } from "../types.ts";
import { processArtFromUrl as utilProcessArtFromUrl } from "../utils/image-processing.ts";

export interface ArtResult {
  base64: string;
  colors: ColorPalette;
}

export async function fetchAndResizeArt(
  tauonUrl: string,
  trackId: number,
): Promise<ArtResult | null> {
  try {
    const result = await utilProcessArtFromUrl(
      `${tauonUrl}/api1/pic/medium/${trackId}`,
    );
    if (!result) return null;
    return { base64: result.base64, colors: result.colors };
  } catch (error) {
    console.warn("Failed to fetch album art:", error);
    return null;
  }
}
