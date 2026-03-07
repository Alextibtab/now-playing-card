/**
 * Escape special characters for XML/SVG.
 *
 * @param text Raw text content.
 * @returns Escaped text safe for SVG.
 */
export function escape_xml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Truncate text to a fixed maximum length.
 *
 * @param text Input text.
 * @param max_length Maximum number of characters.
 * @returns Truncated text with ellipsis when needed.
 */
export function truncate_text(text: string, max_length: number): string {
  if (text.length <= max_length) return text;
  return text.substring(0, max_length - 3) + "...";
}

/**
 * Estimate text width for layout calculations.
 *
 * @param text Input text.
 * @param font_size Font size in pixels.
 * @returns Estimated width in pixels.
 */
export function estimate_text_width(text: string, font_size: number): number {
  return text.length * (font_size * 0.55);
}
