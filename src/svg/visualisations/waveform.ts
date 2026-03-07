import { generate_waveform_layer } from "./waves.ts";
import type { VisualOutput, VisualParams } from "./types.ts";

/**
 * Original waveform visualisation — smooth morphing wave layers.
 *
 * Renders 2 background layers (always visible) and a 3rd foreground
 * layer when the track is actively playing.
 */
export function render_waveform(params: VisualParams): VisualOutput {
  const {
    start_x,
    end_x,
    base_y,
    height,
    seed,
    is_playing,
    highlight,
  } = params;

  const bg_layer1 = generate_waveform_layer(
    highlight,
    0.20,
    start_x,
    end_x,
    base_y,
    height,
    seed * 0.03,
    30,
    is_playing,
  );

  const bg_layer2 = generate_waveform_layer(
    highlight,
    0.40,
    start_x,
    end_x,
    base_y,
    height * 0.7,
    seed * 0.05 + 4.1,
    60,
    is_playing,
  );

  const fg_layer = is_playing
    ? generate_waveform_layer(
      highlight,
      0.60,
      start_x,
      end_x,
      base_y,
      height * 0.85,
      seed * 0.08 + 8.2,
      25,
    )
    : "";

  const body = `
  <g fill="url(#visFade)" opacity="0.4" clip-path="url(#cardClip)">
    ${bg_layer1}
    ${bg_layer2}
  </g>
  ${
    fg_layer
      ? `<g fill="url(#visFade)" opacity="0.45" clip-path="url(#cardClip)">${fg_layer}</g>`
      : ""
  }`;

  return { defs: "", body };
}
