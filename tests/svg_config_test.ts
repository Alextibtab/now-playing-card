import { assertEquals } from "@std/assert";
import { compute_colors, compute_playback_state } from "../src/svg/config.ts";
import { parse_idle_text } from "../src/server/config.ts";
import { is_svg_config } from "../src/server/themes.ts";

// Simple mix_colors stub: ratio=0 -> color1, ratio=1 -> color2
function mix_colors(a: string, _b: string, _ratio: number): string {
  return a;
}

const ALBUM_COLORS = {
  dominant: "#112233",
  accent: "#445566",
  highlight: "#aabbcc",
};

const BASE_CONFIG = {
  text_primary: "#ffffff",
  text_secondary: "#cccccc",
  text_muted: "#888888",
};

Deno.test("compute_colors: no overrides, no album art — uses fallbacks", () => {
  const result = compute_colors(null, BASE_CONFIG, mix_colors);
  assertEquals(result.dominant_color, "#27272a");
  assertEquals(result.accent_color, "#22c55e");
  // highlight fallback = mix(accent, #ffffff, 0.45) = accent via stub
  assertEquals(result.highlight, "#22c55e");
});

Deno.test("compute_colors: no overrides, album art provided — uses album art", () => {
  const result = compute_colors(
    { colors: ALBUM_COLORS },
    BASE_CONFIG,
    mix_colors,
  );
  assertEquals(result.dominant_color, "#112233");
  assertEquals(result.accent_color, "#445566");
  assertEquals(result.highlight, "#aabbcc");
});

Deno.test("compute_colors: config overrides win over album art", () => {
  const config = {
    ...BASE_CONFIG,
    highlight: "#ff79c6",
    accent: "#bd93f9",
    dominant: "#44475a",
  };
  const result = compute_colors(
    { colors: ALBUM_COLORS },
    config,
    mix_colors,
  );
  assertEquals(result.dominant_color, "#44475a");
  assertEquals(result.accent_color, "#bd93f9");
  assertEquals(result.highlight, "#ff79c6");
});

Deno.test("compute_colors: config overrides win when no album art", () => {
  const config = {
    ...BASE_CONFIG,
    highlight: "#88c0d0",
    accent: "#81a1c1",
    dominant: "#434c5e",
  };
  const result = compute_colors(null, config, mix_colors);
  assertEquals(result.dominant_color, "#434c5e");
  assertEquals(result.accent_color, "#81a1c1");
  assertEquals(result.highlight, "#88c0d0");
});

Deno.test("compute_colors: partial override — only highlight set", () => {
  const config = {
    ...BASE_CONFIG,
    highlight: "#fabd2f",
  };
  const result = compute_colors(
    { colors: ALBUM_COLORS },
    config,
    mix_colors,
  );
  // highlight from config
  assertEquals(result.highlight, "#fabd2f");
  // accent and dominant still from album art
  assertEquals(result.accent_color, "#445566");
  assertEquals(result.dominant_color, "#112233");
});

Deno.test("compute_colors: partial override — only accent set", () => {
  const config = {
    ...BASE_CONFIG,
    accent: "#fe8019",
  };
  const result = compute_colors(
    { colors: ALBUM_COLORS },
    config,
    mix_colors,
  );
  assertEquals(result.accent_color, "#fe8019");
  assertEquals(result.highlight, "#aabbcc");
  assertEquals(result.dominant_color, "#112233");
});

Deno.test("compute_colors: partial override — only dominant set", () => {
  const config = {
    ...BASE_CONFIG,
    dominant: "#44475a",
  };
  const result = compute_colors(
    { colors: ALBUM_COLORS },
    config,
    mix_colors,
  );
  assertEquals(result.dominant_color, "#44475a");
  // accent and highlight still from album art
  assertEquals(result.accent_color, "#445566");
  assertEquals(result.highlight, "#aabbcc");
});

Deno.test("compute_colors: dominant override feeds base_dark when no card_background", () => {
  const config = {
    ...BASE_CONFIG,
    dominant: "#8b0000",
  };
  const result = compute_colors(null, config, mix_colors);
  // With stub mix returning first arg, base_dark = mix(dominant, ...) = dominant
  assertEquals(result.dominant_color, "#8b0000");
  // base_dark derived from overridden dominant (not fallback #27272a)
  assertEquals(result.base_dark, "#8b0000");
});

Deno.test("compute_colors: card_background takes precedence over dominant for base_dark", () => {
  const config = {
    ...BASE_CONFIG,
    dominant: "#8b0000",
    card_background: "#1e1e2e",
  };
  const result = compute_colors(null, config, mix_colors);
  // card_background overrides background derivation entirely
  assertEquals(result.base_dark, "#1e1e2e");
  // dominant still applies to dominant_color itself
  assertEquals(result.dominant_color, "#8b0000");
});

