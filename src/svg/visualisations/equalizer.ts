import type { VisualOutput, VisualParams } from "./types.ts";

function seededRandom(index: number, seed: number): number {
  const value = Math.sin(index * 12.9898 + seed) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Classic equalizer bars — vertical rectangles animating at
 * staggered heights and durations.
 */
export function renderEqualizer(params: VisualParams): VisualOutput {
  const {
    startX,
    endX,
    baseY,
    height,
    seed,
    isPlaying,
  } = params;

  const barCount = 20;
  const gap = 4;
  const totalWidth = endX - startX;
  const barWidth = (totalWidth - gap * (barCount - 1)) / barCount;
  const minHeight = height * 0.08;
  const maxHeight = height * 0.85;

  const bars: string[] = [];

  for (let i = 0; i < barCount; i++) {
    const rand = seededRandom(i, seed);
    const rand2 = seededRandom(i + 50, seed);
    const rand3 = seededRandom(i + 100, seed);

    const x = startX + i * (barWidth + gap);
    const h1 = minHeight + rand * (maxHeight - minHeight);
    const h2 = minHeight + rand2 * (maxHeight - minHeight) * 0.6;
    const h3 = minHeight + rand3 * (maxHeight - minHeight) * 0.8;

    const y1 = baseY - h1;
    const y2 = baseY - h2;
    const y3 = baseY - h3;

    // Duration varies per bar for organic feel
    const duration = 2.5 + rand * 3.5;

    if (isPlaying) {
      bars.push(
        `<rect x="${x}" width="${barWidth}" rx="2"
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
      const staticH = minHeight + rand * (maxHeight * 0.35 - minHeight);
      const staticY = baseY - staticH;
      bars.push(
        `<rect x="${x}" y="${staticY}" width="${barWidth}" height="${staticH}" rx="2" />`,
      );
    }
  }

  const body = `
  <g fill="url(#visFade)" opacity="0.5" clip-path="url(#cardClip)">
    ${bars.join("\n    ")}
  </g>`;

  return { defs: "", body };
}
