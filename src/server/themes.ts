import { SvgConfig, VISUALISATION_TYPES, VisualisationType } from "../types.ts";

const THEME_NAME_PATTERN = /^[a-z0-9_-]+$/i;
const VALID_FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const themeCache = new Map<string, SvgConfig>();

export function isSvgConfig(value: unknown): value is SvgConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as Record<string, unknown>;
  const isNumber = (input: unknown): input is number =>
    typeof input === "number" && Number.isFinite(input);
  const isString = (input: unknown): input is string =>
    typeof input === "string" && input.length > 0;
  const isBoolean = (input: unknown): input is boolean =>
    typeof input === "boolean";
  const isValidWeight = (input: unknown): input is number =>
    typeof input === "number" && VALID_FONT_WEIGHTS.includes(input);
  const albumPosition = config.albumPosition;
  const textAlign = config.textAlign;
  return isNumber(config.width) &&
    isNumber(config.height) &&
    (config.cardBackground === undefined || isString(config.cardBackground)) &&
    (config.cardBorder === undefined || isString(config.cardBorder)) &&
    isString(config.textPrimary) &&
    isString(config.textSecondary) &&
    isString(config.textMuted) &&
    isNumber(config.albumSize) &&
    isNumber(config.borderRadius) &&
    (albumPosition === "left" || albumPosition === "right") &&
    (textAlign === "left" || textAlign === "center" ||
      textAlign === "right") &&
    isBoolean(config.showStatus) &&
    isBoolean(config.showTitle) &&
    isBoolean(config.showArtist) &&
    isBoolean(config.showAlbum) &&
    isString(config.fontTitleFamily) &&
    isString(config.fontBodyFamily) &&
    isValidWeight(config.fontTitleWeight) &&
    isValidWeight(config.fontBodyWeight) &&
    isString(config.fontFallback) &&
    (config.visualisation === undefined ||
      VISUALISATION_TYPES.includes(
        config.visualisation as VisualisationType,
      ));
}

export async function loadTheme(name: string): Promise<SvgConfig | null> {
  if (themeCache.has(name)) {
    return themeCache.get(name) ?? null;
  }

  if (!THEME_NAME_PATTERN.test(name)) {
    return null;
  }

  try {
    const themeUrl = new URL(`../themes/${name}.json`, import.meta.url);
    const raw = await Deno.readTextFile(themeUrl);
    const parsed = JSON.parse(raw);
    if (!isSvgConfig(parsed)) {
      console.warn(`Theme schema invalid: ${name}`);
      return null;
    }
    themeCache.set(name, parsed);
    return parsed;
  } catch (error) {
    console.warn(`Failed to load theme: ${name}`, error);
    return null;
  }
}
