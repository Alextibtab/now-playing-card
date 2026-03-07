import { SvgConfig, VISUALISATION_TYPES, VisualisationType } from "../types.ts";

const THEME_NAME_PATTERN = /^[a-z0-9_-]+$/i;
const VALID_FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const MAX_FONT_FAMILY_LENGTH = 100;
const theme_cache = new Map<string, SvgConfig>();

export function is_svg_config(value: unknown): value is SvgConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as Record<string, unknown>;
  const is_number = (input: unknown): input is number =>
    typeof input === "number" && Number.isFinite(input);
  const is_string = (input: unknown): input is string =>
    typeof input === "string" && input.length > 0;
  const is_boolean = (input: unknown): input is boolean =>
    typeof input === "boolean";
  const is_valid_weight = (input: unknown): input is number =>
    typeof input === "number" && VALID_FONT_WEIGHTS.includes(input);
  const is_valid_font_family = (input: unknown): input is string =>
    typeof input === "string" &&
    input.length > 0 &&
    input.length <= MAX_FONT_FAMILY_LENGTH;
  const album_position = config.album_position;
  const text_align = config.text_align;
  return is_number(config.width) &&
    is_number(config.height) &&
    (config.card_background === undefined ||
      is_string(config.card_background)) &&
    (config.card_border === undefined || is_string(config.card_border)) &&
    is_string(config.text_primary) &&
    is_string(config.text_secondary) &&
    is_string(config.text_muted) &&
    is_number(config.album_size) &&
    is_number(config.border_radius) &&
    (album_position === "left" || album_position === "right") &&
    (text_align === "left" || text_align === "center" ||
      text_align === "right") &&
    is_boolean(config.show_status) &&
    is_boolean(config.show_title) &&
    is_boolean(config.show_artist) &&
    is_boolean(config.show_album) &&
    is_valid_font_family(config.font_title_family) &&
    is_valid_font_family(config.font_body_family) &&
    is_valid_weight(config.font_title_weight) &&
    is_valid_weight(config.font_body_weight) &&
    is_string(config.font_fallback) &&
    (config.visualisation === undefined ||
      VISUALISATION_TYPES.includes(
        config.visualisation as VisualisationType,
      ));
}

export async function load_theme(name: string): Promise<SvgConfig | null> {
  if (theme_cache.has(name)) {
    return theme_cache.get(name) ?? null;
  }

  if (!THEME_NAME_PATTERN.test(name)) {
    return null;
  }

  try {
    const theme_url = new URL(`../themes/${name}.json`, import.meta.url);
    const raw = await Deno.readTextFile(theme_url);
    const parsed = JSON.parse(raw);
    if (!is_svg_config(parsed)) {
      console.warn(`Theme schema invalid: ${name}`);
      return null;
    }
    theme_cache.set(name, parsed);
    return parsed;
  } catch (error) {
    console.warn(`Failed to load theme: ${name}`, error);
    return null;
  }
}
