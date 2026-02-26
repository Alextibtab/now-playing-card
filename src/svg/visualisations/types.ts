/** Parameters shared across all visualisation renderers. */
export interface VisualParams {
  /** Left edge X coordinate. */
  startX: number;
  /** Right edge X coordinate. */
  endX: number;
  /** Baseline Y position (bottom of the visual area). */
  baseY: number;
  /** Maximum height the visualisation can occupy. */
  height: number;
  /** Deterministic seed derived from the track title. */
  seed: number;
  /** Whether the track is actively playing. */
  isPlaying: boolean;
  /** Bright highlight color. */
  highlight: string;
  /** Accent color. */
  accent: string;
}

/** Output returned by a visualisation renderer. */
export interface VisualOutput {
  /** Extra SVG `<defs>` content (gradients, filters, clip paths). */
  defs: string;
  /** SVG body markup to render inside the card. */
  body: string;
}

/** A function that produces SVG markup for a visualisation. */
export type VisualisationRenderer = (
  params: VisualParams,
) => VisualOutput;
