import {
  defaultSvgConfig,
  NowPlayingData,
  SourceType,
  SvgConfig,
  VISUALISATION_TYPES,
} from "./types.ts";
import { encodeBase64 } from "@std/encoding";
import { load } from "@std/dotenv";
import { generateNowPlayingSvg } from "./svg/index.ts";
import { validateAuth } from "./server/authentication.ts";
import { getNowPlaying, storeNowPlaying } from "./server/kv-storage.ts";
import { buildSvgConfig, sanitizePreviewConfig } from "./server/config.ts";
import { fetchLastFm } from "./sources/lastfm/index.ts";

const editorCache: { template: string | null } = { template: null };

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return encodeBase64(bytes);
}

async function handlePostTauonNowPlaying(
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
    console.log(`Received POST [tauon]: ${text.length} chars`);
    const data = JSON.parse(text) as NowPlayingData;
    await storeNowPlaying(kv, "tauon", data);
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

async function handleGetSvg(
  req: Request,
  kv: Deno.Kv,
  source: SourceType,
): Promise<Response> {
  const data = await fetchNowPlaying(kv, source);
  const params = new URL(req.url).searchParams;
  const config = await buildSvgConfig(params);
  const svg = await generateNowPlayingSvg(data, config);

  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "s-maxage=1",
    },
  });
}

async function fetchNowPlaying(
  kv: Deno.Kv,
  source: SourceType,
): Promise<NowPlayingData | null> {
  if (source === "tauon") {
    return await getNowPlaying(kv, source);
  }

  if (source === "lastfm") {
    const apiKey = Deno.env.get("LASTFM_API_KEY");
    const username = Deno.env.get("LASTFM_USERNAME");

    if (!apiKey || !username) {
      console.warn("LastFM credentials not configured");
      return null;
    }

    return fetchLastFm(apiKey, username);
  }

  console.warn(`Source "${source}" not implemented`);
  return null;
}

async function handleGetNowPlaying(
  kv: Deno.Kv,
  source: SourceType,
): Promise<Response> {
  const data = await fetchNowPlaying(kv, source);
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
  });
}

const MAX_PREVIEW_BODY = 8 * 1024 * 1024;

