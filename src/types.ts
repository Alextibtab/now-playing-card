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
  dominant: string;
  accent: string;
  highlight: string;
}

export interface NowPlayingData {
  title: string;
  artist: string;
  album: string;
  status: "playing" | "last-played";
  art_base64: string | null;
  colors: ColorPalette | null;
  updated_at: number;
}

export type VisualisationType =
  | "waveform"
  | "equalizer"
  | "orbs"
  | "particles";

export const VISUALISATION_TYPES: readonly VisualisationType[] = [
  "waveform",
  "equalizer",
  "orbs",
  "particles",
];

export interface SvgConfig {
  width: number;
  height: number;
  card_background?: string;
  card_border?: string;
  text_primary: string;
  text_secondary: string;
  text_muted: string;
  album_size: number;
  border_radius: number;
  album_position: "left" | "right";
  text_align: "left" | "center" | "right";
  show_status: boolean;
  show_title: boolean;
  show_artist: boolean;
  show_album: boolean;
  font_title_family: string;
  font_body_family: string;
  font_title_weight: number;
  font_body_weight: number;
  font_fallback: string;
  font_title_data_url?: string;
  font_body_data_url?: string;
  visualisation: VisualisationType;
}

export const default_svg_config: SvgConfig = {
  width: 800,
  height: 200,
  text_primary: "#fafafa",
  text_secondary: "#cbd5e1",
  text_muted: "#94a3b8",
  album_size: 150,
  border_radius: 16,
  album_position: "left",
  text_align: "left",
  show_status: true,
  show_title: true,
  show_artist: true,
  show_album: true,
  font_title_family: "DotGothic16",
  font_body_family: "Space Mono",
  font_title_weight: 400,
  font_body_weight: 400,
  font_fallback: "'Segoe UI', sans-serif",
  visualisation: "waveform",
};

export type SourceType = "tauon" | "spotify" | "lastfm" | "tidal";
