import type { VisualOutput, VisualParams } from "./types.ts";
import { seeded_random } from "./types.ts";

/**
 * Classic equalizer bars — vertical rectangles animating at
 * staggered heights and durations.
 */
export function render_equalizer(params: VisualParams): VisualOutput {
  const {
    start_x,
    end_x,
    base_y,
    height,
    seed,
    is_playing,
  } = params;

  const bar_count = 20;
  const gap = 4;
  const total_width = end_x - start_x;
  const bar_width = (total_width - gap * (bar_count - 1)) / bar_count;
  const min_height = height * 0.08;
  const max_height = height * 0.85;

  const bars: string[] = [];

  for (let i = 0; i < bar_count; i++) {
    const rand = seeded_random(i, seed);
    const rand2 = seeded_random(i + 50, seed);
    const rand3 = seeded_random(i + 100, seed);

    const x = start_x + i * (bar_width + gap);
    const h1 = min_height + rand * (max_height - min_height);
    const h2 = min_height + rand2 * (max_height - min_height) * 0.6;
    const h3 = min_height + rand3 * (max_height - min_height) * 0.8;

    const y1 = base_y - h1;
    const y2 = base_y - h2;
    const y3 = base_y - h3;

    // Duration varies per bar for organic feel
    const duration = 2.5 + rand * 3.5;

    if (is_playing) {
      bars.push(
        `<rect x="${x}" width="${bar_width}" rx="2"
          y="${y1}" height="${h1}">
          <animate attributeName="y"
            values="${y1};${y2};${y3};${y1}"
            dur="${duration}s"
            repeatCount="indefinite" />
          <animate attributeName="height"
            values="${h1};${h2};${h3};${h1}"
            dur="${duration}s"
            repeatCount="indefinite" />
        </rect>`,
      );
    } else {
      // Paused: static bars at moderate height
      const static_h = min_height + rand * (max_height * 0.35 - min_height);
      const static_y = base_y - static_h;
      bars.push(
        `<rect x="${x}" y="${static_y}" width="${bar_width}" height="${static_h}" rx="2" />`,
      );
    }
  }

  const body = `
  <g fill="url(#visFade)" opacity="0.5" clip-path="url(#cardClip)">
    ${bars.join("\n    ")}
  </g>`;

  return { defs: "", body };
}