Deno.test("compute_colors: text colors always from config", () => {
  const config = {
    ...BASE_CONFIG,
    highlight: "#ff79c6",
    accent: "#bd93f9",
    dominant: "#44475a",
  };
  const result = compute_colors(
    { colors: ALBUM_COLORS },
    config,
    mix_colors,
  );
  assertEquals(result.text_primary, "#ffffff");
  assertEquals(result.text_secondary, "#cccccc");
  assertEquals(result.text_muted, "#888888");
});

// ---- compute_playback_state ----

Deno.test("compute_playback_state: playing -> NOW PLAYING", () => {
  const result = compute_playback_state({
    status: "playing",
    updated_at: Date.now(),
  });
  assertEquals(result.is_playing, true);
  assertEquals(result.status_label, "NOW PLAYING");
});

Deno.test("compute_playback_state: last-played -> default idle label", () => {
  const result = compute_playback_state({
    status: "last-played",
    updated_at: Date.now(),
  });
  assertEquals(result.is_playing, false);
  assertEquals(result.is_last_played, true);
  assertEquals(result.status_label, "LAST PLAYED");
});

Deno.test("compute_playback_state: last-played -> custom idle label", () => {
  const result = compute_playback_state(
    { status: "last-played", updated_at: Date.now() },
    "CHECKED OUT",
  );
  assertEquals(result.is_playing, false);
  assertEquals(result.is_last_played, true);
  assertEquals(result.status_label, "CHECKED OUT");
});

Deno.test("compute_playback_state: stale playing -> custom idle label", () => {
  const stale = Date.now() - 6 * 60 * 1000; // older than 5-min threshold
  const result = compute_playback_state(
    { status: "playing", updated_at: stale },
    "GONE",
  );
  assertEquals(result.is_playing, false);
  assertEquals(result.is_last_played, true);
  assertEquals(result.status_label, "GONE");
});

Deno.test("compute_playback_state: playing ignores idle_text", () => {
  const result = compute_playback_state(
    { status: "playing", updated_at: Date.now() },
    "IGNORED",
  );
  assertEquals(result.is_playing, true);
  assertEquals(result.status_label, "NOW PLAYING");
});

Deno.test("compute_playback_state: empty idle_text falls back to default", () => {
  const result = compute_playback_state(
    { status: "last-played", updated_at: Date.now() },
    "",
  );
  assertEquals(result.status_label, "LAST PLAYED");
});

// ---- parse_idle_text ----

Deno.test("parse_idle_text: normal value", () => {
  assertEquals(parse_idle_text("CHECKED OUT"), "CHECKED OUT");
});

Deno.test("parse_idle_text: trimmed", () => {
  assertEquals(parse_idle_text("  PAUSED  "), "PAUSED");
});

Deno.test("parse_idle_text: empty -> undefined", () => {
  assertEquals(parse_idle_text(""), undefined);
  assertEquals(parse_idle_text("   "), undefined);
});

Deno.test("parse_idle_text: null -> undefined", () => {
  assertEquals(parse_idle_text(null), undefined);
});

Deno.test("parse_idle_text: too long -> undefined", () => {
  const long = "x".repeat(31);
  assertEquals(parse_idle_text(long), undefined);
});

Deno.test("parse_idle_text: max length ok", () => {
  const max = "x".repeat(30);
  assertEquals(parse_idle_text(max), max);
});

Deno.test("parse_idle_text: control chars stripped", () => {
  const input = "PLAY\x00ING\n";
  assertEquals(parse_idle_text(input), "PLAYING");
});

// ---- is_svg_config: idle_text validation ----

const VALID_THEME = {
  width: 800,
  height: 200,
  text_primary: "#fafafa",
  text_secondary: "#cbd5e1",
  text_muted: "#94a3b8",
  album_size: 150,
  border_radius: 16,
  album_position: "left",
  text_align: "left",
  show_status: true,
  show_title: true,
  show_artist: true,
  show_album: true,
  font_title_family: "DotGothic16",
  font_body_family: "Space Mono",
  font_title_weight: 400,
  font_body_weight: 400,
  font_fallback: "'Segoe UI', sans-serif",
  visualisation: "waveform",
};

Deno.test("is_svg_config: idle_text omitted -> valid", () => {
  const theme = { ...VALID_THEME };
  assertEquals(is_svg_config(theme), true);
});

Deno.test("is_svg_config: idle_text within length cap -> valid", () => {
  const theme = { ...VALID_THEME, idle_text: "RECENTLY PLAYED" };
  assertEquals(is_svg_config(theme), true);
});

Deno.test("is_svg_config: idle_text at max length -> valid", () => {
  const theme = { ...VALID_THEME, idle_text: "x".repeat(30) };
  assertEquals(is_svg_config(theme), true);
});

Deno.test("is_svg_config: idle_text over length cap -> invalid", () => {
  const theme = { ...VALID_THEME, idle_text: "x".repeat(31) };
  assertEquals(is_svg_config(theme), false);
});

Deno.test("is_svg_config: idle_text empty string -> invalid", () => {
  const theme = { ...VALID_THEME, idle_text: "" };
  assertEquals(is_svg_config(theme), false);
});
