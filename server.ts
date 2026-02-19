import {
  defaultSvgConfig,
  NowPlayingData,
  SvgConfig,
  VISUALISATION_TYPES,
  VisualisationType,
} from "./types.ts";
import { generateNowPlayingSvg } from "./svg.ts";

const API_KEY = Deno.env.get("API_KEY");
if (!API_KEY) {
  console.error("API_KEY environment variable is required");
  Deno.exit(1);
}

const KV_KEY = ["now-playing"];
const THEME_NAME_PATTERN = /^[a-z0-9_-]+$/i;
const FONT_FILE_PATTERN = /^[a-z0-9._-]+$/i;
const FONT_FAMILY_PATTERN = /^[a-z0-9 _-]+$/i;
const themeCache = new Map<string, SvgConfig>();
const fontCache = new Map<string, { dataUrl: string; format: string }>();

function validateAuth(req: Request): boolean {
  const auth = req.headers.get("Authorization");
  if (!auth) return false;
  const parts = auth.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return false;
  return parts[1] === API_KEY;
}

async function storeNowPlaying(
  kv: Deno.Kv,
  data: NowPlayingData,
): Promise<void> {
  await kv.set(KV_KEY, data);
}

async function getNowPlaying(kv: Deno.Kv): Promise<NowPlayingData | null> {
  const result = await kv.get<NowPlayingData>(KV_KEY);
  return result.value;
}

async function handlePostNowPlaying(
  req: Request,
  kv: Deno.Kv,
): Promise<Response> {
  if (!validateAuth(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const text = await req.text();
    console.log(`Received POST: ${text.length} chars`);
    const data = JSON.parse(text) as NowPlayingData;
    await storeNowPlaying(kv, data);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("JSON parse error:", error);
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}

function isSvgConfig(value: unknown): value is SvgConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as Record<string, unknown>;
  const isNumber = (input: unknown): input is number =>
    typeof input === "number" && Number.isFinite(input);
  const isString = (input: unknown): input is string =>
    typeof input === "string" && input.length > 0;
  const isBoolean = (input: unknown): input is boolean =>
    typeof input === "boolean";
  const albumPosition = config.albumPosition;
  const textAlign = config.textAlign;
  return isNumber(config.width) &&
    isNumber(config.height) &&
    isString(config.cardBackground) &&
    isString(config.cardBorder) &&
    isString(config.textPrimary) &&
    isString(config.textSecondary) &&
    isString(config.textMuted) &&
    isNumber(config.albumSize) &&
    isNumber(config.borderRadius) &&
    (albumPosition === "left" || albumPosition === "right") &&
    (textAlign === "left" || textAlign === "center" ||
      textAlign === "right") &&
    isBoolean(config.showStatus) &&
    isBoolean(config.showTitle) &&
    isBoolean(config.showArtist) &&
    isBoolean(config.showAlbum) &&
    isString(config.fontTitleFamily) &&
    isString(config.fontBodyFamily) &&
    isString(config.fontTitleFile) &&
    isString(config.fontBodyFile) &&
    isString(config.fontFallback) &&
    (config.visualisation === undefined ||
      VISUALISATION_TYPES.includes(
        config.visualisation as VisualisationType,
      ));
}

function getFontFormat(fileName: string): string | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".woff2")) return "woff2";
  if (lower.endsWith(".woff")) return "woff";
  if (lower.endsWith(".ttf")) return "truetype";
  if (lower.endsWith(".otf")) return "opentype";
  return null;
}

