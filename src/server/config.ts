import {
  default_svg_config,
  SvgConfig,
  VISUALISATION_TYPES,
  VisualisationType,
} from "../types.ts";
import {
  FONT_FALLBACK_PATTERN,
  FONT_FAMILY_PATTERN,
  HEX_COLOR_PATTERN,
  MAX_FONT_FAMILY_LENGTH,
  THEME_NAME_PATTERN,
  VALID_FONT_WEIGHTS,
} from "./constants.ts";
import { load_theme } from "./themes.ts";

export function parse_boolean_param(value: string | null): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true") return true;
  if (normalized === "0" || normalized === "false") return false;
  return undefined;
}

export function parse_text_align(
  value: string | null,
): "left" | "center" | "right" | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "left") return "left";
  if (normalized === "right") return "right";
  if (normalized === "center" || normalized === "centre") return "center";
  return undefined;
}

export function parse_font_family(value: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > MAX_FONT_FAMILY_LENGTH ||
    !FONT_FAMILY_PATTERN.test(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

export function parse_font_weight(value: string | null): number | undefined {
  if (!value) return undefined;
  const weight = parseInt(value, 10);
  if (isNaN(weight) || !VALID_FONT_WEIGHTS.includes(weight)) return undefined;
  return weight;
}

export async function build_svg_config(
  params: URLSearchParams,
): Promise<SvgConfig> {
  const theme_param = params.get("theme") || "default";
  const theme_name = THEME_NAME_PATTERN.test(theme_param)
    ? theme_param
    : "default";
  const theme = await load_theme(theme_name);
  const position = params.get("position");
  const album_position = position === "right"
    ? "right"
    : position === "left"
    ? "left"
    : undefined;
  const text_align = parse_text_align(params.get("align"));
  const show_status = parse_boolean_param(params.get("showStatus"));
  const show_title = parse_boolean_param(params.get("showTitle"));
  const show_artist = parse_boolean_param(params.get("showArtist"));
  const show_album = parse_boolean_param(params.get("showAlbum"));
  const vis_param = params.get("vis");
  const visualisation = vis_param &&
      VISUALISATION_TYPES.includes(vis_param as VisualisationType)
    ? vis_param as VisualisationType
    : undefined;
  const font_title_family = parse_font_family(params.get("fontTitleFamily"));
  const font_body_family = parse_font_family(params.get("fontBodyFamily"));
  const font_title_weight = parse_font_weight(params.get("fontTitleWeight"));
  const font_body_weight = parse_font_weight(params.get("fontBodyWeight"));
  const base_config: SvgConfig = {
    ...default_svg_config,
    ...(theme || {}),
    ...(album_position ? { album_position } : {}),
    ...(text_align ? { text_align } : {}),
    ...(show_status !== undefined ? { show_status } : {}),
    ...(show_title !== undefined ? { show_title } : {}),
    ...(show_artist !== undefined ? { show_artist } : {}),
    ...(show_album !== undefined ? { show_album } : {}),
    ...(visualisation ? { visualisation } : {}),
    ...(font_title_family ? { font_title_family } : {}),
    ...(font_body_family ? { font_body_family } : {}),
    ...(font_title_weight !== undefined ? { font_title_weight } : {}),
    ...(font_body_weight !== undefined ? { font_body_weight } : {}),
  };
  return base_config;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function sanitize_preview_config(
  raw: Record<string, unknown>,
): Partial<SvgConfig> {
  const config: Partial<SvgConfig> = {};

  if (typeof raw.width === "number" && Number.isFinite(raw.width)) {
    config.width = clamp(Math.round(raw.width), 200, 1600);
  }
  if (typeof raw.height === "number" && Number.isFinite(raw.height)) {
    config.height = clamp(Math.round(raw.height), 80, 600);
  }
  if (
    typeof raw.album_size === "number" &&
    Number.isFinite(raw.album_size)
  ) {
    config.album_size = clamp(Math.round(raw.album_size), 40, 400);
  }
  if (
    typeof raw.border_radius === "number" &&
    Number.isFinite(raw.border_radius)
  ) {
    config.border_radius = clamp(Math.round(raw.border_radius), 0, 64);
  }

  if (
    typeof raw.card_background === "string" &&
    HEX_COLOR_PATTERN.test(raw.card_background)
  ) {
    config.card_background = raw.card_background;
  }
  if (
    typeof raw.card_border === "string" &&
    HEX_COLOR_PATTERN.test(raw.card_border)
  ) {
    config.card_border = raw.card_border;
  }
  for (
    const key of ["text_primary", "text_secondary", "text_muted"] as const
  ) {
    const val = raw[key];
    if (typeof val === "string" && HEX_COLOR_PATTERN.test(val)) {
      config[key] = val;
    }
  }

  if (
    raw.album_position === "left" || raw.album_position === "right"
  ) {
    config.album_position = raw.album_position;
  }
  if (
    raw.text_align === "left" || raw.text_align === "center" ||
    raw.text_align === "right"
  ) {
    config.text_align = raw.text_align;
  }

  for (
    const key of [
      "show_status",
      "show_title",
      "show_artist",
      "show_album",
    ] as const
  ) {
    if (typeof raw[key] === "boolean") {
      config[key] = raw[key] as boolean;
    }
  }

  if (
    typeof raw.visualisation === "string" &&
    VISUALISATION_TYPES.includes(raw.visualisation as VisualisationType)
  ) {
    config.visualisation = raw.visualisation as VisualisationType;
  }

  if (
    typeof raw.font_title_family === "string" &&
    raw.font_title_family.length <= MAX_FONT_FAMILY_LENGTH &&
    FONT_FAMILY_PATTERN.test(raw.font_title_family)
  ) {
    config.font_title_family = raw.font_title_family;
  }
  if (
    typeof raw.font_body_family === "string" &&
    raw.font_body_family.length <= MAX_FONT_FAMILY_LENGTH &&
    FONT_FAMILY_PATTERN.test(raw.font_body_family)
  ) {
    config.font_body_family = raw.font_body_family;
  }
  if (
    typeof raw.font_title_weight === "number" &&
    VALID_FONT_WEIGHTS.includes(raw.font_title_weight)
  ) {
    config.font_title_weight = raw.font_title_weight;
  }
  if (
    typeof raw.font_body_weight === "number" &&
    VALID_FONT_WEIGHTS.includes(raw.font_body_weight)
  ) {
    config.font_body_weight = raw.font_body_weight;
  }
  if (
    typeof raw.font_fallback === "string" &&
    raw.font_fallback.length > 0 && raw.font_fallback.length <= 100 &&
    FONT_FALLBACK_PATTERN.test(raw.font_fallback)
  ) {
    config.font_fallback = raw.font_fallback;
  }

  return config;
}
