import { NowPlayingData, SourceType } from "../types.ts";

const KV_KEY_PREFIX = "now-playing";

function getKvKey(source: SourceType): string[] {
  return [KV_KEY_PREFIX, source];
}

export async function storeNowPlaying(
  kv: Deno.Kv,
  source: SourceType,
  data: NowPlayingData,
): Promise<void> {
  await kv.set(getKvKey(source), data);
}

export async function getNowPlaying(
  kv: Deno.Kv,
  source: SourceType,
): Promise<NowPlayingData | null> {
  const result = await kv.get<NowPlayingData>(getKvKey(source));
  return result.value;
}

export const VALID_SOURCES = ["tauon", "spotify", "lastfm", "tidal"] as const;

export function isValidSource(source: string): source is SourceType {
  return VALID_SOURCES.includes(source as SourceType);
}
