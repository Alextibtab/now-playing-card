function hex_to_rgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return { r, g, b };
}

function rgb_to_hex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, "0")}${
    g.toString(16).padStart(2, "0")
  }${b.toString(16).padStart(2, "0")}`;
}

/**
 * Blend two hex colors by the given ratio.
 *
 * @param hex_a Base color.
 * @param hex_b Blend color.
 * @param ratio Blend ratio between 0 and 1.
 * @returns Mixed hex color.
 */
export function mix_colors(
  hex_a: string,
  hex_b: string,
  ratio: number,
): string {
  const a = hex_to_rgb(hex_a);
  const b = hex_to_rgb(hex_b);
  const clamp = (value: number): number => Math.max(0, Math.min(255, value));
  const r = clamp(Math.round(a.r * (1 - ratio) + b.r * ratio));
  const g = clamp(Math.round(a.g * (1 - ratio) + b.g * ratio));
  const b_val = clamp(Math.round(a.b * (1 - ratio) + b.b * ratio));
  return rgb_to_hex(r, g, b_val);
}
