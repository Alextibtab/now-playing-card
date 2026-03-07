/**
 * Render a music note placeholder inside the album art slot.
 *
 * @param album_x Left position of the album slot.
 * @param album_y Top position of the album slot.
 * @param album_size Size of the album slot.
 * @param color Fill color for the icon.
 */
export function generate_music_note_placeholder(
  album_x: number,
  album_y: number,
  album_size: number,
  color: string,
): string {
  const scale = album_size / 100;
  const center_x = album_x + album_size / 2;
  const center_y = album_y + album_size / 2;
  const note_x = center_x - 25 * scale;
  const note_y = center_y - 30 * scale;

  return `<g transform="translate(${note_x}, ${note_y}) scale(${scale})" opacity="0.8">
    <!-- Music note (beamed eighth notes) -->
    <path d="M20 60 L20 15 L50 5 L50 50 C50 56 45 60 38 60 C30 60 25 56 25 50 C25 43 30 40 38 40 C42 40 45 41 47 43 L47 20 L23 28 L23 60 C23 66 18 70 10 70 C3 70 0 66 0 60 C0 53 5 50 10 50 C14 50 17 51 20 53 Z" fill="${color}"/>
  </g>`;
}
