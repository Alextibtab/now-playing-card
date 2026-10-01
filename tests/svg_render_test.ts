import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { generate_now_playing_svg } from "../src/svg/index.ts";
import { default_svg_config, NowPlayingData } from "../src/types.ts";
import { set_level } from "../src/utils/logger.ts";

// Font loading is expected to fail without --allow-net; keep the expected
// warnings out of the test output.
set_level("error");

function build_data(): NowPlayingData {
  return {
    title: "Title",
    artist: "Artist",
    album: "Album",
    status: "last-played",
    art_base64: null,
    colors: null,
    updated_at: Date.now(),
  };
}

Deno.test("generate_now_playing_svg escapes entities in idle text", async () => {
  const svg = await generate_now_playing_svg(build_data(), {
    ...default_svg_config,
    idle_text: 'R & B <3 "quoted"',
  });

  assertStringIncludes(svg, "R &amp; B &lt;3 &quot;quoted&quot;");
  assert(
    !svg.includes("R & B <3"),
    "raw idle text must not appear unescaped",
  );
});

Deno.test("generate_now_playing_svg escapes markup in idle text", async () => {
  const hostile = "</text><script>alert(1)</script>";
  const svg = await generate_now_playing_svg(build_data(), {
    ...default_svg_config,
    idle_text: hostile,
  });

  assert(
    !svg.includes("<script>alert(1)</script>"),
    "idle text must not inject a script element",
  );
  assertStringIncludes(
    svg,
    "&lt;/text&gt;&lt;script&gt;alert(1)&lt;/script&gt;",
  );
});

Deno.test("generate_now_playing_svg keeps the now-playing label intact", async () => {
  const data = { ...build_data(), status: "playing" as const };
  const svg = await generate_now_playing_svg(data, default_svg_config);

  assertStringIncludes(svg, "NOW PLAYING");
  assertEquals(svg.includes("&amp;"), false);
});
