import type { VisualOutput, VisualParams } from "./types.ts";
import { seeded_random } from "./types.ts";

/**
 * Ambient orbs — layered soft radial-gradient circles at varied
 * sizes that gently breathe (radius + opacity) with subtle drift.
 * Overlapping gradients blend highlight and accent for warm color
 * mixing.
 */
export function render_orbs(params: VisualParams): VisualOutput {
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

  const total_width = end_x - start_x;

  const orb_defs: Array<{
    cx: number;
    cy: number;
    radius: number;
    layer: "back" | "front";
  }> = [];

  // 3 large background orbs
  for (let i = 0; i < 3; i++) {
    const r1 = seeded_random(i, seed);
    const r2 = seeded_random(i + 10, seed);
    const r3 = seeded_random(i + 20, seed);
    orb_defs.push({
      cx: start_x + (0.1 + r1 * 0.8) * total_width,
      cy: base_y - (0.15 + r2 * 0.6) * height,
      radius: 80 + r3 * 50,
      layer: "back",
    });
  }

  // 5 smaller foreground orbs
  for (let i = 0; i < 5; i++) {
    const r1 = seeded_random(i + 40, seed);
    const r2 = seeded_random(i + 50, seed);
    const r3 = seeded_random(i + 60, seed);
    orb_defs.push({
      cx: start_x + (0.05 + r1 * 0.9) * total_width,
      cy: base_y - (0.1 + r2 * 0.7) * height,
      radius: 25 + r3 * 35,
      layer: "front",
    });
  }

  const gradients: string[] = [];
  const back_orbs: string[] = [];
  const front_orbs: string[] = [];

  for (let i = 0; i < orb_defs.length; i++) {
    const orb = orb_defs[i];
    const r4 = seeded_random(i + 70, seed);
    const r5 = seeded_random(i + 80, seed);
    const grad_id = `orb${i}`;
    const is_back = orb.layer === "back";

    const inner_color = i % 3 === 0 ? accent : highlight;
    const mid_color = i % 3 === 2 ? accent : highlight;

    gradients.push(
      `<radialGradient id="${grad_id}">
        <stop offset="0%" stop-color="${inner_color}" stop-opacity="0.6" />
        <stop offset="40%" stop-color="${mid_color}" stop-opacity="0.25" />
        <stop offset="100%" stop-color="${inner_color}" stop-opacity="0" />
      </radialGradient>`,
    );

    const target = is_back ? back_orbs : front_orbs;

    if (is_playing) {
      const duration = is_back ? 5 + r4 * 4 : 3 + r4 * 3;
      const offset = r5 * duration;
      const r_min = orb.radius * 0.8;
      const r_max = orb.radius * 1.2;
      const op_min = is_back ? 0.25 : 0.35;
      const op_max = is_back ? 0.6 : 0.75;
      // Build a long multi-waypoint wander path with large
      // displacement so orbs drift across the card slowly
      const range = is_back ? 250 : 160;
      const waypoint_count = 8;
      const waypoints: string[] = ["0 0"];
      for (let w = 1; w <= waypoint_count; w++) {
        const wx = (seeded_random(i * 10 + w, seed) - 0.5) * range;
        const wy = (seeded_random(i * 10 + w + 50, seed) - 0.5) *
          range * 0.6;
        waypoints.push(`${wx} ${wy}`);
      }
      waypoints.push("0 0");
      const wander_dur = is_back ? 40 + r4 * 30 : 30 + r4 * 20;

      target.push(
        `<circle cx="${orb.cx}" cy="${orb.cy}" r="${r_min}"
          fill="url(#${grad_id})" opacity="${op_max}">
          <animate attributeName="r"
            values="${r_min};${r_max};${r_min}"
            dur="${duration}s" begin="-${offset}s"
            repeatCount="indefinite" />
          <animate attributeName="opacity"
            values="${op_max};${op_min};${op_max}"
            dur="${duration * 0.8}s" begin="-${offset}s"
            repeatCount="indefinite" />
          <animateTransform attributeName="transform"
            type="translate"
            values="${waypoints.join(";")}"
            dur="${wander_dur}s" begin="-${offset}s"
            repeatCount="indefinite" />
        </circle>`,
      );
    } else {
      const static_opacity = is_back ? 0.35 : 0.45;
      target.push(
        `<circle cx="${orb.cx}" cy="${orb.cy}" r="${orb.radius}"
          fill="url(#${grad_id})" opacity="${static_opacity}" />`,
      );
    }
  }

  const defs = gradients.join("\n    ");

  const body = `
  <g clip-path="url(#cardClip)">
    ${back_orbs.join("\n    ")}
    ${front_orbs.join("\n    ")}
  </g>`;

  return { defs, body };
}