async function loadFontData(
  fileName: string,
): Promise<{ dataUrl: string; format: string } | null> {
  if (!FONT_FILE_PATTERN.test(fileName)) {
    return null;
  }
  if (fontCache.has(fileName)) {
    return fontCache.get(fileName) ?? null;
  }
  const format = getFontFormat(fileName);
  if (!format) return null;
  try {
    const fontUrl = new URL(`./fonts/${fileName}`, import.meta.url);
    const data = await Deno.readFile(fontUrl);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binary);
    const mime = format === "woff2"
      ? "font/woff2"
      : format === "woff"
      ? "font/woff"
      : format === "truetype"
      ? "font/ttf"
      : "font/otf";
    const dataUrl = `data:${mime};base64,${base64}`;
    const entry = { dataUrl, format };
    fontCache.set(fileName, entry);
    return entry;
  } catch (error) {
    console.warn(`Failed to load font: ${fileName}`, error);
    return null;
  }
}

function parseBooleanParam(value: string | null): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true") return true;
  if (normalized === "0" || normalized === "false") return false;
  return undefined;
}

function parseTextAlign(
  value: string | null,
): "left" | "center" | "right" | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "left") return "left";
  if (normalized === "right") return "right";
  if (normalized === "center" || normalized === "centre") return "center";
  return undefined;
}

function inferFontFamily(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "");
  return base.replace(/[_-]+/g, " ").trim() || base;
}

function parseFontFile(value: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  if (!normalized || !FONT_FILE_PATTERN.test(normalized)) return undefined;
  return normalized;
}

function parseFontFamily(value: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  if (!normalized || !FONT_FAMILY_PATTERN.test(normalized)) return undefined;
  return normalized;
}

async function loadTheme(name: string): Promise<SvgConfig | null> {
  if (themeCache.has(name)) {
    return themeCache.get(name) ?? null;
  }

  if (!THEME_NAME_PATTERN.test(name)) {
    return null;
  }

  try {
    const themeUrl = new URL(`./themes/${name}.json`, import.meta.url);
    const raw = await Deno.readTextFile(themeUrl);
    const parsed = JSON.parse(raw);
    if (!isSvgConfig(parsed)) {
      console.warn(`Theme schema invalid: ${name}`);
      return null;
    }
    themeCache.set(name, parsed);
    return parsed;
  } catch (error) {
    console.warn(`Failed to load theme: ${name}`, error);
    return null;
  }
}

async function buildSvgConfig(params: URLSearchParams): Promise<SvgConfig> {
  const themeParam = params.get("theme") || "default";
  const themeName = THEME_NAME_PATTERN.test(themeParam)
    ? themeParam
    : "default";
  const theme = await loadTheme(themeName);
  const position = params.get("position");
  const albumPosition = position === "right"
    ? "right"
    : position === "left"
    ? "left"
    : undefined;
  const textAlign = parseTextAlign(params.get("align"));
  const showStatus = parseBooleanParam(params.get("showStatus"));
  const showTitle = parseBooleanParam(params.get("showTitle"));
  const showArtist = parseBooleanParam(params.get("showArtist"));
  const showAlbum = parseBooleanParam(params.get("showAlbum"));
  const visParam = params.get("vis");
  const visualisation = visParam &&
      VISUALISATION_TYPES.includes(visParam as VisualisationType)
    ? visParam as VisualisationType
    : undefined;
  const fontTitleFile = parseFontFile(params.get("fontTitle"));
  const fontBodyFile = parseFontFile(params.get("fontBody"));
  const fontTitleFamilyParam = parseFontFamily(params.get("fontTitleFamily"));
  const fontBodyFamilyParam = parseFontFamily(params.get("fontBodyFamily"));
  const fontTitleFamily = fontTitleFamilyParam ||
    (fontTitleFile ? inferFontFamily(fontTitleFile) : undefined);
  const fontBodyFamily = fontBodyFamilyParam ||
    (fontBodyFile ? inferFontFamily(fontBodyFile) : undefined);
  const baseConfig: SvgConfig = {
    ...defaultSvgConfig,
    ...(theme || {}),
    ...(albumPosition ? { albumPosition } : {}),
    ...(textAlign ? { textAlign } : {}),
    ...(showStatus !== undefined ? { showStatus } : {}),
    ...(showTitle !== undefined ? { showTitle } : {}),
    ...(showArtist !== undefined ? { showArtist } : {}),
    ...(showAlbum !== undefined ? { showAlbum } : {}),
    ...(visualisation ? { visualisation } : {}),
    ...(fontTitleFile ? { fontTitleFile } : {}),
    ...(fontBodyFile ? { fontBodyFile } : {}),
    ...(fontTitleFamily ? { fontTitleFamily } : {}),
    ...(fontBodyFamily ? { fontBodyFamily } : {}),
  };
  const titleFont = await loadFontData(baseConfig.fontTitleFile);
  const bodyFont = await loadFontData(baseConfig.fontBodyFile);
  return {
    ...baseConfig,
    fontTitleDataUrl: titleFont?.dataUrl,
    fontBodyDataUrl: bodyFont?.dataUrl,
    fontTitleFormat: titleFont?.format,
    fontBodyFormat: bodyFont?.format,
  };
}

