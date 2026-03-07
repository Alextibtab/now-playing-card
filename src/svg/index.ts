import { defaultSvgConfig, NowPlayingData, SvgConfig } from "../types.ts";
import { mixColors } from "./colors.ts";
import { generateMusicNotePlaceholder } from "./icons.ts";
import { escapeXml, truncateText } from "./text.ts";
import { renderVisualisation } from "./visualisations/index.ts";
import {
  computeColors,
  computeFontConfig,
  computeLayout,
  computePlaybackState,
  computeTextConfig,
} from "./config.ts";
import { loadGoogleFont } from "../server/fonts.ts";

export async function generateNowPlayingSvg(
  data: NowPlayingData | null,
  config: SvgConfig = defaultSvgConfig,
): Promise<string> {
  const playback = computePlaybackState(data);
  const colors = computeColors(data, config, mixColors);
  const layout = computeLayout(
    config.width,
    config.height,
    config.albumSize,
    config,
  );
  const text = computeTextConfig(data, layout, (s) => {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    }
    return hash;
  });

  const allText = [
    data?.title || "",
    data?.artist || "",
    data?.album || "",
    playback.statusLabel,
  ].join("");

  const [titleFont, bodyFont] = await Promise.all([
    loadGoogleFont(config.fontTitleFamily, config.fontTitleWeight, allText),
    loadGoogleFont(config.fontBodyFamily, config.fontBodyWeight, allText),
  ]);

  const fonts = computeFontConfig(config, titleFont, bodyFont);

  const { width, height, albumSize } = config;
  const {
    albumX,
    albumY,
    textAreaLeft,
    textAnchor,
    textX,
    titleY,
    artistY,
    albumYPos,
    titleClipWidth,
  } = layout;
  const {
    highlight,
    accentColor,
    baseDark,
    midDark,
    borderColor,
    textPrimary,
    textSecondary,
    textMuted,
  } = colors;
  const {
    titleFontSize,
    artistFontSize,
    albumFontSize,
    titleScrollDistance,
    titleScrollNeeded,
    titleMaxChars,
    artistMaxChars,
    albumMaxChars,
  } = text;
  const { fontTitleFamily, fontBodyFamily, styleBlock } = fonts;

  const barsStartX = 2;
  const barsEndX = width - 2;
  const waveBaseY = height - 2;
  const waveHeight = 180;

  const vis = renderVisualisation(config.visualisation, {
    startX: barsStartX,
    endX: barsEndX,
    baseY: waveBaseY,
    height: waveHeight,
    seed: text.titleSeed,
    isPlaying: playback.hasTrack,
    highlight,
    accent: accentColor,
  });

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    ${styleBlock}
    <linearGradient id="cardGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${baseDark}" />
      <stop offset="60%" stop-color="${midDark}" />
      <stop offset="100%" stop-color="${baseDark}" />
    </linearGradient>
    <linearGradient id="visFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${highlight}" stop-opacity="1" />
      <stop offset="100%" stop-color="${accentColor}" stop-opacity="0.3" />
    </linearGradient>
    <clipPath id="albumClip">
      <rect x="${albumX}" y="${albumY}" width="${albumSize}" height="${albumSize}" rx="${config.borderRadius}" />
    </clipPath>
    <clipPath id="cardClip" clipPathUnits="userSpaceOnUse">
      <rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="${
    config.borderRadius - 2
  }" />
    </clipPath>
    <clipPath id="titleClip" clipPathUnits="userSpaceOnUse">
      <rect x="${textAreaLeft}" y="${
    albumY + 18
  }" width="${titleClipWidth}" height="36" />
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
  <rect width="${width}" height="${height}" rx="${config.borderRadius}" fill="${borderColor}" />
  <rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="${
    config.borderRadius - 2
  }" fill="url(#cardGradient)" />

  <!-- Visualisation -->
  ${vis.body}

  <!-- Text content -->
  <g font-family="${fontBodyFamily}">
    ${
    playback.hasTrack
      ? `
    ${
        config.showStatus
          ? `
    <!-- Status pill -->
    <text x="${textX}" y="${
            albumY + 18
          }" fill="${highlight}" font-size="12" font-weight="700" letter-spacing="0.12em" filter="url(#textGlow)" text-anchor="${textAnchor}" font-family="${fontBodyFamily}">
      ${playback.statusLabel}
    </text>
    `
          : ""
      }

    ${
        config.showTitle
          ? `
    <!-- Title -->
    ${
            titleScrollNeeded
              ? `
    <g clip-path="url(#titleClip)">
      <g>
        <text x="${textAreaLeft}" y="${titleY}" fill="${textPrimary}" font-size="${titleFontSize}" font-weight="600" filter="url(#textGlow)" font-family="${fontTitleFamily}">
          ${escapeXml(data?.title ?? "")}
        </text>
        <text x="${
                textAreaLeft + titleScrollDistance
              }" y="${titleY}" fill="${textPrimary}" font-size="${titleFontSize}" font-weight="600" filter="url(#textGlow)" font-family="${fontTitleFamily}">
          ${escapeXml(data?.title ?? "")}
        </text>
        <animateTransform attributeName="transform" type="translate" from="0 0" to="-${titleScrollDistance} 0" dur="15s" repeatCount="indefinite" />
      </g>
    </g>
    `
              : `
    <text x="${textX}" y="${titleY}" fill="${textPrimary}" font-size="${titleFontSize}" font-weight="600" text-overflow="ellipsis" filter="url(#textGlow)" text-anchor="${textAnchor}" font-family="${fontTitleFamily}">
      ${escapeXml(truncateText(data?.title ?? "", titleMaxChars))}
    </text>
    `
          }
    `
          : ""
      }

    ${
        config.showArtist
          ? `
    <!-- Artist -->
    <text x="${textX}" y="${artistY}" fill="${textSecondary}" font-size="${artistFontSize}" text-anchor="${textAnchor}" font-family="${fontBodyFamily}">
      ${escapeXml(truncateText(data?.artist ?? "", artistMaxChars))}
    </text>
    `
          : ""
      }

    ${
        config.showAlbum
          ? `
    <!-- Album and status -->
    <text x="${textX}" y="${albumYPos}" fill="${textMuted}" font-size="${albumFontSize}" text-anchor="${textAnchor}" font-family="${fontBodyFamily}">
      ${escapeXml(truncateText(data?.album ?? "", albumMaxChars))}
    </text>
    `
          : ""
      }
    `
      : `
    <!-- Not playing message -->
    <text x="${textX}" y="${
        height / 2
      }" fill="${textMuted}" font-size="14" dominant-baseline="middle" text-anchor="${textAnchor}" font-family="${fontBodyFamily}">
      Nothing playing right now
    </text>
    `
  }
  </g>

  ${
    playback.hasTrack && data?.artBase64
      ? `
  <!-- Album art with rounded corners -->
  <image x="${albumX}" y="${albumY}" width="${albumSize}" height="${albumSize}" xlink:href="data:image/jpeg;base64,${
        escapeXml(data.artBase64)
      }" clip-path="url(#albumClip)" preserveAspectRatio="xMidYMid slice" filter="url(#glow)" />
  <rect x="${albumX}" y="${albumY}" width="${albumSize}" height="${albumSize}" rx="${config.borderRadius}" fill="none" stroke="${highlight}" stroke-opacity="0.75" stroke-width="3" filter="url(#textGlow)" />
  `
      : generateMusicNotePlaceholder(albumX, albumY, albumSize, highlight)
  }
</svg>`;

  return svg;
}
