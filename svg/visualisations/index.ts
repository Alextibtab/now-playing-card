import type { VisualisationType } from "../../types.ts";
import type {
  VisualisationRenderer,
  VisualOutput,
  VisualParams,
} from "./types.ts";
import { renderWaveform } from "./waveform.ts";
import { renderEqualizer } from "./equalizer.ts";
import { renderOrbs } from "./orbs.ts";
import { renderParticles } from "./particles.ts";

const renderers: Record<VisualisationType, VisualisationRenderer> = {
  waveform: renderWaveform,
  equalizer: renderEqualizer,
  orbs: renderOrbs,
  particles: renderParticles,
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
export function renderVisualisation(
  type: VisualisationType,
  params: VisualParams,
): VisualOutput {
  const render = renderers[type] ?? renderers.waveform;
  return render(params);
}

export type { VisualOutput, VisualParams };
