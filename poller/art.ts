import { ColorPalette } from "../types.ts";
import { encodeBase64 } from "@std/encoding";
import sharp from "sharp";

const ART_TARGET_SIZE = 300;
const ART_MAX_DIMENSION = 400;
const JPEG_QUALITY = 75;
const MAX_BASE64_SIZE = 50000;

export interface ArtResult {
  base64: string;
  colors: ColorPalette;
}

function extractDominantColor(stats: sharp.Stats): string {
  const r = Math.round(stats.channels[0].mean);
  const g = Math.round(stats.channels[1].mean);
  const b = Math.round(stats.channels[2].mean);
  return `#${r.toString(16).padStart(2, "0")}${
    g.toString(16).padStart(2, "0")
  }${b.toString(16).padStart(2, "0")}`;
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

function rgbToHsl(r: number, g: number, b: number): {
  h: number;
  s: number;
  l: number;
} {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rNorm:
        h = ((gNorm - bNorm) / delta) % 6;
        break;
      case gNorm:
        h = (bNorm - rNorm) / delta + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / delta + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s, l };
}

function extractHighlightFromRaw(
  raw: Uint8Array,
  width: number,
  height: number,
  dominantHex: string,
): string | null {
  const dominantR = parseInt(dominantHex.slice(1, 3), 16);
  const dominantG = parseInt(dominantHex.slice(3, 5), 16);
  const dominantB = parseInt(dominantHex.slice(5, 7), 16);
  let bestScore = 0;
  let best: { r: number; g: number; b: number } | null = null;

  for (let i = 0; i < width * height; i++) {
    const idx = i * 3;
    const r = raw[idx];
    const g = raw[idx + 1];
    const b = raw[idx + 2];
    if (r > 235 && g > 235 && b > 235) continue;
    if (r < 20 && g < 20 && b < 20) continue;
    const { s, l } = rgbToHsl(r, g, b);
    if (s < 0.35 || l < 0.18 || l > 0.85) continue;
    const dist = Math.sqrt(
      (r - dominantR) ** 2 +
        (g - dominantG) ** 2 +
        (b - dominantB) ** 2,
    ) / (Math.sqrt(3) * 255);
    const score = s * 0.7 + dist * 0.2 + (1 - Math.abs(l - 0.55)) * 0.1;
    if (score > bestScore) {
      bestScore = score;
      best = { r, g, b };
    }
  }

  if (!best) return null;
  const toHex = (value: number): string => value.toString(16).padStart(2, "0");
  return `#${toHex(best.r)}${toHex(best.g)}${toHex(best.b)}`;
}

function extractHighlightColor(stats: sharp.Stats): string {
  const r = Math.round(stats.channels[0].max);
  const g = Math.round(stats.channels[1].max);
  const b = Math.round(stats.channels[2].max);
  const toHex = (value: number): string => value.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
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

    const metadata = await sharp(imageBuffer).metadata();

    if (!metadata.width || !metadata.height) {
      console.warn("Album art: could not read dimensions");
      return null;
    }

    const maxDim = Math.max(metadata.width, metadata.height);

    let resizedBuffer: Uint8Array;
    let statsBuffer: Uint8Array;

    if (maxDim > ART_MAX_DIMENSION) {
      const pipeline = sharp(imageBuffer)
        .resize(ART_TARGET_SIZE, ART_TARGET_SIZE, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: JPEG_QUALITY, progressive: true });

      resizedBuffer = await pipeline.toBuffer();
      statsBuffer = resizedBuffer;
    } else {
      const pipeline = sharp(imageBuffer)
        .jpeg({ quality: JPEG_QUALITY, progressive: true });

      resizedBuffer = await pipeline.toBuffer();
      statsBuffer = imageBuffer;
    }

    const [stats, tinyRaw] = await Promise.all([
      sharp(statsBuffer).stats(),
      sharp(imageBuffer)
        .resize(24, 24, { fit: "cover" })
        .flatten({ background: { r: 0, g: 0, b: 0 } })
        .raw()
        .toBuffer({ resolveWithObject: true }),
    ]);

    if (!stats.channels || stats.channels.length < 3) {
      console.warn("Album art: insufficient color channels");
      return null;
    }

    const dominant = extractDominantColor(stats);
    const accent = calculateAccentColor(dominant);
    const highlightCandidate = extractHighlightFromRaw(
      tinyRaw.data,
      tinyRaw.info.width,
      tinyRaw.info.height,
      dominant,
    );
    const fallbackHighlight = extractHighlightColor(stats);
    const highlight = blendWithWhite(
      highlightCandidate || fallbackHighlight,
      0.10,
    );

    let base64 = encodeBase64(resizedBuffer);

    if (base64.length > MAX_BASE64_SIZE) {
      const finalPipeline = sharp(imageBuffer)
        .resize(ART_TARGET_SIZE, ART_TARGET_SIZE, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: JPEG_QUALITY, progressive: true });

      const finalBuffer = await finalPipeline.toBuffer();
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
