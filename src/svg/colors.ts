function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, "0")}${
    g.toString(16).padStart(2, "0")
  }${b.toString(16).padStart(2, "0")}`;
}

/**
 * Blend two hex colors by the given ratio.
 *
 * @param hexA Base color.
 * @param hexB Blend color.
 * @param ratio Blend ratio between 0 and 1.
 * @returns Mixed hex color.
 */
export function mixColors(hexA: string, hexB: string, ratio: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const clamp = (value: number): number => Math.max(0, Math.min(255, value));
  const r = clamp(Math.round(a.r * (1 - ratio) + b.r * ratio));
  const g = clamp(Math.round(a.g * (1 - ratio) + b.g * ratio));
  const bVal = clamp(Math.round(a.b * (1 - ratio) + b.b * ratio));
  return rgbToHex(r, g, bVal);
}
