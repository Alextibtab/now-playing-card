import { encodeBase64 } from "@std/encoding";

const FONT_FILE_PATTERN = /^[a-z0-9._-]+$/i;
const fontCache = new Map<string, { dataUrl: string; format: string }>();

export function getFontFormat(fileName: string): string | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".woff2")) return "woff2";
  if (lower.endsWith(".woff")) return "woff";
  if (lower.endsWith(".ttf")) return "truetype";
  if (lower.endsWith(".otf")) return "opentype";
  return null;
}

export async function loadFontData(
  fileName: string,
): Promise<{ dataUrl: string; format: string } | null> {
  if (!FONT_FILE_PATTERN.test(fileName)) {
    return null;
  }
  if (fontCache.has(fileName)) {
    return fontCache.get(fileName) ?? null;
  }
  const format = getFontFormat(fileName);
  if (!format) return null;
  try {
    const fontUrl = new URL(`../../assets/fonts/${fileName}`, import.meta.url);
    const data = await Deno.readFile(fontUrl);
    const base64 = encodeBase64(data);
    const mime = format === "woff2"
      ? "font/woff2"
      : format === "woff"
      ? "font/woff"
      : format === "truetype"
      ? "font/ttf"
      : "font/otf";
    const dataUrl = `data:${mime};base64,${base64}`;
    const entry = { dataUrl, format };
    fontCache.set(fileName, entry);
    return entry;
  } catch (error) {
    console.warn(`Failed to load font: ${fileName}`, error);
    return null;
  }
}
