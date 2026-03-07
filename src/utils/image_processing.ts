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

function to_hex(v: number, brighten = false): string {
  const val = brighten ? Math.min(255, Math.round(v + (255 - v) * 0.1)) : v;
  return val.toString(16).padStart(2, "0");
}

function color_to_hex(color: number): string {
  const [r, g, b] = Image.colorToRGBA(color);
  return `#${to_hex(r)}${to_hex(g)}${to_hex(b)}`;
}

function calculate_accent(hex: string): string {
  const r = Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) * 1.2));
  const g = Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) * 1.2));
  const b = Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) * 1.2));
  return `#${to_hex(r)}${to_hex(g)}${to_hex(b)}`;
}

function extract_highlight(image: Image, dominant_hex: string): string {
  const dr = parseInt(dominant_hex.slice(1, 3), 16);
  const dg = parseInt(dominant_hex.slice(3, 5), 16);
  const db = parseInt(dominant_hex.slice(5, 7), 16);

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

  return `#${to_hex(best.r, true)}${to_hex(best.g, true)}${
    to_hex(best.b, true)
  }`;
}

function extract_fallback_highlight(image: Image): string {
  let max_r = 0, max_g = 0, max_b = 0;

  for (const [, , color] of image.iterateWithColors()) {
    const [r, g, b, a] = Image.colorToRGBA(color);
    if (a < 128) continue;
    if (r > max_r) max_r = r;
    if (g > max_g) max_g = g;
    if (b > max_b) max_b = b;
  }

  return `#${to_hex(max_r)}${to_hex(max_g)}${to_hex(max_b)}`;
}

export function extract_colors(image: Image): ColorPalette {
  const dominant = color_to_hex(image.dominantColor());
  const accent = calculate_accent(dominant);

  const tiny = image.clone().cover(24, 24);
  const highlight_candidate = extract_highlight(tiny, dominant);
  const fallback = extract_fallback_highlight(tiny);

  if (highlight_candidate) {
    return { dominant, accent, highlight: highlight_candidate };
  }

  const blended = `#${to_hex(parseInt(fallback.slice(1, 3), 16), true)}${
    to_hex(parseInt(fallback.slice(3, 5), 16), true)
  }${to_hex(parseInt(fallback.slice(5, 7), 16), true)}`;

  return { dominant, accent, highlight: blended };
}

export async function process_art_from_buffer(
  image_buffer: Uint8Array,
): Promise<ProcessedArt | null> {
  try {
    const image = await Image.decode(image_buffer);

    const max_dim = Math.max(image.width, image.height);
    const target_size = max_dim > ART_MAX_DIMENSION ? ART_TARGET_SIZE : max_dim;

    const resized = max_dim > ART_MAX_DIMENSION
      ? image.clone().contain(target_size, target_size)
      : image.clone();

    let jpeg_buffer = await resized.encodeJPEG(JPEG_QUALITY);
    let base64 = encodeBase64(jpeg_buffer);

    if (base64.length > MAX_BASE64_SIZE) {
      const smaller = image.clone().contain(ART_TARGET_SIZE, ART_TARGET_SIZE);
      jpeg_buffer = await smaller.encodeJPEG(JPEG_QUALITY);
      base64 = encodeBase64(jpeg_buffer);
    }

    const colors = extract_colors(image);

    return { base64, colors };
  } catch {
    return null;
  }
}

export async function process_art_from_url(
  url: string,
): Promise<ProcessedArt | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return null;

    const buffer = new Uint8Array(await response.arrayBuffer());
    return process_art_from_buffer(buffer);
  } catch {
    return null;
  }
}
