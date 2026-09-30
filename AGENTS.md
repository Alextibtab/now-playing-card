# Agent Instructions for now-playing-card

## Project Overview

Deno TypeScript project for a "now playing" widget that embeds on GitHub
READMEs. Supports three sources: a local Tauon Music Player poller, Last.fm, and
Spotify.

**Architecture:**

- `src/server.ts` - Deno Deploy API: routing, serves SVG widget, receives data
  via KV
- `src/server/kv_storage.ts` - KV operations
- `src/server/authentication.ts` - Bearer-token API key authentication
- `src/server/fonts.ts` - Google Fonts loading/caching
- `src/server/themes.ts` - Theme loading/validation
- `src/server/config.ts` - Query-param parsing and preview config sanitising
- `src/sources/tauon/index.ts` - Local poller: polls Tauon API, resizes album
  art, pushes to Deploy API
- `src/sources/lastfm/index.ts` - Last.fm source (server-side, cached)
- `src/sources/spotify/index.ts` - Spotify source (server-side, cached)
- `src/sources/spotify/auth.ts` - Spotify OAuth2 flow and token refresh
- `src/svg/index.ts` - Pure SVG card generation (no foreignObject for GitHub
  compatibility)
- `src/svg/visualisations/` - Waveform/equalizer/orbs/particles renderers
- `themes/registry.ts` + `themes/*.json` - Built-in theme list and definitions
- `assets/` - Editor HTML/CSS/JS served at `/editor`
- `src/types.ts` - Shared TypeScript types
- `src/utils/logger.ts` - Scoped leveled logging (debug/info/warn/error) with
  raw ANSI color codes, auto-disabled on Deno Deploy / non-TTY / `NO_COLOR`

The server renders the current track from the selected source as a pure SVG
image; the local Tauon poller pushes data to the Deploy API via KV.

## Commands

```bash
# Run the Deploy API locally (for development)
deno task dev

# Run the local poller (requires env vars)
deno task tauon

# Type check all files
deno task check

# Format code
deno task fmt

# Run all tests
deno task test

# Run a single test by name
deno task test -- --filter "testName"

# Lint code
deno lint

# Cache dependencies
deno cache --unstable-kv src/server.ts
```

Deployment is handled by the Deno Deploy integration configured under the
`deploy` key in `deno.json`; there is no local `deploy` task.

## Environment Variables

### Server (Deno Deploy)

- `API_KEY` - Shared secret for authenticating poller requests (required)
- `PORT` - Server port (default: 8000)
- `LASTFM_API_KEY`, `LASTFM_USERNAME` - Last.fm source credentials
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` - Spotify OAuth2 credentials
- `SOURCE_CACHE_TTL_MS` - Cache TTL for Last.fm/Spotify responses in ms
  (default: 30000, minimum: 5000)

### Local Poller

- `API_KEY` - Same shared secret as server (required)
- `DEPLOY_URL` - URL of deployed API (required)
- `TAUON_URL` - Tauon API URL (default: http://localhost:7814)
- `POLL_INTERVAL_MS` - Polling interval in ms (default: 10000)

### Logging (both)

- `LOG_LEVEL` - Minimum log level to emit (default: `info`; one of
  `debug`/`info`/`warn`/`error`). Applies to both server and poller.
- `NO_COLOR` - When set to any value, disables ANSI color in log output.

## Code Style Guidelines

### TypeScript

- Use explicit return types on exported functions:
  `function add(a: number, b: number): number`
- Use strict TypeScript settings (enforced by Deno)
- Prefer `const` and `let` over `var`
- Use type annotations for function parameters
- Use interfaces for data structures (TauonStatus, NowPlayingData)

### Imports

- Use JSR registry imports defined in `deno.json` imports field
- Import format: `import { assertEquals } from "@std/assert";`
- Use relative imports for local modules:
  `import { generate_now_playing_svg } from "./svg/index.ts";`
- Always include `.ts` extension in relative imports
- Prefer JSR registry imports; fall back to npm packages only when no JSR
  equivalent exists

### Formatting

- Run `deno fmt` before committing
- 2 spaces indentation
- Max line length: 80 characters
- Use single quotes for strings
- Trailing commas in multi-line objects/arrays

### Naming Conventions

- `snake_case` for variables, functions, and methods
- `PascalCase` for classes, interfaces, types, and enums
- `SCREAMING_SNAKE_CASE` for constants
- `snake_case` for file names

### Error Handling

- Use explicit error types when possible
- Prefer early returns over nested conditionals
- Use `try/catch` for async operations and I/O
- Log warnings for non-fatal errors (Tauon unreachable, API failures)
- Exit with error for missing required env vars

### Logging

- Use `create_logger(scope)` from `src/utils/logger.ts`; never call `console.*`
  directly. Returned object exposes `debug`/`info`/`warn`/`error` methods with
  signature `(msg: string, ctx?: unknown)`.
- Pass `Error` objects as the `ctx` argument; the logger renders them as
  `error="<message>"`. Pass plain objects for structured context (`{ ms: 42 }`
  renders as `ms=42`).
- Keep scope labels short and lowercase-friendly, one per module: `Poller`,
  `Server`, `API`, `Tauon`, `Art`, `Theme`, `Font`, `LastFM`, `Spotify`.
- Use `set_level` in tests only; runtime level comes from `LOG_LEVEL` env.
- Use `print_banner(title, rows)` for CLI entry banners (box-drawing chars).

### Testing

- Use `Deno.test()` for test definitions
- Test file naming: `*_test.ts` suffix
- Place tests in `tests/` directory
- Use `@std/assert` for assertions

### SVG Generation

- Pure SVG only - NO `foreignObject` (GitHub strips it)
- Use `<image>` with `href="data:image/jpeg;base64,..."` for album art
- Use `<clipPath>` for rounded corners on images
- Use SMIL animations (`<animate>`) for equalizer bars
- Escape XML entities in ALL interpolated text (title, artist, album, and the
  status/idle label) with `escape_xml` before interpolation
- Truncate long text to prevent overflow

### Security

- Treat all query params and request bodies as untrusted input.
- Validate/sanitise before use: colours against `HEX_COLOR_PATTERN`, theme names
  against `THEME_NAME_PATTERN`, font families against `FONT_FAMILY_PATTERN`,
  numbers clamped to sane ranges.
- Never interpolate raw user-controlled strings into SVG or HTML; always run
  them through `escape_xml` (SVG) or `escape_html` (HTML).
- Authenticate write endpoints with the `Authorization: Bearer <API_KEY>` header
  (`validate_auth`).

### Module Structure

- Export functions/types at the bottom or inline
- Use `if (import.meta.main)` guard for CLI entry points
- Keep modules focused on single responsibility
- Use shared types from `src/types.ts` for data contracts

## Deno Configuration

- See `deno.json` for task definitions and import maps
- `--unstable-kv` required for Deno KV (local development)
