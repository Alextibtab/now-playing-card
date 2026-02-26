function seededRandom(index: number, seed: number): number {
  const value = Math.sin(index * 12.9898 + seed) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Produce a stable numeric seed from a string.
 *
 * @param input Source string.
 * @returns Non-negative integer seed.
 */
export function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function generateWavePath(
  startX: number,
  endX: number,
  baseY: number,
  height: number,
  points: number,
  seed: number,
): string {
  const step = (endX - startX) / (points - 1);
  const values = Array.from({ length: points }, (_, i) => {
    const rand = seededRandom(i, seed) * 0.75 +
      seededRandom(i + 7, seed) * 0.25;
    return {
      x: startX + i * step,
      y: baseY - rand * height,
    };
  });

  let path = `M ${values[0].x} ${values[0].y}`;
  for (let i = 1; i < values.length - 1; i++) {
    const prev = values[i - 1];
    const current = values[i];
    const midX = (prev.x + current.x) / 2;
    const midY = (prev.y + current.y) / 2;
    path += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`;
  }
  const last = values[values.length - 1];
  const secondLast = values[values.length - 2];
  path += ` Q ${secondLast.x} ${secondLast.y} ${last.x} ${last.y}`;
  path += ` L ${endX} ${baseY} L ${startX} ${baseY} Z`;
  return path;
}

/**
 * Build a looping waveform path layer.
 *
 * @param color Fill color.
 * @param opacity Layer opacity.
 * @param startX Wave start position.
 * @param endX Wave end position.
 * @param baseY Baseline Y position.
 * @param height Wave height.
 * @param seed Random seed.
 * @param duration Animation duration in seconds.
 * @returns SVG path markup.
 */
export function generateWaveformLayer(
  color: string,
  opacity: number,
  startX: number,
  endX: number,
  baseY: number,
  height: number,
  seed: number,
  duration: number,
  animate = true,
): string {
  const pathA = generateWavePath(startX, endX, baseY, height, 12, seed);
  if (!animate) {
    return `<path d="${pathA}" fill="${color}" opacity="${opacity}" />`;
  }
  const pathB = generateWavePath(startX, endX, baseY, height, 12, seed + 8.5);
  return `<path d="${pathA}" fill="${color}" opacity="${opacity}">
    <animate attributeName="d" values="${pathA};${pathB};${pathA}" dur="${duration}s" repeatCount="indefinite" />
  </path>`;
}
