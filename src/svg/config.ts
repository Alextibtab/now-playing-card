import { escapeXml, estimateTextWidth } from "./text.ts";

const STALE_THRESHOLD_MS = 5 * 60 * 1000;

export interface PlaybackState {
  isPlaying: boolean;
  isLastPlayed: boolean;
  hasTrack: boolean;
  statusLabel: string;
}

export function computePlaybackState(
  data: { status?: string; updatedAt?: number } | null,
): PlaybackState {
  const now = Date.now();
  const updatedAt = data?.updatedAt ?? 0;
  const isStale = now - updatedAt > STALE_THRESHOLD_MS;

  const status = data?.status;
  const isPlaying = status === "playing" && !isStale;
  const isLastPlayed = status === "last-played" ||
    (status === "playing" && isStale);
  const hasTrack = !!(data && (isPlaying || isLastPlayed));
  const statusLabel = isPlaying ? "NOW PLAYING" : "LAST PLAYED";

  return {
    isPlaying,
    isLastPlayed,
    hasTrack,
    statusLabel,
  };
}

export interface ColorConfig {
  dominantColor: string;
  accentColor: string;
  highlight: string;
  baseDark: string;
  midDark: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
}

export function computeColors(
  data: {
    colors: { dominant: string; accent: string; highlight: string } | null;
  } | null,
  config: {
    cardBackground?: string;
    cardBorder?: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
  },
  mixColors: (color1: string, color2: string, ratio: number) => string,
): ColorConfig {
  const colors = data?.colors;
  const dominantColor = escapeXml(colors?.dominant || "#27272a");
  const accentColor = escapeXml(colors?.accent || "#22c55e");
  const highlight = escapeXml(
    colors?.highlight || mixColors(accentColor, "#ffffff", 0.45),
  );

  const baseDark = escapeXml(
    config.cardBackground || mixColors(dominantColor, "#050505", 0.82),
  );
  const midDark = escapeXml(
    config.cardBackground
      ? mixColors(config.cardBackground, "#0d0f12", 0.3)
      : mixColors(dominantColor, "#0d0f12", 0.7),
  );
  const borderColor = escapeXml(config.cardBorder || midDark);
  const textPrimary = escapeXml(config.textPrimary);
  const textSecondary = escapeXml(config.textSecondary);
  const textMuted = escapeXml(config.textMuted);

  return {
    dominantColor,
    accentColor,
    highlight,
    baseDark,
    midDark,
    borderColor,
    textPrimary,
    textSecondary,
    textMuted,
  };
}

export interface LayoutConfig {
  albumX: number;
  albumY: number;
  textAreaLeft: number;
  textAreaRight: number;
  textAreaWidth: number;
  textAnchor: "start" | "middle" | "end";
  textX: number;
  titleY: number;
  artistY: number;
  albumYPos: number;
  titleClipWidth: number;
}

export function computeLayout(
  width: number,
  height: number,
  albumSize: number,
  config: {
    albumPosition: "left" | "right";
    textAlign: "left" | "center" | "right";
  },
): LayoutConfig {
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
  const titleY = albumY + 40;
  const artistY = albumY + 76;
  const albumYPos = albumY + 90;
  const titleClipWidth = textAreaWidth;

  return {
    albumX,
    albumY,
    textAreaLeft,
    textAreaRight,
    textAreaWidth,
    textAnchor,
    textX,
    titleY,
    artistY,
    albumYPos,
    titleClipWidth,
  };
}

export interface TextConfig {
  titleFontSize: number;
  artistFontSize: number;
  albumFontSize: number;
  titleText: string;
  titleSeed: number;
  titleScrollDistance: number;
  titleScrollNeeded: boolean;
  titleMaxChars: number;
  artistMaxChars: number;
  albumMaxChars: number;
}

export function computeTextConfig(
  data: { title?: string } | null,
  layout: LayoutConfig,
  hashString: (s: string) => number,
): TextConfig {
  const titleFontSize = 24;
  const artistFontSize = 15;
  const albumFontSize = 13;
  const titleText = data?.title || "";
  const titleSeed = hashString(titleText || "tauon");
  const titleTextWidth = estimateTextWidth(titleText, titleFontSize);
  const titleGap = 36;
  const titleScrollDistance = Math.max(
    titleTextWidth + titleGap,
    layout.titleClipWidth + titleGap,
  );
  const titleScrollNeeded = layout.textAnchor !== "middle" &&
    layout.titleClipWidth > 0 &&
    estimateTextWidth(titleText, titleFontSize) > layout.titleClipWidth;
  const titleMaxChars = Math.max(
    10,
    Math.floor(layout.textAreaWidth / (titleFontSize * 0.55)),
  );
  const artistMaxChars = Math.max(
    10,
    Math.floor(layout.textAreaWidth / (artistFontSize * 0.55)),
  );
  const albumMaxChars = Math.max(
    10,
    Math.floor(layout.textAreaWidth / (albumFontSize * 0.55)),
  );

  return {
    titleFontSize,
    artistFontSize,
    albumFontSize,
    titleText,
    titleSeed,
    titleScrollDistance,
    titleScrollNeeded,
    titleMaxChars,
    artistMaxChars,
    albumMaxChars,
  };
}

export interface FontConfig {
  fontTitleFamily: string;
  fontBodyFamily: string;
  styleBlock: string;
}

export function computeFontConfig(
  config: {
    fontTitleFamily?: string;
    fontBodyFamily?: string;
    fontFallback: string;
    fontTitleWeight: number;
    fontBodyWeight: number;
  },
  titleFont: { cssBlock: string } | null,
  bodyFont: { cssBlock: string } | null,
): FontConfig {
  const fontFallback = escapeXml(config.fontFallback || "sans-serif");
  const fontTitleFamily = config.fontTitleFamily
    ? `'${escapeXml(config.fontTitleFamily)}', ${fontFallback}`
    : fontFallback;
  const fontBodyFamily = config.fontBodyFamily
    ? `'${escapeXml(config.fontBodyFamily)}', ${fontFallback}`
    : fontFallback;

  const fontFaces = [
    titleFont?.cssBlock || "",
    bodyFont?.cssBlock || "",
  ].filter(Boolean).join("\n");
  const styleBlock = fontFaces ? `<style>${fontFaces}</style>` : "";

  return { fontTitleFamily, fontBodyFamily, styleBlock };
}
