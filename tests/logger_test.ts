import { assertEquals, assertStringIncludes } from "@std/assert";
import {
  create_logger,
  get_level,
  type Logger,
  print_banner,
  set_level,
  set_sink,
} from "../src/utils/logger.ts";

const ANSI = new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g");

function strip_ansi(s: string): string {
  return s.replace(ANSI, "");
}

function capture(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const previous = set_sink((line: string) => lines.push(line));
  return { lines, restore: () => set_sink(previous) };
}

function plain(lines: string[]): string[] {
  return lines.map(strip_ansi);
}

Deno.test("logger respects level filter", () => {
  set_level("warn");
  try {
    assertEquals(get_level(), "warn");
    const log = create_logger("Test");
    log.debug("should not appear");
    log.info("should not appear");
    log.warn("should appear");
    log.error("should appear");

    const cap = capture();
    try {
      log.debug("d");
      log.info("i");
      log.warn("w");
      log.error("e");
      assertEquals(cap.lines.length, 2);
      assertStringIncludes(cap.lines[0]!, "WARN");
      assertStringIncludes(cap.lines[0]!, "w");
      assertStringIncludes(cap.lines[1]!, "ERROR");
    } finally {
      cap.restore();
    }
  } finally {
    set_level("info");
  }
});

Deno.test("logger renders scoped context as key=value", () => {
  const cap = capture();
  try {
    set_level("info");
    const log = create_logger("Server");
    log.info("KV connected", { ms: 42 });

    const out = plain(cap.lines);
    assertEquals(out.length, 1);
    assertStringIncludes(out[0]!, "Server");
    assertStringIncludes(out[0]!, "KV connected");
    assertStringIncludes(out[0]!, "ms=42");
  } finally {
    cap.restore();
  }
});

Deno.test("logger renders Error context as error=message", () => {
  const cap = capture();
  try {
    set_level("info");
    const log = create_logger("Tauon");
    log.warn("fetch failed", new Error("connection refused"));

    const out = plain(cap.lines);
    assertEquals(out.length, 1);
    assertStringIncludes(out[0]!, "Tauon");
    assertStringIncludes(out[0]!, "fetch failed");
    assertStringIncludes(out[0]!, 'error="connection refused"');
  } finally {
    cap.restore();
  }
});

Deno.test("logger output contains timestamp and scope columns", () => {
  const cap = capture();
  try {
    set_level("info");
    const log = create_logger("Poller");
    log.info("Updated: Track by Artist");

    const out = plain(cap.lines);
    assertEquals(out.length, 1);
    const line = out[0]!;
    assertStringIncludes(line, "Poller");
    assertStringIncludes(line, "Updated: Track by Artist");
    assertStringIncludes(line, "│");
    const parts = line.split(/\s+/);
    assertEquals(parts.length >= 4, true);
    assertStringIncludes(parts[0]!, ":");
  } finally {
    cap.restore();
  }
});

Deno.test("logger does not emit below configured level", () => {
  const cap = capture();
  try {
    set_level("error");
    const log = create_logger("Test");
    log.debug("d");
    log.info("i");
    log.warn("w");
    log.error("e");

    const out = plain(cap.lines);
    assertEquals(out.length, 1);
    assertStringIncludes(out[0]!, "ERROR");
  } finally {
    cap.restore();
    set_level("info");
  }
});

Deno.test("print_banner emits top and bottom box lines", () => {
  const cap = capture();
  try {
    print_banner("Tauon Now Playing Poller", [
      ["Tauon URL", "http://localhost:7814"],
      ["Deploy URL", "https://example.com"],
    ]);

    const out = plain(cap.lines);
    assertEquals(out.length, 4);
    const top = out[0]!;
    const bottom = out[3]!;
    assertStringIncludes(top, "Tauon Now Playing Poller");
    assertStringIncludes(top, "╭");
    assertStringIncludes(bottom, "╰");
  } finally {
    cap.restore();
  }
});

Deno.test("logger omits ANSI escapes under NO_COLOR", () => {
  const cap = capture();
  try {
    set_level("info");
    const log = create_logger("Server");
    log.info("hello");

    assertEquals(cap.lines.length, 1);
    if (Deno.env.get("NO_COLOR")) {
      assertEquals(cap.lines[0]!.includes("\x1b"), false);
    }
  } finally {
    cap.restore();
  }
});

Deno.test("logger interface is satisfied by create_logger", () => {
  const log: Logger = create_logger("Test");
  assertEquals(typeof log.debug, "function");
  assertEquals(typeof log.info, "function");
  assertEquals(typeof log.warn, "function");
  assertEquals(typeof log.error, "function");
});
