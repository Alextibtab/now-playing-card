import { default_svg_config, NowPlayingData, SvgConfig } from "../types.ts";
import { mix_colors } from "./colors.ts";
import { generate_music_note_placeholder } from "./icons.ts";
import { escape_xml, truncate_text } from "./text.ts";
import { render_visualisation } from "./visualisations/index.ts";
import {
  compute_colors,
  compute_font_config,
  compute_layout,
  compute_playback_state,
  compute_text_config,
} from "./config.ts";
import { load_google_font } from "../server/fonts.ts";

export async function generate_now_playing_svg(
  data: NowPlayingData | null,
  config: SvgConfig = default_svg_config,
): Promise<string> {
  const playback = compute_playback_state(data);
  const colors = compute_colors(data, config, mix_colors);
  const layout = compute_layout(
    config.width,
    config.height,
    config.album_size,
    config,
  );
  const text = compute_text_config(data, layout, (s: string) => {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    }
    return hash;
  });

  const all_text = [
    data?.title || "",
    data?.artist || "",
    data?.album || "",
    playback.status_label,
  ].join("");

  const [title_font, body_font] = await Promise.all([
    load_google_font(
      config.font_title_family,
      config.font_title_weight,
      all_text,
    ),
    load_google_font(
      config.font_body_family,
      config.font_body_weight,
      all_text,
    ),
  ]);

  const fonts = compute_font_config(config, title_font, body_font);

  const { width, height, album_size } = config;
  const {
    album_x,
    album_y,
    text_area_left,
    text_anchor,
    text_x,
    title_y,
    artist_y,
    album_y_pos,
    title_clip_width,
  } = layout;
  const {
    highlight,
    accent_color,
    base_dark,
    mid_dark,
    border_color,
    text_primary,
    text_secondary,
    text_muted,
  } = colors;
  const {
    title_font_size,
    artist_font_size,
    album_font_size,
    title_scroll_distance,
    title_scroll_needed,
    title_max_chars,
    artist_max_chars,
    album_max_chars,
  } = text;
  const { font_title_family, font_body_family, style_block } = fonts;

  const bars_start_x = 2;
  const bars_end_x = width - 2;
  const wave_base_y = height - 2;
  const wave_height = 180;

  const vis = render_visualisation(config.visualisation, {
    start_x: bars_start_x,
    end_x: bars_end_x,
    base_y: wave_base_y,
    height: wave_height,
    seed: text.title_seed,
    is_playing: playback.has_track,
    highlight,
    accent: accent_color,
  });

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    ${style_block}
    <linearGradient id="cardGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${base_dark}" />
      <stop offset="60%" stop-color="${mid_dark}" />
      <stop offset="100%" stop-color="${base_dark}" />
    </linearGradient>
    <linearGradient id="visFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${highlight}" stop-opacity="1" />
      <stop offset="100%" stop-color="${accent_color}" stop-opacity="0.3" />
    </linearGradient>
    <clipPath id="albumClip">
      <rect x="${album_x}" y="${album_y}" width="${album_size}" height="${album_size}" rx="${config.border_radius}" />
    </clipPath>
    <clipPath id="cardClip" clipPathUnits="userSpaceOnUse">
      <rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="${
    config.border_radius - 2
  }" />
    </clipPath>
    <clipPath id="titleClip" clipPathUnits="userSpaceOnUse">
      <rect x="${text_area_left}" y="${
    album_y + 18
  }" width="${title_clip_width}" height="36" />
    </clipPath>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="${highlight}" flood-opacity="0.65" />
      <feDropShadow dx="0" dy="0" stdDeviation="16" flood-color="${highlight}" flood-opacity="0.25" />
    </filter>
    <filter id="textGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="${highlight}" flood-opacity="0.6" />
    </filter>
    ${vis.defs}
  </defs>

  <!-- Card background with clean rounded border -->
  <rect width="${width}" height="${height}" rx="${config.border_radius}" fill="${border_color}" />
  <rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="${
    config.border_radius - 2
  }" fill="url(#cardGradient)" />

  <!-- Visualisation -->
  ${vis.body}

  <!-- Text content -->
  <g font-family="${font_body_family}">
    ${
    playback.has_track
      ? `
    ${
        config.show_status
          ? `
    <!-- Status pill -->
    <text x="${text_x}" y="${
            album_y + 18
          }" fill="${highlight}" font-size="12" font-weight="700" letter-spacing="0.12em" filter="url(#textGlow)" text-anchor="${text_anchor}" font-family="${font_body_family}">
      ${playback.status_label}
    </text>
    `
          : ""
      }

    ${
        config.show_title
          ? `
    <!-- Title -->
    ${
            title_scroll_needed
              ? `
    <g clip-path="url(#titleClip)">
      <g>
        <text x="${text_area_left}" y="${title_y}" fill="${text_primary}" font-size="${title_font_size}" font-weight="600" filter="url(#textGlow)" font-family="${font_title_family}">
          ${escape_xml(data?.title ?? "")}
        </text>
        <text x="${
                text_area_left + title_scroll_distance
              }" y="${title_y}" fill="${text_primary}" font-size="${title_font_size}" font-weight="600" filter="url(#textGlow)" font-family="${font_title_family}">
          ${escape_xml(data?.title ?? "")}
        </text>
        <animateTransform attributeName="transform" type="translate" from="0 0" to="-${title_scroll_distance} 0" dur="15s" repeatCount="indefinite" />
      </g>
    </g>
    `
              : `
    <text x="${text_x}" y="${title_y}" fill="${text_primary}" font-size="${title_font_size}" font-weight="600" text-overflow="ellipsis" filter="url(#textGlow)" text-anchor="${text_anchor}" font-family="${font_title_family}">
      ${escape_xml(truncate_text(data?.title ?? "", title_max_chars))}
    </text>
    `
          }
    `
          : ""
      }

    ${
        config.show_artist
          ? `
    <!-- Artist -->
    <text x="${text_x}" y="${artist_y}" fill="${text_secondary}" font-size="${artist_font_size}" text-anchor="${text_anchor}" font-family="${font_body_family}">
      ${escape_xml(truncate_text(data?.artist ?? "", artist_max_chars))}
    </text>
    `
          : ""
      }

    ${
        config.show_album
          ? `
    <!-- Album and status -->
    <text x="${text_x}" y="${album_y_pos}" fill="${text_muted}" font-size="${album_font_size}" text-anchor="${text_anchor}" font-family="${font_body_family}">
      ${escape_xml(truncate_text(data?.album ?? "", album_max_chars))}
    </text>
    `
          : ""
      }
    `
      : `
    <!-- Not playing message -->
    <text x="${text_x}" y="${
        height / 2
      }" fill="${text_muted}" font-size="14" dominant-baseline="middle" text-anchor="${text_anchor}" font-family="${font_body_family}">
      Nothing playing right now
    </text>
    `
  }
  </g>

  ${
    playback.has_track && data?.art_base64
      ? `
  <!-- Album art with rounded corners -->
  <image x="${album_x}" y="${album_y}" width="${album_size}" height="${album_size}" xlink:href="data:image/jpeg;base64,${
        escape_xml(data.art_base64)
      }" clip-path="url(#albumClip)" preserveAspectRatio="xMidYMid slice" filter="url(#glow)" />
  <rect x="${album_x}" y="${album_y}" width="${album_size}" height="${album_size}" rx="${config.border_radius}" fill="none" stroke="${highlight}" stroke-opacity="0.75" stroke-width="3" filter="url(#textGlow)" />
  `
      : generate_music_note_placeholder(album_x, album_y, album_size, highlight)
  }
</svg>`;

  return svg;
}
