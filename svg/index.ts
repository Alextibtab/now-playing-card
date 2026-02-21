import { defaultSvgConfig, NowPlayingData, SvgConfig } from "../types.ts";
import { mixColors } from "./colors.ts";
import { generateMusicNotePlaceholder } from "./icons.ts";
import { escapeXml, estimateTextWidth, truncateText } from "./text.ts";
import { hashString } from "./visualisations/waves.ts";
import { renderVisualisation } from "./visualisations/index.ts";

/**
 * Build the SVG widget for the current playback state.
 *
 * @param data Latest now playing payload or null for empty state.
 * @param config Visual configuration overrides.
 * @returns SVG markup as a string.
 */
export function generateNowPlayingSvg(
  data: NowPlayingData | null,
  config: SvgConfig = defaultSvgConfig,
): string {
  const isStale = data ? Date.now() - data.updatedAt > 5 * 60 * 1000 : true;
  const isPlaying = data && data.status === "playing" && !isStale;
  const isPaused = data && data.status === "paused" && !isStale;
  const hasTrack = data && (isPlaying || isPaused || isStale);

  // Use extracted colors or fall back to defaults
  const dominantColor = data?.colors?.dominant || "#27272a";
  const accentColor = data?.colors?.accent || "#22c55e";
  const highlight = data?.colors?.highlight ||
    mixColors(accentColor, "#ffffff", 0.45);

  // If the theme specifies card colors, use them directly.
  // Otherwise derive from the album art's dominant color.
  const baseDark = config.cardBackground ||
    mixColors(dominantColor, "#050505", 0.82);
  const midDark = config.cardBackground
    ? mixColors(config.cardBackground, "#0d0f12", 0.3)
    : mixColors(dominantColor, "#0d0f12", 0.7);
  const borderColor = config.cardBorder || midDark;

  const width = config.width;
  const height = config.height;
  const albumSize = config.albumSize;
  const padding = 26;
  const albumPosition = config.albumPosition || "left";
  const albumX = albumPosition === "right"
    ? width - padding - albumSize
    : padding;
  const albumY = (height - albumSize) / 2;
  const textAlign = config.textAlign || "left";
  const textAreaLeft = albumPosition === "right"
    ? padding
    : albumX + albumSize + 22;
  const textAreaRight = albumPosition === "right"
    ? albumX - 22
    : width - padding;
  const textAreaWidth = Math.max(0, textAreaRight - textAreaLeft);
  const textAnchor = textAlign === "right"
    ? "end"
    : textAlign === "center"
    ? "middle"
    : "start";
  const textX = textAlign === "right"
    ? textAreaRight
    : textAlign === "center"
    ? textAreaLeft + textAreaWidth / 2
    : textAreaLeft;
  const barsStartX = 2;
  const barsEndX = width - 2;
  const waveBaseY = height - 2;
  const waveHeight = 180;
  const titleFontSize = 24;
  const artistFontSize = 15;
  const albumFontSize = 13;
  const titleY = albumY + 40;
  const artistY = albumY + 76;
  const albumYPos = albumY + 90;
  const titleClipWidth = textAreaWidth;
  const titleText = data?.title || "";
  const titleSeed = hashString(titleText || "tauon");
  const titleTextWidth = estimateTextWidth(titleText, titleFontSize);
  const titleGap = 36;
  const titleScrollDistance = Math.max(
    titleTextWidth + titleGap,
    titleClipWidth + titleGap,
  );
  const titleScrollNeeded = textAlign !== "center" && titleClipWidth > 0 &&
    estimateTextWidth(titleText, titleFontSize) > titleClipWidth;
  const titleMaxChars = Math.max(
    10,
    Math.floor(textAreaWidth / (titleFontSize * 0.55)),
  );
  const artistMaxChars = Math.max(
    10,
    Math.floor(textAreaWidth / (artistFontSize * 0.55)),
  );
  const albumMaxChars = Math.max(
    10,
    Math.floor(textAreaWidth / (albumFontSize * 0.55)),
  );
  const fontFallback = config.fontFallback || "sans-serif";
  const fontTitleFamily = config.fontTitleFamily
    ? `'${config.fontTitleFamily}', ${fontFallback}`
    : fontFallback;
  const fontBodyFamily = config.fontBodyFamily
    ? `'${config.fontBodyFamily}', ${fontFallback}`
    : fontFallback;
  const fontFaces = [
    config.fontTitleDataUrl && config.fontTitleFamily
      ? `@font-face {
  font-family: '${config.fontTitleFamily}';
  src: url(${config.fontTitleDataUrl}) format('${
        config.fontTitleFormat || "truetype"
      }');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}`
      : "",
    config.fontBodyDataUrl && config.fontBodyFamily
      ? `@font-face {
  font-family: '${config.fontBodyFamily}';
  src: url(${config.fontBodyDataUrl}) format('${
        config.fontBodyFormat || "truetype"
      }');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}`
      : "",
  ].filter(Boolean).join("\n");
  const styleBlock = fontFaces ? `<style>${fontFaces}</style>` : "";

  const vis = renderVisualisation(config.visualisation, {
    startX: barsStartX,
    endX: barsEndX,
    baseY: waveBaseY,
    height: waveHeight,
    seed: titleSeed,
    isPlaying: !!isPlaying,
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
    albumY + 34
  }" width="${titleClipWidth}" height="26" />
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
    hasTrack
      ? `
    ${
        config.showStatus
          ? `
    <!-- Status pill -->
    <text x="${textX}" y="${
            albumY + 18
          }" fill="${highlight}" font-size="12" font-weight="700" letter-spacing="0.12em" filter="url(#textGlow)" text-anchor="${textAnchor}" font-family="${fontBodyFamily}">
      ${isStale ? "LAST PLAYED" : isPlaying ? "NOW PLAYING" : "PAUSED"}
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
        <text x="${textAreaLeft}" y="${titleY}" fill="${config.textPrimary}" font-size="${titleFontSize}" font-weight="600" filter="url(#textGlow)" font-family="${fontTitleFamily}">
          ${escapeXml(data.title)}
        </text>
        <text x="${
                textAreaLeft + titleScrollDistance
              }" y="${titleY}" fill="${config.textPrimary}" font-size="${titleFontSize}" font-weight="600" filter="url(#textGlow)" font-family="${fontTitleFamily}">
          ${escapeXml(data.title)}
        </text>
        <animateTransform attributeName="transform" type="translate" from="0 0" to="-${titleScrollDistance} 0" dur="15s" repeatCount="indefinite" />
      </g>
    </g>
    `
              : `
    <text x="${textX}" y="${titleY}" fill="${config.textPrimary}" font-size="${titleFontSize}" font-weight="600" text-overflow="ellipsis" filter="url(#textGlow)" text-anchor="${textAnchor}" font-family="${fontTitleFamily}">
      ${escapeXml(truncateText(data.title, titleMaxChars))}
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
    <text x="${textX}" y="${artistY}" fill="${config.textSecondary}" font-size="${artistFontSize}" text-anchor="${textAnchor}" font-family="${fontBodyFamily}">
      ${escapeXml(truncateText(data.artist, artistMaxChars))}
    </text>
    `
          : ""
      }

    ${
        config.showAlbum
          ? `
    <!-- Album and status -->
    <text x="${textX}" y="${albumYPos}" fill="${config.textMuted}" font-size="${albumFontSize}" text-anchor="${textAnchor}" font-family="${fontBodyFamily}">
      ${escapeXml(truncateText(data.album, albumMaxChars))}
    </text>
    `
          : ""
      }
    `
      : `
    <!-- Not playing message -->
    <text x="${textX}" y="${
        height / 2
      }" fill="${config.textMuted}" font-size="14" dominant-baseline="middle" text-anchor="${textAnchor}" font-family="${fontBodyFamily}">
      Nothing playing right now
    </text>
    `
  }
  </g>

  ${
    hasTrack && data.artBase64
      ? `
  <!-- Album art with rounded corners -->
  <image x="${albumX}" y="${albumY}" width="${albumSize}" height="${albumSize}" xlink:href="data:image/jpeg;base64,${data.artBase64}" clip-path="url(#albumClip)" preserveAspectRatio="xMidYMid slice" filter="url(#glow)" />
  <rect x="${albumX}" y="${albumY}" width="${albumSize}" height="${albumSize}" rx="${config.borderRadius}" fill="none" stroke="${highlight}" stroke-opacity="0.75" stroke-width="3" filter="url(#textGlow)" />
  `
      : generateMusicNotePlaceholder(
        albumX,
        albumY,
        albumSize,
        highlight,
      )
  }
</svg>`;

  return svg;
}
