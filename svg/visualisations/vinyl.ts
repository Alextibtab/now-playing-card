import type { VisualOutput, VisualParams } from "./types.ts";

function seededRandom(index: number, seed: number): number {
  const value = Math.sin(index * 12.9898 + seed) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Spinning vinyl — concentric groove arcs arranged in a circle,
 * rotating as a group. Creates a subtle record texture effect.
 */
export function renderVinyl(params: VisualParams): VisualOutput {
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
  const cy = baseY - height * 0.45;
  const maxRadius = Math.min(
    (endX - startX) / 2,
    height * 0.55,
  );
  const grooveCount = 12;
  const innerRadius = maxRadius * 0.15;
  const grooves: string[] = [];

  for (let i = 0; i < grooveCount; i++) {
    const rand = seededRandom(i, seed);
    const r = innerRadius +
      ((i + 1) / grooveCount) * (maxRadius - innerRadius);
    const strokeWidth = 1 + rand * 1.5;
    const opacity = 0.1 + rand * 0.2;
    const color = i % 3 === 0 ? accent : highlight;

    // Each groove is a nearly-complete circle arc (with a small
    // gap so it reads as grooves rather than solid circles).
    const gapAngle = 10 + rand * 30; // degrees
    const startAngle = rand * 360;
    const endAngle = startAngle + 360 - gapAngle;

    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startAngle));
    const y1 = cy + r * Math.sin(toRad(startAngle));
    const x2 = cx + r * Math.cos(toRad(endAngle));
    const y2 = cy + r * Math.sin(toRad(endAngle));
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;

    grooves.push(
      `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}"
        fill="none" stroke="${color}"
        stroke-width="${strokeWidth}" opacity="${opacity}" />`,
    );
  }

  // Center dot
  grooves.push(
    `<circle cx="${cx}" cy="${cy}" r="${innerRadius * 0.6}"
      fill="${highlight}" opacity="0.3" />`,
  );

  const rotDuration = 20;

  const defs = `
    <clipPath id="vinylClip" clipPathUnits="userSpaceOnUse">
      <circle cx="${cx}" cy="${cy}" r="${maxRadius}" />
    </clipPath>`;

  let body: string;
  if (isPlaying) {
    body = `
  <g clip-path="url(#cardClip)">
    <g clip-path="url(#vinylClip)">
      <g>
        ${grooves.join("\n        ")}
        <animateTransform attributeName="transform"
          type="rotate"
          from="0 ${cx} ${cy}" to="360 ${cx} ${cy}"
          dur="${rotDuration}s"
          repeatCount="indefinite" />
      </g>
    </g>
  </g>`;
  } else {
    body = `
  <g clip-path="url(#cardClip)">
    <g clip-path="url(#vinylClip)">
      ${grooves.join("\n      ")}
    </g>
  </g>`;
  }

  return { defs, body };
}
