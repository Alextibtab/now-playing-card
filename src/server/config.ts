import {
  defaultSvgConfig,
  SvgConfig,
  VISUALISATION_TYPES,
  VisualisationType,
} from "../types.ts";
import { loadTheme } from "./themes.ts";
import { loadFontData } from "./fonts.ts";

const FONT_FILE_PATTERN = /^[a-z0-9._-]+$/i;
const FONT_FAMILY_PATTERN = /^[a-z0-9 _-]+$/i;
const FONT_FALLBACK_PATTERN = /^[a-z0-9 _,'-]+$/i;
const THEME_NAME_PATTERN = /^[a-z0-9_-]+$/i;

export function parseBooleanParam(value: string | null): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true") return true;
  if (normalized === "0" || normalized === "false") return false;
  return undefined;
}

export function parseTextAlign(
  value: string | null,
): "left" | "center" | "right" | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "left") return "left";
  if (normalized === "right") return "right";
  if (normalized === "center" || normalized === "centre") return "center";
  return undefined;
}

export function inferFontFamily(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "");
  return base.replace(/[_-]+/g, " ").trim() || base;
}

export function parseFontFile(value: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  if (!normalized || !FONT_FILE_PATTERN.test(normalized)) return undefined;
  return normalized;
}

export function parseFontFamily(value: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  if (!normalized || !FONT_FAMILY_PATTERN.test(normalized)) return undefined;
  return normalized;
}

export async function buildSvgConfig(
  params: URLSearchParams,
): Promise<SvgConfig> {
  const themeParam = params.get("theme") || "default";
  const themeName = THEME_NAME_PATTERN.test(themeParam)
    ? themeParam
    : "default";
  const theme = await loadTheme(themeName);
  const position = params.get("position");
  const albumPosition = position === "right"
    ? "right"
    : position === "left"
    ? "left"
    : undefined;
  const textAlign = parseTextAlign(params.get("align"));
  const showStatus = parseBooleanParam(params.get("showStatus"));
  const showTitle = parseBooleanParam(params.get("showTitle"));
  const showArtist = parseBooleanParam(params.get("showArtist"));
  const showAlbum = parseBooleanParam(params.get("showAlbum"));
  const visParam = params.get("vis");
  const visualisation = visParam &&
      VISUALISATION_TYPES.includes(visParam as VisualisationType)
    ? visParam as VisualisationType
    : undefined;
  const fontTitleFile = parseFontFile(params.get("fontTitle"));
  const fontBodyFile = parseFontFile(params.get("fontBody"));
  const fontTitleFamilyParam = parseFontFamily(params.get("fontTitleFamily"));
  const fontBodyFamilyParam = parseFontFamily(params.get("fontBodyFamily"));
  const fontTitleFamily = fontTitleFamilyParam ||
    (fontTitleFile ? inferFontFamily(fontTitleFile) : undefined);
  const fontBodyFamily = fontBodyFamilyParam ||
    (fontBodyFile ? inferFontFamily(fontBodyFile) : undefined);
  const baseConfig: SvgConfig = {
    ...defaultSvgConfig,
    ...(theme || {}),
    ...(albumPosition ? { albumPosition } : {}),
    ...(textAlign ? { textAlign } : {}),
    ...(showStatus !== undefined ? { showStatus } : {}),
    ...(showTitle !== undefined ? { showTitle } : {}),
    ...(showArtist !== undefined ? { showArtist } : {}),
    ...(showAlbum !== undefined ? { showAlbum } : {}),
    ...(visualisation ? { visualisation } : {}),
    ...(fontTitleFile ? { fontTitleFile } : {}),
    ...(fontBodyFile ? { fontBodyFile } : {}),
    ...(fontTitleFamily ? { fontTitleFamily } : {}),
    ...(fontBodyFamily ? { fontBodyFamily } : {}),
  };
  const titleFont = await loadFontData(baseConfig.fontTitleFile);
  const bodyFont = await loadFontData(baseConfig.fontBodyFile);
  return {
    ...baseConfig,
    fontTitleDataUrl: titleFont?.dataUrl,
    fontBodyDataUrl: bodyFont?.dataUrl,
    fontTitleFormat: titleFont?.format,
    fontBodyFormat: bodyFont?.format,
  };
}

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function sanitizePreviewConfig(
  raw: Record<string, unknown>,
): Partial<SvgConfig> {
  const config: Partial<SvgConfig> = {};

  if (typeof raw.width === "number" && Number.isFinite(raw.width)) {
    config.width = clamp(Math.round(raw.width), 200, 1600);
  }
  if (typeof raw.height === "number" && Number.isFinite(raw.height)) {
    config.height = clamp(Math.round(raw.height), 80, 600);
  }
  if (typeof raw.albumSize === "number" && Number.isFinite(raw.albumSize)) {
    config.albumSize = clamp(Math.round(raw.albumSize), 40, 400);
  }
  if (
    typeof raw.borderRadius === "number" && Number.isFinite(raw.borderRadius)
  ) {
    config.borderRadius = clamp(Math.round(raw.borderRadius), 0, 64);
  }

  if (
    typeof raw.cardBackground === "string" &&
    HEX_COLOR_PATTERN.test(raw.cardBackground)
  ) {
    config.cardBackground = raw.cardBackground;
  }
  if (
    typeof raw.cardBorder === "string" &&
    HEX_COLOR_PATTERN.test(raw.cardBorder)
  ) {
    config.cardBorder = raw.cardBorder;
  }
  for (
    const key of ["textPrimary", "textSecondary", "textMuted"] as const
  ) {
    const val = raw[key];
    if (typeof val === "string" && HEX_COLOR_PATTERN.test(val)) {
      config[key] = val;
    }
  }

  if (raw.albumPosition === "left" || raw.albumPosition === "right") {
    config.albumPosition = raw.albumPosition;
  }
  if (
    raw.textAlign === "left" || raw.textAlign === "center" ||
    raw.textAlign === "right"
  ) {
    config.textAlign = raw.textAlign;
  }

  for (
    const key of ["showStatus", "showTitle", "showArtist", "showAlbum"] as const
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
    typeof raw.fontTitleFile === "string" &&
    FONT_FILE_PATTERN.test(raw.fontTitleFile)
  ) {
    config.fontTitleFile = raw.fontTitleFile;
    config.fontTitleFamily = typeof raw.fontTitleFamily === "string" &&
        FONT_FAMILY_PATTERN.test(raw.fontTitleFamily)
      ? raw.fontTitleFamily
      : inferFontFamily(raw.fontTitleFile);
  }
  if (
    typeof raw.fontBodyFile === "string" &&
    FONT_FILE_PATTERN.test(raw.fontBodyFile)
  ) {
    config.fontBodyFile = raw.fontBodyFile;
    config.fontBodyFamily = typeof raw.fontBodyFamily === "string" &&
        FONT_FAMILY_PATTERN.test(raw.fontBodyFamily)
      ? raw.fontBodyFamily
      : inferFontFamily(raw.fontBodyFile);
  }
  if (
    typeof raw.fontFallback === "string" &&
    raw.fontFallback.length > 0 && raw.fontFallback.length <= 100 &&
    FONT_FALLBACK_PATTERN.test(raw.fontFallback)
  ) {
    config.fontFallback = raw.fontFallback;
  }

  return config;
}
