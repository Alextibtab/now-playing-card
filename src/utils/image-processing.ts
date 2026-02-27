import { ColorPalette } from "../types.ts";
import { encodeBase64 } from "@std/encoding";
import { Image } from "imagescript";

const ART_TARGET_SIZE = 300;
const ART_MAX_DIMENSION = 400;
const JPEG_QUALITY = 75;
const MAX_BASE64_SIZE = 50000;

export interface ProcessedArt {
  base64: string;
  colors: ColorPalette;
}

function colorToHex(color: number): string {
  const [r, g, b] = Image.colorToRGBA(color);
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function calculateAccent(hex: string): string {
  const r = Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) * 1.2));
  const g = Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) * 1.2));
  const b = Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) * 1.2));
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function extractHighlight(image: Image, dominantHex: string): string {
  const dr = parseInt(dominantHex.slice(1, 3), 16);
  const dg = parseInt(dominantHex.slice(3, 5), 16);
  const db = parseInt(dominantHex.slice(5, 7), 16);

  let best = { r: 0, g: 0, b: 0, score: 0 };

  const tiny = image.clone().cover(24, 24);
  for (const [, , color] of tiny.iterateWithColors()) {
    const [r, g, b, a] = Image.colorToRGBA(color);
    if (a < 128) continue;
    if (r > 235 && g > 235 && b > 235) continue;
    if (r < 20 && g < 20 && b < 20) continue;

    const [, s, l] = Image.rgbaToHSLA(r, g, b, a);
    if (s < 0.35 || l < 0.18 || l > 0.85) continue;

    const dist = Math.sqrt(
      (r - dr) ** 2 + (g - dg) ** 2 + (b - db) ** 2,
    ) / (Math.sqrt(3) * 255);
    const score = s * 0.7 + dist * 0.2 + (1 - Math.abs(l - 0.55)) * 0.1;

    if (score > best.score) best = { r, g, b, score };
  }

  const toHex = (v: number) =>
    Math.min(255, Math.round(v + (255 - v) * 0.1)).toString(16).padStart(
      2,
      "0",
    );
  return `#${toHex(best.r)}${toHex(best.g)}${toHex(best.b)}`;
}

function extractFallbackHighlight(image: Image): string {
  let maxR = 0, maxG = 0, maxB = 0;

  for (const [, , color] of image.iterateWithColors()) {
    const [r, g, b, a] = Image.colorToRGBA(color);
    if (a < 128) continue;
    if (r > maxR) maxR = r;
    if (g > maxG) maxG = g;
    if (b > maxB) maxB = b;
  }

  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(maxR)}${toHex(maxG)}${toHex(maxB)}`;
}

export function extractColors(image: Image): ColorPalette {
  const dominant = colorToHex(image.dominantColor());
  const accent = calculateAccent(dominant);

  const tiny = image.clone().cover(24, 24);
  const highlightCandidate = extractHighlight(tiny, dominant);
  const fallback = extractFallbackHighlight(tiny);

  if (highlightCandidate) {
    return { dominant, accent, highlight: highlightCandidate };
  }

  const toHex = (v: number) =>
    Math.min(255, Math.round(v + (255 - v) * 0.1)).toString(16).padStart(
      2,
      "0",
    );
  const blended = `#${toHex(parseInt(fallback.slice(1, 3), 16))}${
    toHex(parseInt(fallback.slice(3, 5), 16))
  }${toHex(parseInt(fallback.slice(5, 7), 16))}`;

  return { dominant, accent, highlight: blended };
}

export async function processArtFromBuffer(
  imageBuffer: Uint8Array,
): Promise<ProcessedArt | null> {
  try {
    const image = await Image.decode(imageBuffer);

    const maxDim = Math.max(image.width, image.height);
    const targetSize = maxDim > ART_MAX_DIMENSION ? ART_TARGET_SIZE : maxDim;

    const resized = maxDim > ART_MAX_DIMENSION
      ? image.clone().contain(targetSize, targetSize)
      : image.clone();

    let jpegBuffer = await resized.encodeJPEG(JPEG_QUALITY);
    let base64 = encodeBase64(jpegBuffer);

    if (base64.length > MAX_BASE64_SIZE) {
      const smaller = image.clone().contain(ART_TARGET_SIZE, ART_TARGET_SIZE);
      jpegBuffer = await smaller.encodeJPEG(JPEG_QUALITY);
      base64 = encodeBase64(jpegBuffer);
    }

    const colors = extractColors(image);

    return { base64, colors };
  } catch {
    return null;
  }
}

export async function processArtFromUrl(
  url: string,
): Promise<ProcessedArt | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return null;

    const buffer = new Uint8Array(await response.arrayBuffer());
    return processArtFromBuffer(buffer);
  } catch {
    return null;
  }
}
