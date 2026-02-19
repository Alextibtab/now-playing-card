import type { VisualOutput, VisualParams } from "./types.ts";

function seededRandom(index: number, seed: number): number {
  const value = Math.sin(index * 12.9898 + seed) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Floating particles — small circles that drift upward at varying
 * speeds and fade out as they rise.
 */
export function renderParticles(params: VisualParams): VisualOutput {
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

  const particleCount = 25;
  const totalWidth = endX - startX;
  const particles: string[] = [];

  for (let i = 0; i < particleCount; i++) {
    const r1 = seededRandom(i, seed);
    const r2 = seededRandom(i + 30, seed);
    const r3 = seededRandom(i + 60, seed);
    const r4 = seededRandom(i + 90, seed);

    const cx = startX + r1 * totalWidth;
    const cy = baseY - r2 * height * 0.3; // start near bottom
    const radius = 1.5 + r3 * 3.5;
    const color = i % 3 === 0 ? accent : highlight;
    const startOpacity = 0.2 + r4 * 0.5;
    const duration = 8 + r2 * 14;
    const drift = height * (0.6 + r3 * 0.4);
    // Slight horizontal sway
    const swayX = (r1 - 0.5) * 40;
    const delay = r4 * duration;

    if (isPlaying) {
      particles.push(
        `<circle cx="${cx}" cy="${cy}" r="${radius}"
          fill="${color}" opacity="${startOpacity}">
          <animateTransform attributeName="transform"
            type="translate"
            values="0 0;${swayX} -${drift};0 0"
            dur="${duration}s" begin="-${delay}s"
            repeatCount="indefinite" />
          <animate attributeName="opacity"
            values="${startOpacity};0.05;${startOpacity}"
            dur="${duration}s" begin="-${delay}s"
            repeatCount="indefinite" />
        </circle>`,
      );
    } else {
      // Paused: static particles at scattered positions
      const staticOpacity = startOpacity * 0.5;
      particles.push(
        `<circle cx="${cx}" cy="${cy - r2 * drift * 0.3}"
          r="${radius}" fill="${color}"
          opacity="${staticOpacity}" />`,
      );
    }
  }

  const body = `
  <g clip-path="url(#cardClip)">
    ${particles.join("\n    ")}
  </g>`;

  return { defs: "", body };
}
