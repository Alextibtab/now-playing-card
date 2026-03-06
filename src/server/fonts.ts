import { encodeBase64 } from "@std/encoding";

const FONT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const fontCache = new Map<string, {
  dataUrl: string;
  cssBlock: string;
  timestamp: number;
}>();

const FALLBACK_WEIGHTS = [400, 700, 300, 500, 600, 200, 100, 800, 900];

function buildGoogleFontsUrl(
  fontFamily: string,
  weight: number,
  text: string,
): string {
  const family = fontFamily.replace(/\s+/g, "+");
  const textParam = encodeURIComponent(text);
  return `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${textParam}&display=swap`;
}

async function fetchGoogleFontCss(url: string): Promise<string | null> {
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

function extractFontUrlFromCss(css: string): string | null {
  const urlMatch = css.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/);
  return urlMatch ? urlMatch[1] : null;
}

async function fetchFontFile(url: string): Promise<Uint8Array | null> {
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

function buildFontFaceCss(
  fontFamily: string,
  weight: number,
  dataUrl: string,
): string {
  return `@font-face {
  font-family: '${fontFamily}';
  src: url(${dataUrl}) format('woff2');
  font-weight: ${weight};
  font-style: normal;
  font-display: swap;
}`;
}

async function tryLoadFontWithWeight(
  fontFamily: string,
  weight: number,
  uniqueChars: string,
): Promise<{ dataUrl: string; cssBlock: string; weight: number } | null> {
  const googleFontsUrl = buildGoogleFontsUrl(fontFamily, weight, uniqueChars);
  const css = await fetchGoogleFontCss(googleFontsUrl);
  if (!css) {
    return null;
  }

  const fontUrl = extractFontUrlFromCss(css);
  if (!fontUrl) {
    return null;
  }

  const fontData = await fetchFontFile(fontUrl);
  if (!fontData) {
    return null;
  }

  const base64 = encodeBase64(fontData);
  const dataUrl = `data:font/woff2;base64,${base64}`;
  const cssBlock = buildFontFaceCss(fontFamily, weight, dataUrl);

  return { dataUrl, cssBlock, weight };
}

export async function loadGoogleFont(
  fontFamily: string,
  weight: number,
  text: string,
): Promise<{ dataUrl: string; cssBlock: string; actualWeight: number } | null> {
  if (!fontFamily || !text) {
    return null;
  }

  const uniqueChars = [...new Set(text)].sort().join("");
  const cacheKey = `${fontFamily}:${weight}:${uniqueChars}`;

  const cached = fontCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < FONT_CACHE_TTL_MS) {
    return { ...cached, actualWeight: weight };
  }

  const weightsToTry = [
    weight,
    ...FALLBACK_WEIGHTS.filter((w) => w !== weight),
  ];

  for (const tryWeight of weightsToTry) {
    const result = await tryLoadFontWithWeight(
      fontFamily,
      tryWeight,
      uniqueChars,
    );
    if (result) {
      if (tryWeight !== weight) {
        console.warn(
          `Font "${fontFamily}" weight ${weight} not available, using weight ${tryWeight} instead`,
        );
      }
      const cacheResult = {
        dataUrl: result.dataUrl,
        cssBlock: result.cssBlock,
      };
      fontCache.set(cacheKey, { ...cacheResult, timestamp: Date.now() });
      return { ...cacheResult, actualWeight: tryWeight };
    }
  }

  console.warn(
    `Failed to load font "${fontFamily}" - no available weights found`,
  );
  return null;
}
