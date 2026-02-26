/**
 * Render a music note placeholder inside the album art slot.
 *
 * @param albumX Left position of the album slot.
 * @param albumY Top position of the album slot.
 * @param albumSize Size of the album slot.
 * @param color Fill color for the icon.
 */
export function generateMusicNotePlaceholder(
  albumX: number,
  albumY: number,
  albumSize: number,
  color: string,
): string {
  const scale = albumSize / 100;
  const centerX = albumX + albumSize / 2;
  const centerY = albumY + albumSize / 2;
  const noteX = centerX - 25 * scale;
  const noteY = centerY - 30 * scale;

  return `<g transform="translate(${noteX}, ${noteY}) scale(${scale})" opacity="0.8">
    <!-- Music note (beamed eighth notes) -->
    <path d="M20 60 L20 15 L50 5 L50 50 C50 56 45 60 38 60 C30 60 25 56 25 50 C25 43 30 40 38 40 C42 40 45 41 47 43 L47 20 L23 28 L23 60 C23 66 18 70 10 70 C3 70 0 66 0 60 C0 53 5 50 10 50 C14 50 17 51 20 53 Z" fill="${color}"/>
  </g>`;
}
