import { encodeBase64 } from "@std/encoding";

const FONT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_SIZE = 50;
const font_cache = new Map<string, {
  data_url: string;
  css_block: string;
  timestamp: number;
}>();

const FALLBACK_WEIGHTS = [400, 700, 300, 500, 600, 200, 100, 800, 900];

function cleanup_cache(): void {
  const now = Date.now();

  for (const [key, entry] of font_cache.entries()) {
    if (now - entry.timestamp > FONT_CACHE_TTL_MS) {
      font_cache.delete(key);
    }
  }

  if (font_cache.size <= MAX_CACHE_SIZE) {
    return;
  }

  const entries = Array.from(font_cache.entries());
  entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

  const entries_to_remove = entries.slice(0, font_cache.size - MAX_CACHE_SIZE);
  for (const [key] of entries_to_remove) {
    font_cache.delete(key);
  }
}

function build_google_fonts_url(
  font_family: string,
  weight: number,
  text: string,
): string {
  const family = font_family.replace(/\s+/g, "+");
  const text_param = encodeURIComponent(text);
  return `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${text_param}&display=swap`;
}

async function fetch_google_font_css(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    if (!response.ok) {
      return null;
    }
    const text = await response.text();
    if (
      text.includes("<!DOCTYPE html>") || text.includes("Font family not found")
    ) {
      return null;
    }
    return text;
  } catch (error) {
    console.warn(`Failed to fetch Google Fonts CSS:`, error);
    return null;
  }
}

function extract_font_url_from_css(css: string): string | null {
  const url_match = css.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/);
  return url_match ? url_match[1] : null;
}

async function fetch_font_file(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch font file: ${response.status}`);
      return null;
    }
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    console.warn(`Failed to fetch font file:`, error);
    return null;
  }
}

function build_font_face_css(
  font_family: string,
  weight: number,
  data_url: string,
): string {
  return `@font-face {
  font-family: '${font_family}';
  src: url(${data_url}) format('woff2');
  font-weight: ${weight};
  font-style: normal;
  font-display: swap;
}`;
}

async function try_load_font_with_weight(
  font_family: string,
  weight: number,
  unique_chars: string,
): Promise<{ data_url: string; css_block: string; weight: number } | null> {
  const google_fonts_url = build_google_fonts_url(
    font_family,
    weight,
    unique_chars,
  );
  const css = await fetch_google_font_css(google_fonts_url);
  if (!css) {
    return null;
  }

  const font_url = extract_font_url_from_css(css);
  if (!font_url) {
    return null;
  }

  const font_data = await fetch_font_file(font_url);
  if (!font_data) {
    return null;
  }

  const base64 = encodeBase64(font_data);
  const data_url = `data:font/woff2;base64,${base64}`;
  const css_block = build_font_face_css(font_family, weight, data_url);

  return { data_url, css_block, weight };
}

export async function load_google_font(
  font_family: string,
  weight: number,
  text: string,
): Promise<
  { data_url: string; css_block: string; actual_weight: number } | null
> {
  if (!font_family || !text) {
    return null;
  }

  const unique_chars = [...new Set(text)].sort().join("");
  const cache_key = `${font_family}:${weight}:${unique_chars}`;

  const cached = font_cache.get(cache_key);
  if (cached && Date.now() - cached.timestamp < FONT_CACHE_TTL_MS) {
    return { ...cached, actual_weight: weight };
  }

  const weights_to_try = [
    weight,
    ...FALLBACK_WEIGHTS.filter((w) => w !== weight),
  ];

  for (const try_weight of weights_to_try) {
    const result = await try_load_font_with_weight(
      font_family,
      try_weight,
      unique_chars,
    );
    if (result) {
      if (try_weight !== weight) {
        console.warn(
          `Font "${font_family}" weight ${weight} not available, using weight ${try_weight} instead`,
        );
      }
      const cache_result = {
        data_url: result.data_url,
        css_block: result.css_block,
      };
      cleanup_cache();
      font_cache.set(cache_key, { ...cache_result, timestamp: Date.now() });
      return { ...cache_result, actual_weight: try_weight };
    }
  }

  console.warn(
    `Failed to load font "${font_family}" - no available weights found`,
  );
  return null;
}