async function handleGetSvg(req: Request, kv: Deno.Kv): Promise<Response> {
  const data = await getNowPlaying(kv);
  const params = new URL(req.url).searchParams;
  const config = await buildSvgConfig(params);
  const svg = generateNowPlayingSvg(data, config);

  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "s-maxage=1",
    },
  });
}

async function handleGetNowPlaying(kv: Deno.Kv): Promise<Response> {
  const data = await getNowPlaying(kv);
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
  });
}

function handleGetPreview(req: Request): Response {
  const params = new URL(req.url).searchParams;

  // Forward any extra query params (theme, fonts, etc.) to each SVG src
  const extraParams = new URLSearchParams(params);
  extraParams.delete("vis");
  const extraStr = extraParams.toString();
  const suffix = extraStr ? `&${extraStr}` : "";

  const widgets = VISUALISATION_TYPES.map(
    (vis) =>
      `<div class="widget-section">
        <h2>${vis}</h2>
        <div class="widget">
          <img src="/now-playing.svg?vis=${vis}${suffix}" alt="${vis} visualisation" />
        </div>
      </div>`,
  );

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Now Playing Preview</title>
    <style>
      body {
        margin: 0;
        padding: 32px;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        background: #0b0c0f;
        color: #e5e7eb;
      }
      .container {
        max-width: 900px;
        margin: 0 auto;
      }
      .widget-section {
        background: #0f1115;
        border: 1px solid #1f2430;
        border-radius: 16px;
        padding: 24px;
        margin-bottom: 24px;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
      }
      .widget-section h2 {
        margin: 0 0 16px;
        font-size: 14px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #94a3b8;
      }
      .widget {
        width: 100%;
        display: flex;
        justify-content: center;
      }
      .widget img {
        display: block;
        width: 800px;
        height: auto;
      }
    </style>
  </head>
  <body>
    <div class="container">
      ${widgets.join("\n      ")}
    </div>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

async function handleRequest(req: Request, kv: Deno.Kv): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    let response: Response;

    if (path === "/now-playing.svg" && req.method === "GET") {
      response = await handleGetSvg(req, kv);
    } else if (path === "/preview" && req.method === "GET") {
      response = handleGetPreview(req);
    } else if (path === "/api/now-playing" && req.method === "POST") {
      response = await handlePostNowPlaying(req, kv);
    } else if (path === "/api/now-playing" && req.method === "GET") {
      response = await handleGetNowPlaying(kv);
    } else if (path === "/") {
      response = new Response(
        JSON.stringify({
          endpoints: {
            widget: "/now-playing.svg",
            preview: "/preview",
            update: "POST /api/now-playing",
            debug: "/api/now-playing",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } else {
      response = new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) {
      newHeaders.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (error) {
    console.error("Request error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function main(): Promise<void> {
  const kv = await Deno.openKv();
  console.log("KV connected");

  const port = parseInt(Deno.env.get("PORT") || "8000");

  Deno.serve({ port }, (req) => handleRequest(req, kv));
  console.log(`Server running on port ${port}`);
}

if (import.meta.main) {
  await main();
}
