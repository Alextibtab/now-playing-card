/**
 * Escape special characters for XML/SVG.
 *
 * @param text Raw text content.
 * @returns Escaped text safe for SVG.
 */
export function escapeXml(text: string): string {
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
 * @param maxLength Maximum number of characters.
 * @returns Truncated text with ellipsis when needed.
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Estimate text width for layout calculations.
 *
 * @param text Input text.
 * @param fontSize Font size in pixels.
 * @returns Estimated width in pixels.
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * (fontSize * 0.55);
}
