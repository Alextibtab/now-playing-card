import type { VisualOutput, VisualParams } from "./types.ts";

function seeded_random(index: number, seed: number): number {
  const value = Math.sin(index * 12.9898 + seed) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Floating particles — small circles that drift upward at varying
 * speeds and fade out as they rise.
 */
export function render_particles(params: VisualParams): VisualOutput {
  const {
    start_x,
    end_x,
    base_y,
    height,
    seed,
    is_playing,
    highlight,
    accent,
  } = params;

  const particle_count = 25;
  const total_width = end_x - start_x;
  const particles: string[] = [];

  for (let i = 0; i < particle_count; i++) {
    const r1 = seeded_random(i, seed);
    const r2 = seeded_random(i + 30, seed);
    const r3 = seeded_random(i + 60, seed);
    const r4 = seeded_random(i + 90, seed);

    const cx = start_x + r1 * total_width;
    const cy = base_y - r2 * height * 0.3; // start near bottom
    const radius = 1.5 + r3 * 3.5;
    const color = i % 3 === 0 ? accent : highlight;
    const start_opacity = 0.2 + r4 * 0.5;
    const duration = 8 + r2 * 14;
    const drift = height * (0.6 + r3 * 0.4);
    // Slight horizontal sway
    const sway_x = (r1 - 0.5) * 40;
    const delay = r4 * duration;

    if (is_playing) {
      particles.push(
        `<circle cx="${cx}" cy="${cy}" r="${radius}"
          fill="${color}" opacity="${start_opacity}">
          <animateTransform attributeName="transform"
            type="translate"
            values="0 0;${sway_x} -${drift};0 0"
            dur="${duration}s" begin="-${delay}s"
            repeatCount="indefinite" />
          <animate attributeName="opacity"
            values="${start_opacity};0.05;${start_opacity}"
            dur="${duration}s" begin="-${delay}s"
            repeatCount="indefinite" />
        </circle>`,
      );
    } else {
      // Paused: static particles at scattered positions
      const static_opacity = start_opacity * 0.5;
      particles.push(
        `<circle cx="${cx}" cy="${cy - r2 * drift * 0.3}"
          r="${radius}" fill="${color}"
          opacity="${static_opacity}" />`,
      );
    }
  }

  const body = `
  <g clip-path="url(#cardClip)">
    ${particles.join("\n    ")}
  </g>`;

  return { defs: "", body };
}
