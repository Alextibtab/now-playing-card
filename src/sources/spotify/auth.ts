import { encodeBase64 } from "@std/encoding";
import { create_logger } from "../../utils/logger.ts";

const log = create_logger("Spotify");

const SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SCOPES = "user-read-currently-playing user-read-recently-played";
const OAUTH_STATE_TTL_MS = 600_000; // 10 minutes

interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

function get_client_credentials(): {
  client_id: string;
  client_secret: string;
} | null {
  const client_id = Deno.env.get("SPOTIFY_CLIENT_ID");
  const client_secret = Deno.env.get("SPOTIFY_CLIENT_SECRET");
  if (!client_id || !client_secret) return null;
  return { client_id, client_secret };
}

function build_callback_url(origin: string): string {
  const url = new URL(origin);
  if (url.protocol === "http:" && url.hostname === "localhost") {
    url.hostname = "127.0.0.1";
  }
  return `${url.origin}/spotify/callback`;
}

export async function handle_spotify_auth(
  req: Request,
  kv: Deno.Kv,
): Promise<Response> {
  const api_key = Deno.env.get("API_KEY");
  const params = new URL(req.url).searchParams;

  if (!api_key || params.get("key") !== api_key) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const creds = get_client_credentials();
  if (!creds) {
    return new Response(
      JSON.stringify({
        error: "SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET not configured",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const state_bytes = new Uint8Array(16);
  crypto.getRandomValues(state_bytes);
  const state = encodeBase64(state_bytes)
    .replace(/[+/=]/g, "")
    .slice(0, 22);

  await kv.set(
    ["spotify", "oauth_state", state],
    { created_at: Date.now() },
    { expireIn: OAUTH_STATE_TTL_MS },
  );

  const callback_url = build_callback_url(new URL(req.url).origin);

  const auth_params = new URLSearchParams({
    response_type: "code",
    client_id: creds.client_id,
    scope: SCOPES,
    redirect_uri: callback_url,
    state: state,
  });

  const redirect_url = `${SPOTIFY_AUTHORIZE_URL}?${auth_params}`;
  log.info("Redirecting to Spotify authorize");

  return new Response(null, {
    status: 302,
    headers: { Location: redirect_url },
  });
}

export async function handle_spotify_callback(
  req: Request,
  kv: Deno.Kv,
): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    log.warn(`OAuth denied: ${error}`);
    return new Response(
      callback_html(
        "Authorization Denied",
        `Spotify returned: ${error}`,
        false,
      ),
      {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  if (!code || !state) {
    return new Response(
      callback_html(
        "Invalid Callback",
        "Missing code or state parameter.",
        false,
      ),
      {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  const stored_state = await kv.get(
    ["spotify", "oauth_state", state],
  );

  if (!stored_state.value) {
    return new Response(
      callback_html(
        "Invalid State",
        "OAuth state expired or invalid. Try again.",
        false,
      ),
      {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  await kv.delete(["spotify", "oauth_state", state]);

  const creds = get_client_credentials();
  if (!creds) {
    return new Response(
      callback_html(
        "Server Error",
        "Spotify credentials not configured.",
        false,
      ),
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  const callback_url = build_callback_url(url.origin);

  const token_response = await exchange_code(
    code,
    callback_url,
    creds.client_id,
    creds.client_secret,
  );

  if (!token_response) {
    return new Response(
      callback_html(
        "Token Exchange Failed",
        "Could not exchange authorization code for tokens.",
        false,
      ),
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  const tokens: SpotifyTokens = {
    access_token: token_response.access_token,
    refresh_token: token_response.refresh_token ?? "",
    expires_at: Date.now() + token_response.expires_in * 1000,
  };

  await kv.set(["spotify", "tokens"], tokens);
  log.info("Spotify tokens stored successfully");

  return new Response(
    callback_html(
      "Authorization Successful",
      "Spotify is now connected. You can close this page.",
      true,
    ),
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

async function exchange_code(
  code: string,
  redirect_uri: string,
  client_id: string,
  client_secret: string,
): Promise<SpotifyTokenResponse | null> {
  const auth_header = encodeBase64(
    `${client_id}:${client_secret}`,
  );

  try {
    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth_header}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirect_uri,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const text = await response.text();
      log.error("Token exchange failed", {
        status: response.status,
        body: text,
      });
      return null;
    }

    return await response.json() as SpotifyTokenResponse;
  } catch (err) {
    log.error("Token exchange error", err);
    return null;
  }
}

export async function get_valid_access_token(
  kv: Deno.Kv,
): Promise<string | null> {
  const entry = await kv.get<SpotifyTokens>(["spotify", "tokens"]);
  if (!entry.value) {
    log.warn("No Spotify tokens stored - run /spotify/auth first");
    return null;
  }

  const tokens = entry.value;
  const buffer_ms = 60_000; // refresh 1 min before expiry

  if (Date.now() < tokens.expires_at - buffer_ms) {
    return tokens.access_token;
  }

  log.info("Access token expired, refreshing");
  return await refresh_access_token(kv, tokens);
}

async function refresh_access_token(
  kv: Deno.Kv,
  tokens: SpotifyTokens,
): Promise<string | null> {
  const creds = get_client_credentials();
  if (!creds) {
    log.error("Cannot refresh: Spotify credentials not configured");
    return null;
  }

  const auth_header = encodeBase64(
    `${creds.client_id}:${creds.client_secret}`,
  );

  try {
    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth_header}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const text = await response.text();
      log.error("Token refresh failed", {
        status: response.status,
        body: text,
      });
      return null;
    }

    const data = await response.json() as SpotifyTokenResponse;

    const updated: SpotifyTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? tokens.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
    };

    await kv.set(["spotify", "tokens"], updated);
    log.info("Tokens refreshed successfully");

    return updated.access_token;
  } catch (err) {
    log.error("Token refresh error", err);
    return null;
  }
}

function callback_html(
  title: string,
  message: string,
  success: boolean,
): string {
  const color = success ? "#22c55e" : "#ef4444";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body {
      margin: 0; padding: 48px;
      font-family: ui-sans-serif, system-ui, sans-serif;
      background: #0b0c0f; color: #e5e7eb;
      display: flex; justify-content: center; align-items: center;
      min-height: 100vh;
    }
    .card {
      background: #0f1115; border: 1px solid #1f2430;
      border-radius: 16px; padding: 32px; max-width: 420px;
      text-align: center;
    }
    h1 { color: ${color}; font-size: 20px; margin: 0 0 12px; }
    p { color: #94a3b8; font-size: 14px; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
