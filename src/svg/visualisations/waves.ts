import { seeded_random } from "./types.ts";

/**
 * Produce a stable numeric seed from a string.
 *
 * @param input Source string.
 * @returns Non-negative integer seed.
 */
export function hash_string(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function generate_wave_path(
  start_x: number,
  end_x: number,
  base_y: number,
  height: number,
  points: number,
  seed: number,
): string {
  const step = (end_x - start_x) / (points - 1);
  const values = Array.from({ length: points }, (_, i) => {
    const rand = seeded_random(i, seed) * 0.75 +
      seeded_random(i + 7, seed) * 0.25;
    return {
      x: start_x + i * step,
      y: base_y - rand * height,
    };
  });

  let path = `M ${values[0].x} ${values[0].y}`;
  for (let i = 1; i < values.length - 1; i++) {
    const prev = values[i - 1];
    const current = values[i];
    const mid_x = (prev.x + current.x) / 2;
    const mid_y = (prev.y + current.y) / 2;
    path += ` Q ${prev.x} ${prev.y} ${mid_x} ${mid_y}`;
  }
  const last = values[values.length - 1];
  const second_last = values[values.length - 2];
  path += ` Q ${second_last.x} ${second_last.y} ${last.x} ${last.y}`;
  path += ` L ${end_x} ${base_y} L ${start_x} ${base_y} Z`;
  return path;
}

/**
 * Build a looping waveform path layer.
 *
 * @param color Fill color.
 * @param opacity Layer opacity.
 * @param start_x Wave start position.
 * @param end_x Wave end position.
 * @param base_y Baseline Y position.
 * @param height Wave height.
 * @param seed Random seed.
 * @param duration Animation duration in seconds.
 * @returns SVG path markup.
 */
export function generate_waveform_layer(
  color: string,
  opacity: number,
  start_x: number,
  end_x: number,
  base_y: number,
  height: number,
  seed: number,
  duration: number,
  animate = true,
): string {
  const path_a = generate_wave_path(start_x, end_x, base_y, height, 12, seed);
  if (!animate) {
    return `<path d="${path_a}" fill="${color}" opacity="${opacity}" />`;
  }
  const path_b = generate_wave_path(
    start_x,
    end_x,
    base_y,
    height,
    12,
    seed + 8.5,
  );
  return `<path d="${path_a}" fill="${color}" opacity="${opacity}">
    <animate attributeName="d" values="${path_a};${path_b};${path_a}" dur="${duration}s" repeatCount="indefinite" />
  </path>`;
}
