import { ColorPalette } from "../types.ts";
import { encodeBase64 } from "@std/encoding";
import { Image } from "imagescript";

const ART_TARGET_SIZE = 300;
const ART_MAX_DIMENSION = 400;
const JPEG_QUALITY = 75;
const MAX_BASE64_SIZE = 50000;

export interface ArtResult {
  base64: string;
  colors: ColorPalette;
}

function colorToHex(color: number): string {
  const [r, g, b] = Image.colorToRGBA(color);
  const toHex = (v: number): string => v.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function calculateAccentColor(hexColor: string): string {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  const accentR = Math.min(255, Math.round(r * 1.2));
  const accentG = Math.min(255, Math.round(g * 1.2));
  const accentB = Math.min(255, Math.round(b * 1.2));

  return `#${accentR.toString(16).padStart(2, "0")}${
    accentG.toString(16).padStart(2, "0")
  }${accentB.toString(16).padStart(2, "0")}`;
}

function extractHighlightFromImage(
  image: Image,
  dominantHex: string,
): string | null {
  const dominantR = parseInt(dominantHex.slice(1, 3), 16);
  const dominantG = parseInt(dominantHex.slice(3, 5), 16);
  const dominantB = parseInt(dominantHex.slice(5, 7), 16);
  let bestScore = 0;
  let best: { r: number; g: number; b: number } | null = null;

  for (const [, , color] of image.iterateWithColors()) {
    const [r, g, b, a] = Image.colorToRGBA(color);
    if (a < 128) continue;
    if (r > 235 && g > 235 && b > 235) continue;
    if (r < 20 && g < 20 && b < 20) continue;

    const [, s, l] = Image.rgbaToHSLA(r, g, b, a);
    if (s < 0.35 || l < 0.18 || l > 0.85) continue;

    const dist = Math.sqrt(
      (r - dominantR) ** 2 +
        (g - dominantG) ** 2 +
        (b - dominantB) ** 2,
    ) / (Math.sqrt(3) * 255);
    const score = s * 0.7 + dist * 0.2 +
      (1 - Math.abs(l - 0.55)) * 0.1;
    if (score > bestScore) {
      bestScore = score;
      best = { r, g, b };
    }
  }

  if (!best) return null;
  const toHex = (v: number): string => v.toString(16).padStart(2, "0");
  return `#${toHex(best.r)}${toHex(best.g)}${toHex(best.b)}`;
}

function extractFallbackHighlight(image: Image): string {
  let maxR = 0;
  let maxG = 0;
  let maxB = 0;

  for (const [, , color] of image.iterateWithColors()) {
    const [r, g, b, a] = Image.colorToRGBA(color);
    if (a < 128) continue;
    if (r > maxR) maxR = r;
    if (g > maxG) maxG = g;
    if (b > maxB) maxB = b;
  }

  const toHex = (v: number): string => v.toString(16).padStart(2, "0");
  return `#${toHex(maxR)}${toHex(maxG)}${toHex(maxB)}`;
}

function blendWithWhite(hexColor: string, ratio: number): string {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const blend = (value: number): number =>
    Math.min(255, Math.round(value + (255 - value) * ratio));
  return `#${blend(r).toString(16).padStart(2, "0")}${
    blend(g).toString(16).padStart(2, "0")
  }${blend(b).toString(16).padStart(2, "0")}`;
}

/**
 * Fetch, resize, and extract a color palette for album art.
 *
 * @param tauonUrl Base URL for the Tauon API.
 * @param trackId Track id used for art lookup.
 * @returns Encoded art and palette, or null if unavailable.
 */
export async function fetchAndResizeArt(
  tauonUrl: string,
  trackId: number,
): Promise<ArtResult | null> {
  try {
    const response = await fetch(
      `${tauonUrl}/api1/pic/medium/${trackId}`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!response.ok) {
      console.warn(`Album art fetch failed: ${response.status}`);
      return null;
    }

    const imageBuffer = new Uint8Array(await response.arrayBuffer());
    const image = await Image.decode(imageBuffer);

    const maxDim = Math.max(image.width, image.height);

    let resized: Image;
    if (maxDim > ART_MAX_DIMENSION) {
      resized = image.clone().contain(
        ART_TARGET_SIZE,
        ART_TARGET_SIZE,
      );
    } else {
      resized = image.clone();
    }

    const resizedBuffer = await resized.encodeJPEG(JPEG_QUALITY);

    // Extract dominant color using imagescript
    const dominantColor = image.dominantColor();
    const dominant = colorToHex(dominantColor);
    const accent = calculateAccentColor(dominant);

    // Create tiny thumbnail for highlight color extraction
    const tiny = image.clone().cover(24, 24);
    const highlightCandidate = extractHighlightFromImage(
      tiny,
      dominant,
    );
    const fallbackHighlight = extractFallbackHighlight(tiny);
    const highlight = blendWithWhite(
      highlightCandidate || fallbackHighlight,
      0.10,
    );

    let base64 = encodeBase64(resizedBuffer);

    if (base64.length > MAX_BASE64_SIZE) {
      const finalImage = image.clone().contain(
        ART_TARGET_SIZE,
        ART_TARGET_SIZE,
      );
      const finalBuffer = await finalImage.encodeJPEG(JPEG_QUALITY);
      base64 = encodeBase64(finalBuffer);
    }

    return {
      base64,
      colors: { dominant, accent, highlight },
    };
  } catch (error) {
    console.warn("Failed to fetch/resize album art:", error);
    return null;
  }
}
