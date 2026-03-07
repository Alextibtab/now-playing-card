import type { VisualisationType } from "../../types.ts";
import type {
  VisualisationRenderer,
  VisualOutput,
  VisualParams,
} from "./types.ts";
import { render_waveform } from "./waveform.ts";
import { render_equalizer } from "./equalizer.ts";
import { render_orbs } from "./orbs.ts";
import { render_particles } from "./particles.ts";

const renderers: Record<VisualisationType, VisualisationRenderer> = {
  waveform: render_waveform,
  equalizer: render_equalizer,
  orbs: render_orbs,
  particles: render_particles,
};

/**
 * Render the selected visualisation.
 *
 * Falls back to `waveform` if the type is unknown.
 *
 * @param type Visualisation name from config.
 * @param params Shared rendering parameters.
 * @returns SVG defs and body markup.
 */
export function render_visualisation(
  type: VisualisationType,
  params: VisualParams,
): VisualOutput {
  const render = renderers[type] ?? renderers.waveform;
  return render(params);
}

export type { VisualOutput, VisualParams };
