import { NowPlayingData } from "../types.ts";

const KV_KEY = ["now-playing"];

export async function storeNowPlaying(
  kv: Deno.Kv,
  data: NowPlayingData,
): Promise<void> {
  await kv.set(KV_KEY, data);
}

export async function getNowPlaying(
  kv: Deno.Kv,
): Promise<NowPlayingData | null> {
  const result = await kv.get<NowPlayingData>(KV_KEY);
  return result.value;
}
