# Tauon Now Playing (GitHub README Widget)

A Deno-based "now playing" widget for Tauon Music Player that renders a pure SVG
card for GitHub READMEs. The project has two parts:

- **Deploy API** (`server.ts`): stores data in Deno KV and serves the SVG.
- **Local poller** (`poller.ts`): polls Tauon locally, resizes album art, pushes
  updates to the Deploy API.

&nbsp;<div align="center">
![Tauon Now Playing](https://tauon-now-playing.alextibtab.deno.net/now-playing.svg)

</div>

## Features

- Pure SVG (GitHub-compatible, no `foreignObject`)
- Album art + Tauon badge
- Animated waveform background
- Color extraction from album art (dominant + highlight)
- Authenticated updates via shared API key

## Requirements

- Deno 2.x
- Tauon Music Player with HTTP API enabled on `http://localhost:7814`

## Local Development

### 1) Start the API locally

```bash
API_KEY=devkey deno task dev
```

### 2) Run the local poller

```bash
API_KEY=devkey \
DEPLOY_URL=http://localhost:8000 \
deno task poll
```

### 3) View the widget

- SVG: `http://localhost:8000/now-playing.svg`
- Preview page: `http://localhost:8000/preview`
- Debug JSON: `http://localhost:8000/api/now-playing`

## Deploy to Deno Deploy

### 1) Create an API key

```bash
openssl rand -hex 32
```

### 2) Create a Deploy project

```bash
deployctl projects create tauon-now-playing
```

### 3) Set the API key on Deploy

```bash
deployctl env set API_KEY <your-secret> --project=tauon-now-playing
```

### 4) Deploy

```bash
deno task deploy
```

### 5) Create a KV database (Deploy UI)

In the Deno Deploy dashboard:

1. Open the project
2. Go to **KV**
3. Create a new KV database
4. Bind it to the project

### 6) Run the local poller

```bash
API_KEY=<your-secret> \
DEPLOY_URL=https://<project>.deno.dev \
deno task poll
```

## Add to GitHub README

```md
![Now Playing](https://<project>.deno.dev/now-playing.svg)
```

## Environment Variables

### Server (Deploy)

- `API_KEY` (required)
- `PORT` (optional, default: 8000)

### Poller (Local)

- `API_KEY` (required)
- `DEPLOY_URL` (required)
- `TAUON_URL` (optional, default: `http://localhost:7814`)
- `POLL_INTERVAL_MS` (optional, default: `10000`)

## Commands

```bash
# Run Deploy API locally (uses KV, requires --unstable-kv)
deno task dev

# Run local poller
deno task poll

# Type check
deno task check

# Format
deno task fmt

# Deploy
deno task deploy
```

## Notes

- The poller uses `sharp` and requires `--allow-ffi`.

<!-- Test change for PR-Agent workflow verification -->

- GitHub caches images, but the SVG uses `Cache-Control: s-maxage=1` for faster
  refresh when reloading the page.
