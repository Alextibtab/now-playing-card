import {
  default_svg_config,
  NowPlayingData,
  SourceType,
  SvgConfig,
  VISUALISATION_TYPES,
} from "./types.ts";
import { encodeBase64 } from "@std/encoding";
import { load } from "@std/dotenv";
import { generate_now_playing_svg } from "./svg/index.ts";
import { validate_auth } from "./server/authentication.ts";
import { get_now_playing, store_now_playing } from "./server/kv_storage.ts";
import { build_svg_config, sanitize_preview_config } from "./server/config.ts";
import { fetch_lastfm } from "./sources/lastfm/index.ts";

const editor_cache: { template: string | null } = { template: null };

function generate_nonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return encodeBase64(bytes);
}

async function handle_post_tauon_now_playing(
  req: Request,
  kv: Deno.Kv,
): Promise<Response> {
  if (!validate_auth(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const text = await req.text();
    console.log(`Received POST [tauon]: ${text.length} chars`);
    const data = JSON.parse(text) as NowPlayingData;
    await store_now_playing(kv, "tauon", data);
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

async function handle_get_svg(
  req: Request,
  kv: Deno.Kv,
  source: SourceType,
): Promise<Response> {
  const data = await fetch_now_playing(kv, source);
  const params = new URL(req.url).searchParams;
  const config = await build_svg_config(params);
  const svg = await generate_now_playing_svg(data, config);

  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "s-maxage=1",
    },
  });
}

async function fetch_now_playing(
  kv: Deno.Kv,
  source: SourceType,
): Promise<NowPlayingData | null> {
  if (source === "tauon") {
    return await get_now_playing(kv, source);
  }

  if (source === "lastfm") {
    const api_key = Deno.env.get("LASTFM_API_KEY");
    const username = Deno.env.get("LASTFM_USERNAME");

    if (!api_key || !username) {
      console.warn("LastFM credentials not configured");
      return null;
    }

    return fetch_lastfm(api_key, username);
  }

  console.warn(`Source "${source}" not implemented`);
  return null;
}

async function handle_get_now_playing(
  kv: Deno.Kv,
  source: SourceType,
): Promise<Response> {
  const data = await fetch_now_playing(kv, source);
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
  });
}

const MAX_PREVIEW_BODY = 8 * 1024 * 1024;

async function handle_preview_render(req: Request): Promise<Response> {
  const content_length = parseInt(
    req.headers.get("Content-Length") || "0",
  );
  if (content_length > MAX_PREVIEW_BODY) {
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
    const config_overrides = sanitize_preview_config(body.config || {});
    const config: SvgConfig = {
      ...default_svg_config,
      ...config_overrides,
    };
    const svg = await generate_now_playing_svg(data, config);
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

async function handle_get_editor(): Promise<Response> {
  try {
    if (!editor_cache.template) {
      const editor_url = new URL("../assets/editor.html", import.meta.url);
      editor_cache.template = await Deno.readTextFile(editor_url);
    }
    const nonce = generate_nonce();
    const html = editor_cache.template.replaceAll("{{CSP_NONCE}}", nonce);
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

async function handle_get_asset(
  filename: string,
): Promise<Response> {
  try {
    const asset_url = new URL(`../assets/${filename}`, import.meta.url);
    let content = await Deno.readFile(asset_url);
    const ext = filename.split(".").pop()?.toLowerCase();
    const content_type = ext === "css"
      ? "text/css; charset=utf-8"
      : ext === "js"
      ? "application/javascript; charset=utf-8"
      : "application/octet-stream";

    if (filename === "editor.js") {
      const nonce = generate_nonce();
      const art_url = new URL("../assets/sample-art.jpg", import.meta.url);
      const art_data = await Deno.readFile(art_url);
      const art_base64 = encodeBase64(art_data);
      let js_content = new TextDecoder().decode(content);
      js_content = js_content.replace("{{CSP_NONCE}}", nonce);
      js_content = js_content.replace("{{SAMPLE_ART_BASE64}}", art_base64);
      content = new TextEncoder().encode(js_content);

      return new Response(content, {
        status: 200,
        headers: {
          "Content-Type": content_type,
          "Cache-Control": "no-cache",
          "Content-Security-Policy":
            `default-src 'none'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'nonce-${nonce}'; img-src data:; font-src data:; connect-src 'self'`,
        },
      });
    }

    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": content_type,
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

function handle_get_preview(req: Request, source: SourceType): Response {
  const params = new URL(req.url).searchParams;
  const nonce = generate_nonce();

  const extra_params = new URLSearchParams(params);
  extra_params.delete("vis");
  const extra_str = extra_params.toString();
  const suffix = extra_str ? `&${extra_str}` : "";

  const svg_path = `/${source}/now-playing.svg`;

  const widgets = VISUALISATION_TYPES.map(
    (vis) =>
      `<div class="widget-section">
        <h2>${vis}</h2>
        <div class="widget">
          <img src="${svg_path}?vis=${vis}${suffix}" alt="${vis} visualisation" />
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

function parse_source_from_path(
  path: string,
): { source: SourceType; remaining: string } | null {
  const match = path.match(/^\/(tauon|spotify|lastfm|tidal)(\/.*)?$/);
  if (match) {
    return { source: match[1] as SourceType, remaining: match[2] || "/" };
  }
  return null;
}

async function handle_request(req: Request, kv: Deno.Kv): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  const cors_headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors_headers });
  }

  try {
    let response: Response;

    const parsed = parse_source_from_path(path);

    if (parsed) {
      const { source, remaining } = parsed;

      if (remaining === "/now-playing.svg" && req.method === "GET") {
        response = await handle_get_svg(req, kv, source);
      } else if (remaining === "/preview" && req.method === "GET") {
        response = handle_get_preview(req, source);
      } else if (
        remaining === "/api/now-playing" &&
        req.method === "POST" &&
        source === "tauon"
      ) {
        response = await handle_post_tauon_now_playing(req, kv);
      } else if (remaining === "/api/now-playing" && req.method === "GET") {
        response = await handle_get_now_playing(kv, source);
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
      response = await handle_get_editor();
    } else if (path === "/assets/editor.css" && req.method === "GET") {
      response = await handle_get_asset("editor.css");
    } else if (path === "/assets/editor.js" && req.method === "GET") {
      response = await handle_get_asset("editor.js");
    } else if (path === "/api/preview" && req.method === "POST") {
      response = await handle_preview_render(req);
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

    const new_headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(cors_headers)) {
      new_headers.set(key, value);
    }

    new_headers.set("X-Content-Type-Options", "nosniff");

    const content_type = response.headers.get("Content-Type") || "";
    if (
      content_type.includes("image/svg+xml") &&
      !response.headers.has("Content-Security-Policy")
    ) {
      new_headers.set(
        "Content-Security-Policy",
        "default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:",
      );
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new_headers,
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

  Deno.serve({ port }, (req) => handle_request(req, kv));
  console.log(`Server running on port ${port}`);
}

if (import.meta.main) {
  await main();
}
