export interface TauonTrack {
  title: string;
  artist: string;
  album: string;
  album_artist: string;
  duration: number;
  id: number;
  position: number;
  path: string;
  album_id: number;
  has_lyrics: boolean;
  track_number: string;
  can_download: boolean;
}

export interface TauonStatus {
  status: "playing" | "paused" | "stopped";
  inc: number;
  shuffle: boolean;
  repeat: boolean;
  progress: number;
  auto_stop: boolean;
  volume: number;
  playlist: string;
  playlist_length: number;
  id: number;
  title: string;
  artist: string;
  album: string;
  track: TauonTrack;
  position: number;
  album_id: number;
}

export interface ColorPalette {
  dominant: string; // Hex color
  accent: string; // Hex color for equalizer/border
  highlight: string; // Bright highlight color
}

export interface NowPlayingData {
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  trackNumber: string;
  duration: number;
  progress: number;
  status: "playing" | "paused";
  artBase64: string | null;
  colors: ColorPalette | null;
  updatedAt: number;
}

export type VisualisationType =
  | "waveform"
  | "equalizer"
  | "rings"
  | "particles"
  | "vinyl";

export const VISUALISATION_TYPES: readonly VisualisationType[] = [
  "waveform",
  "equalizer",
  "rings",
  "particles",
  "vinyl",
];

export interface SvgConfig {
  width: number;
  height: number;
  cardBackground: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  albumSize: number;
  borderRadius: number;
  albumPosition: "left" | "right";
  textAlign: "left" | "center" | "right";
  showStatus: boolean;
  showTitle: boolean;
  showArtist: boolean;
  showAlbum: boolean;
  fontTitleFamily: string;
  fontBodyFamily: string;
  fontTitleFile: string;
  fontBodyFile: string;
  fontFallback: string;
  fontTitleDataUrl?: string;
  fontBodyDataUrl?: string;
  fontTitleFormat?: string;
  fontBodyFormat?: string;
  visualisation: VisualisationType;
}

export const defaultSvgConfig: SvgConfig = {
  width: 800,
  height: 200,
  cardBackground: "#18181b",
  cardBorder: "#27272a",
  textPrimary: "#fafafa",
  textSecondary: "#cbd5e1",
  textMuted: "#94a3b8",
  albumSize: 150,
  borderRadius: 16,
  albumPosition: "left",
  textAlign: "left",
  showStatus: true,
  showTitle: true,
  showArtist: true,
  showAlbum: true,
  fontTitleFamily: "DotGothic16",
  fontBodyFamily: "Space Mono",
  fontTitleFile: "DotGothic16-Regular.ttf",
  fontBodyFile: "SpaceMono-Regular.ttf",
  fontFallback: "'Segoe UI', sans-serif",
  visualisation: "waveform",
};
