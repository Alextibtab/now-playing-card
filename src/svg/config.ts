import { escape_xml, estimate_text_width } from "./text.ts";

const STALE_THRESHOLD_MS = 5 * 60 * 1000;

export interface PlaybackState {
  is_playing: boolean;
  is_last_played: boolean;
  has_track: boolean;
  status_label: string;
}

export function compute_playback_state(
  data: { status?: string; updated_at?: number } | null,
): PlaybackState {
  const now = Date.now();
  const updated_at = data?.updated_at ?? 0;
  const is_stale = now - updated_at > STALE_THRESHOLD_MS;

  const status = data?.status;
  const is_playing = status === "playing" && !is_stale;
  const is_last_played = status === "last-played" ||
    (status === "playing" && is_stale);
  const has_track = !!(data && (is_playing || is_last_played));
  const status_label = is_playing ? "NOW PLAYING" : "LAST PLAYED";

  return {
    is_playing,
    is_last_played,
    has_track,
    status_label,
  };
}

export interface ColorConfig {
  dominant_color: string;
  accent_color: string;
  highlight: string;
  base_dark: string;
  mid_dark: string;
  border_color: string;
  text_primary: string;
  text_secondary: string;
  text_muted: string;
}

export function compute_colors(
  data: {
    colors: { dominant: string; accent: string; highlight: string } | null;
  } | null,
  config: {
    card_background?: string;
    card_border?: string;
    text_primary: string;
    text_secondary: string;
    text_muted: string;
  },
  mix_colors: (color1: string, color2: string, ratio: number) => string,
): ColorConfig {
  const colors = data?.colors;
  const dominant_color = escape_xml(colors?.dominant || "#27272a");
  const accent_color = escape_xml(colors?.accent || "#22c55e");
  const highlight = escape_xml(
    colors?.highlight || mix_colors(accent_color, "#ffffff", 0.45),
  );

  const base_dark = escape_xml(
    config.card_background || mix_colors(dominant_color, "#050505", 0.82),
  );
  const mid_dark = escape_xml(
    config.card_background
      ? mix_colors(config.card_background, "#0d0f12", 0.3)
      : mix_colors(dominant_color, "#0d0f12", 0.7),
  );
  const border_color = escape_xml(config.card_border || mid_dark);
  const text_primary = escape_xml(config.text_primary);
  const text_secondary = escape_xml(config.text_secondary);
  const text_muted = escape_xml(config.text_muted);

  return {
    dominant_color,
    accent_color,
    highlight,
    base_dark,
    mid_dark,
    border_color,
    text_primary,
    text_secondary,
    text_muted,
  };
}

export interface LayoutConfig {
  album_x: number;
  album_y: number;
  text_area_left: number;
  text_area_right: number;
  text_area_width: number;
  text_anchor: "start" | "middle" | "end";
  text_x: number;
  title_y: number;
  artist_y: number;
  album_y_pos: number;
  title_clip_width: number;
}

export function compute_layout(
  width: number,
  height: number,
  album_size: number,
  config: {
    album_position: "left" | "right";
    text_align: "left" | "center" | "right";
  },
): LayoutConfig {
  const padding = 26;
  const album_position = config.album_position || "left";
  const album_x = album_position === "right"
    ? width - padding - album_size
    : padding;
  const album_y = (height - album_size) / 2;
  const text_align = config.text_align || "left";
  const text_area_left = album_position === "right"
    ? padding
    : album_x + album_size + 22;
  const text_area_right = album_position === "right"
    ? album_x - 22
    : width - padding;
  const text_area_width = Math.max(0, text_area_right - text_area_left);
  const text_anchor = text_align === "right"
    ? "end"
    : text_align === "center"
    ? "middle"
    : "start";
  const text_x = text_align === "right"
    ? text_area_right
    : text_align === "center"
    ? text_area_left + text_area_width / 2
    : text_area_left;
  const title_y = album_y + 40;
  const artist_y = album_y + 76;
  const album_y_pos = album_y + 90;
  const title_clip_width = text_area_width;

  return {
    album_x,
    album_y,
    text_area_left,
    text_area_right,
    text_area_width,
    text_anchor,
    text_x,
    title_y,
    artist_y,
    album_y_pos,
    title_clip_width,
  };
}

export interface TextConfig {
  title_font_size: number;
  artist_font_size: number;
  album_font_size: number;
  title_text: string;
  title_seed: number;
  title_scroll_distance: number;
  title_scroll_needed: boolean;
  title_max_chars: number;
  artist_max_chars: number;
  album_max_chars: number;
}

export function compute_text_config(
  data: { title?: string } | null,
  layout: LayoutConfig,
  hash_string: (s: string) => number,
): TextConfig {
  const title_font_size = 24;
  const artist_font_size = 15;
  const album_font_size = 13;
  const title_text = data?.title || "";
  const title_seed = hash_string(title_text || "tauon");
  const title_text_width = estimate_text_width(title_text, title_font_size);
  const title_gap = 36;
  const title_scroll_distance = Math.max(
    title_text_width + title_gap,
    layout.title_clip_width + title_gap,
  );
  const title_scroll_needed = layout.text_anchor !== "middle" &&
    layout.title_clip_width > 0 &&
    estimate_text_width(title_text, title_font_size) > layout.title_clip_width;
  const title_max_chars = Math.max(
    10,
    Math.floor(layout.text_area_width / (title_font_size * 0.55)),
  );
  const artist_max_chars = Math.max(
    10,
    Math.floor(layout.text_area_width / (artist_font_size * 0.55)),
  );
  const album_max_chars = Math.max(
    10,
    Math.floor(layout.text_area_width / (album_font_size * 0.55)),
  );

  return {
    title_font_size,
    artist_font_size,
    album_font_size,
    title_text,
    title_seed,
    title_scroll_distance,
    title_scroll_needed,
    title_max_chars,
    artist_max_chars,
    album_max_chars,
  };
}

export interface FontConfig {
  font_title_family: string;
  font_body_family: string;
  style_block: string;
}

export function compute_font_config(
  config: {
    font_title_family?: string;
    font_body_family?: string;
    font_fallback: string;
    font_title_weight: number;
    font_body_weight: number;
  },
  title_font: { css_block: string } | null,
  body_font: { css_block: string } | null,
): FontConfig {
  const font_fallback = escape_xml(config.font_fallback || "sans-serif");
  const font_title_family = config.font_title_family
    ? `'${escape_xml(config.font_title_family)}', ${font_fallback}`
    : font_fallback;
  const font_body_family = config.font_body_family
    ? `'${escape_xml(config.font_body_family)}', ${font_fallback}`
    : font_fallback;

  const font_faces = [
    title_font?.css_block || "",
    body_font?.css_block || "",
  ].filter(Boolean).join("\n");
  const style_block = font_faces ? `<style>${font_faces}</style>` : "";

  return { font_title_family, font_body_family, style_block };
}
