import { generateWaveformLayer } from "./waves.ts";
import type { VisualOutput, VisualParams } from "./types.ts";

/**
 * Original waveform visualisation — smooth morphing wave layers.
 *
 * Renders 2 background layers (always visible) and a 3rd foreground
 * layer when the track is actively playing.
 */
export function renderWaveform(params: VisualParams): VisualOutput {
  const {
    startX,
    endX,
    baseY,
    height,
    seed,
    isPlaying,
    highlight,
  } = params;

  const bgLayer1 = generateWaveformLayer(
    highlight,
    0.20,
    startX,
    endX,
    baseY,
    height,
    seed * 0.03,
    30,
    isPlaying,
  );

  const bgLayer2 = generateWaveformLayer(
    highlight,
    0.40,
    startX,
    endX,
    baseY,
    height * 0.7,
    seed * 0.05 + 4.1,
    60,
    isPlaying,
  );

  const fgLayer = isPlaying
    ? generateWaveformLayer(
      highlight,
      0.60,
      startX,
      endX,
      baseY,
      height * 0.85,
      seed * 0.08 + 8.2,
      25,
    )
    : "";

  const body = `
  <g fill="url(#visFade)" opacity="0.4" clip-path="url(#cardClip)">
    ${bgLayer1}
    ${bgLayer2}
  </g>
  ${
    fgLayer
      ? `<g fill="url(#visFade)" opacity="0.45" clip-path="url(#cardClip)">${fgLayer}</g>`
      : ""
  }`;

  return { defs: "", body };
}
