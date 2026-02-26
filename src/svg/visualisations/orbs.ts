import type { VisualOutput, VisualParams } from "./types.ts";

function seededRandom(index: number, seed: number): number {
  const value = Math.sin(index * 12.9898 + seed) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Ambient orbs — layered soft radial-gradient circles at varied
 * sizes that gently breathe (radius + opacity) with subtle drift.
 * Overlapping gradients blend highlight and accent for warm color
 * mixing.
 */
export function renderOrbs(params: VisualParams): VisualOutput {
  const {
    startX,
    endX,
    baseY,
    height,
    seed,
    isPlaying,
    highlight,
    accent,
  } = params;

  const totalWidth = endX - startX;

  const orbDefs: Array<{
    cx: number;
    cy: number;
    radius: number;
    layer: "back" | "front";
  }> = [];

  // 3 large background orbs
  for (let i = 0; i < 3; i++) {
    const r1 = seededRandom(i, seed);
    const r2 = seededRandom(i + 10, seed);
    const r3 = seededRandom(i + 20, seed);
    orbDefs.push({
      cx: startX + (0.1 + r1 * 0.8) * totalWidth,
      cy: baseY - (0.15 + r2 * 0.6) * height,
      radius: 80 + r3 * 50,
      layer: "back",
    });
  }

  // 5 smaller foreground orbs
  for (let i = 0; i < 5; i++) {
    const r1 = seededRandom(i + 40, seed);
    const r2 = seededRandom(i + 50, seed);
    const r3 = seededRandom(i + 60, seed);
    orbDefs.push({
      cx: startX + (0.05 + r1 * 0.9) * totalWidth,
      cy: baseY - (0.1 + r2 * 0.7) * height,
      radius: 25 + r3 * 35,
      layer: "front",
    });
  }

  const gradients: string[] = [];
  const backOrbs: string[] = [];
  const frontOrbs: string[] = [];

  for (let i = 0; i < orbDefs.length; i++) {
    const orb = orbDefs[i];
    const r4 = seededRandom(i + 70, seed);
    const r5 = seededRandom(i + 80, seed);
    const gradId = `orb${i}`;
    const isBack = orb.layer === "back";

    const innerColor = i % 3 === 0 ? accent : highlight;
    const midColor = i % 3 === 2 ? accent : highlight;

    gradients.push(
      `<radialGradient id="${gradId}">
        <stop offset="0%" stop-color="${innerColor}" stop-opacity="0.6" />
        <stop offset="40%" stop-color="${midColor}" stop-opacity="0.25" />
        <stop offset="100%" stop-color="${innerColor}" stop-opacity="0" />
      </radialGradient>`,
    );

    const target = isBack ? backOrbs : frontOrbs;

    if (isPlaying) {
      const duration = isBack ? 5 + r4 * 4 : 3 + r4 * 3;
      const offset = r5 * duration;
      const rMin = orb.radius * 0.8;
      const rMax = orb.radius * 1.2;
      const opMin = isBack ? 0.25 : 0.35;
      const opMax = isBack ? 0.6 : 0.75;
      // Build a long multi-waypoint wander path with large
      // displacement so orbs drift across the card slowly
      const range = isBack ? 250 : 160;
      const waypointCount = 8;
      const waypoints: string[] = ["0 0"];
      for (let w = 1; w <= waypointCount; w++) {
        const wx = (seededRandom(i * 10 + w, seed) - 0.5) * range;
        const wy = (seededRandom(i * 10 + w + 50, seed) - 0.5) *
          range * 0.6;
        waypoints.push(`${wx} ${wy}`);
      }
      waypoints.push("0 0");
      const wanderDur = isBack ? 40 + r4 * 30 : 30 + r4 * 20;

      target.push(
        `<circle cx="${orb.cx}" cy="${orb.cy}" r="${rMin}"
          fill="url(#${gradId})" opacity="${opMax}">
          <animate attributeName="r"
            values="${rMin};${rMax};${rMin}"
            dur="${duration}s" begin="-${offset}s"
            repeatCount="indefinite" />
          <animate attributeName="opacity"
            values="${opMax};${opMin};${opMax}"
            dur="${duration * 0.8}s" begin="-${offset}s"
            repeatCount="indefinite" />
          <animateTransform attributeName="transform"
            type="translate"
            values="${waypoints.join(";")}"
            dur="${wanderDur}s" begin="-${offset}s"
            repeatCount="indefinite" />
        </circle>`,
      );
    } else {
      const staticOpacity = isBack ? 0.35 : 0.45;
      target.push(
        `<circle cx="${orb.cx}" cy="${orb.cy}" r="${orb.radius}"
          fill="url(#${gradId})" opacity="${staticOpacity}" />`,
      );
    }
  }

  const defs = gradients.join("\n    ");

  const body = `
  <g clip-path="url(#cardClip)">
    ${backOrbs.join("\n    ")}
    ${frontOrbs.join("\n    ")}
  </g>`;

  return { defs, body };
}
