import { NowPlayingData, SourceType } from "../types.ts";

const KV_KEY_PREFIX = "now-playing";

function get_kv_key(source: SourceType): string[] {
  return [KV_KEY_PREFIX, source];
}

export async function store_now_playing(
  kv: Deno.Kv,
  source: SourceType,
  data: NowPlayingData,
): Promise<void> {
  await kv.set(get_kv_key(source), data);
}

export async function get_now_playing(
  kv: Deno.Kv,
  source: SourceType,
): Promise<NowPlayingData | null> {
  const result = await kv.get<NowPlayingData>(get_kv_key(source));
  return result.value;
}