async function handlePreviewRender(req: Request): Promise<Response> {
  const contentLength = parseInt(
    req.headers.get("Content-Length") || "0",
  );
  if (contentLength > MAX_PREVIEW_BODY) {
    return new Response(
      JSON.stringify({ error: "Request body too large" }),
      { status: 413, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const text = await req.text();
    if (text.length > MAX_PREVIEW_BODY) {
      return new Response(
        JSON.stringify({ error: "Request body too large" }),
        { status: 413, headers: { "Content-Type": "application/json" } },
      );
    }

    const body = JSON.parse(text);
    const data = body.data as NowPlayingData | null;
    const configOverrides = sanitizePreviewConfig(body.config || {});
    const config: SvgConfig = {
      ...defaultSvgConfig,
      ...configOverrides,
    };
    const svg = await generateNowPlayingSvg(data, config);
    return new Response(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function handleGetEditor(): Promise<Response> {
  try {
    if (!editorCache.template) {
      const editorUrl = new URL("../assets/editor.html", import.meta.url);
      let html = await Deno.readTextFile(editorUrl);
      const artUrl = new URL("../assets/sample-art.jpg", import.meta.url);
      const artData = await Deno.readFile(artUrl);
      const artBase64 = encodeBase64(artData);
      html = html.replace("{{SAMPLE_ART_BASE64}}", artBase64);
      editorCache.template = html;
    }
    const nonce = generateNonce();
    const html = editorCache.template.replaceAll("{{CSP_NONCE}}", nonce);
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
        "Content-Security-Policy":
          `default-src 'none'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'nonce-${nonce}'; img-src data:; font-src data:; connect-src 'self'`,
        "X-Frame-Options": "DENY",
      },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "Editor page not found" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

async function handleGetAsset(
  filename: string,
): Promise<Response> {
  try {
    const assetUrl = new URL(`../assets/${filename}`, import.meta.url);
    const content = await Deno.readFile(assetUrl);
    const ext = filename.split(".").pop()?.toLowerCase();
    const contentType = ext === "css"
      ? "text/css; charset=utf-8"
      : ext === "js"
      ? "application/javascript; charset=utf-8"
      : "application/octet-stream";
    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "Asset not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }
}

function handleGetPreview(req: Request, source: SourceType): Response {
  const params = new URL(req.url).searchParams;
  const nonce = generateNonce();

  const extraParams = new URLSearchParams(params);
  extraParams.delete("vis");
  const extraStr = extraParams.toString();
  const suffix = extraStr ? `&${extraStr}` : "";

  const svgPath = `/${source}/now-playing.svg`;

  const widgets = VISUALISATION_TYPES.map(
    (vis) =>
      `<div class="widget-section">
        <h2>${vis}</h2>
        <div class="widget">
          <img src="${svgPath}?vis=${vis}${suffix}" alt="${vis} visualisation" />
        </div>
      </div>`,
  );

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Now Playing Preview</title>
    <style nonce="${nonce}">
      body {
        margin: 0;
        padding: 32px;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        background: #0b0c0f;
        color: #e5e7eb;
      }
      .container { max-width: 900px; margin: 0 auto; }
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
      .widget { width: 100%; display: flex; justify-content: center; }
      .widget img { display: block; width: 800px; height: auto; }
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
      "Content-Security-Policy":
        `default-src 'none'; style-src 'nonce-${nonce}'; img-src 'self'`,
      "X-Frame-Options": "DENY",
    },
  });
}

function parseSourceFromPath(
  path: string,
): { source: SourceType; remaining: string } | null {
  const match = path.match(/^\/(tauon|spotify|lastfm|tidal)(\/.*)?$/);
  if (match) {
    return { source: match[1] as SourceType, remaining: match[2] || "/" };
  }
  return null;
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

    const parsed = parseSourceFromPath(path);

    if (parsed) {
      const { source, remaining } = parsed;

      if (remaining === "/now-playing.svg" && req.method === "GET") {
        response = await handleGetSvg(req, kv, source);
      } else if (remaining === "/preview" && req.method === "GET") {
        response = handleGetPreview(req, source);
      } else if (
        remaining === "/api/now-playing" &&
        req.method === "POST" &&
        source === "tauon"
      ) {
        response = await handlePostTauonNowPlaying(req, kv);
      } else if (remaining === "/api/now-playing" && req.method === "GET") {
        response = await handleGetNowPlaying(kv, source);
      } else if (remaining === "/") {
        response = new Response(
          JSON.stringify({
            source,
            endpoints: {
              widget: `/${source}/now-playing.svg`,
              preview: `/${source}/preview`,
              update: source === "tauon"
                ? `POST /${source}/api/now-playing`
                : null,
              debug: `GET /${source}/api/now-playing`,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      } else {
        response = new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
    } else if (path === "/editor" && req.method === "GET") {
      response = await handleGetEditor();
    } else if (path === "/assets/editor.css" && req.method === "GET") {
      response = await handleGetAsset("editor.css");
    } else if (path === "/assets/editor.js" && req.method === "GET") {
      response = await handleGetAsset("editor.js");
    } else if (path === "/api/preview" && req.method === "POST") {
      response = await handlePreviewRender(req);
    } else if (path === "/") {
      response = new Response(
        JSON.stringify({
          sources: {
            tauon: {
              type: "poller",
              widget: "/tauon/now-playing.svg",
              update: "POST /tauon/api/now-playing (requires API_KEY)",
            },
            lastfm: {
              type: "direct",
              widget: "/lastfm/now-playing.svg",
              config: "LASTFM_API_KEY + LASTFM_USERNAME",
            },
            spotify: {
              type: "direct",
              widget: "/spotify/now-playing.svg (not implemented)",
            },
            tidal: {
              type: "direct",
              widget: "/tidal/now-playing.svg (not implemented)",
            },
          },
          utility: {
            editor: "/editor",
            preview: "POST /api/preview",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
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

    newHeaders.set("X-Content-Type-Options", "nosniff");

    const contentType = response.headers.get("Content-Type") || "";
    if (
      contentType.includes("image/svg+xml") &&
      !response.headers.has("Content-Security-Policy")
    ) {
      newHeaders.set(
        "Content-Security-Policy",
        "default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:",
      );
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
  await load({ export: true });

  const kv = await Deno.openKv();
  console.log("KV connected");

  const port = parseInt(Deno.env.get("PORT") || "8000");

  Deno.serve({ port }, (req) => handleRequest(req, kv));
  console.log(`Server running on port ${port}`);
}

if (import.meta.main) {
  await main();
}
