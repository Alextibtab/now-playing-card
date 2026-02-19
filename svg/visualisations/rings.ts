import type { VisualOutput, VisualParams } from "./types.ts";

function seededRandom(index: number, seed: number): number {
  const value = Math.sin(index * 12.9898 + seed) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Pulsing rings — concentric circles that expand outward from the
 * bottom-center of the card, fading as they grow.
 */
export function renderRings(params: VisualParams): VisualOutput {
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

  const cx = (startX + endX) / 2;
  const cy = baseY;
  const ringCount = 5;
  const maxRadius = Math.max(endX - startX, height) * 0.6;
  const minRadius = 8;

  const rings: string[] = [];

  for (let i = 0; i < ringCount; i++) {
    const rand = seededRandom(i, seed);
    const duration = 6 + rand * 6;
    const delay = (i / ringCount) * duration;
    const strokeWidth = 2 + rand * 2;
    const color = i % 2 === 0 ? highlight : accent;

    if (isPlaying) {
      rings.push(
        `<circle cx="${cx}" cy="${cy}" r="${minRadius}"
          fill="none" stroke="${color}"
          stroke-width="${strokeWidth}" opacity="0">
          <animate attributeName="r"
            values="${minRadius};${maxRadius}"
            dur="${duration}s" begin="${delay}s"
            repeatCount="indefinite" />
          <animate attributeName="opacity"
            values="0.6;0.0"
            dur="${duration}s" begin="${delay}s"
            repeatCount="indefinite" />
        </circle>`,
      );
    } else {
      // Paused: static rings at varying radii
      const staticR = minRadius +
        (i + 1) / ringCount * (maxRadius * 0.5 - minRadius);
      const opacity = 0.3 - (i / ringCount) * 0.2;
      rings.push(
        `<circle cx="${cx}" cy="${cy}" r="${staticR}"
          fill="none" stroke="${color}"
          stroke-width="${strokeWidth}" opacity="${opacity}" />`,
      );
    }
  }

  const body = `
  <g clip-path="url(#cardClip)">
    ${rings.join("\n    ")}
  </g>`;

  return { defs: "", body };
}
