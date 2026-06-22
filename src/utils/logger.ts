import chalk from "chalk";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(msg: string, ctx?: unknown): void;
  info(msg: string, ctx?: unknown): void;
  warn(msg: string, ctx?: unknown): void;
  error(msg: string, ctx?: unknown): void;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Right-aligned 5-char labels produce uniform-width badges under bg color.
const LEVEL_LABEL: Record<LogLevel, string> = {
  debug: "DEBUG",
  info: " INFO",
  warn: " WARN",
  error: "ERROR",
};

function parse_level(value: string | undefined): LogLevel {
  const v = (value || "info").toLowerCase();
  if (v in LEVEL_ORDER) return v as LogLevel;
  return "info";
}

// Disable color when: NO_COLOR set, running on Deno Deploy, or stdin not a TTY.
const is_deployed = typeof Deno.env.get("DENO_DEPLOYMENT_ID") === "string";
const no_color = typeof Deno.env.get("NO_COLOR") === "string";
let stdin_is_tty = true;
try {
  stdin_is_tty = Deno.stdin.isTerminal();
} catch {
  stdin_is_tty = false;
}
if (is_deployed || no_color || !stdin_is_tty) {
  chalk.level = 0;
}

let configured_level: LogLevel = parse_level(Deno.env.get("LOG_LEVEL"));

type SinkFn = (line: string) => void;
let sink: SinkFn = (line) => console.log(line);

export function set_level(level: LogLevel): void {
  if (level in LEVEL_ORDER) configured_level = level;
}

export function set_sink(fn: SinkFn): SinkFn {
  const previous = sink;
  sink = fn;
  return previous;
}

export function get_level(): LogLevel {
  return configured_level;
}

function format_value(value: unknown): string {
  if (typeof value === "string") return `"${value}"`;
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (
    typeof value === "number" || typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function format_pair(key: string, value: unknown): string {
  return `${chalk.cyan(key)}=${chalk.yellow(format_value(value))}`;
}

function format_context(ctx: unknown): string {
  if (ctx === null || ctx === undefined) return "";
  const sep = `  ${chalk.dim("·")}  `;
  if (ctx instanceof Error) {
    return sep + format_pair("error", ctx.message || String(ctx));
  }
  if (typeof ctx === "object") {
    const entries = Object.entries(ctx as Record<string, unknown>);
    if (entries.length === 0) return "";
    return sep + entries.map(([k, v]) => format_pair(k, v)).join("  ");
  }
  return sep + format_value(ctx);
}

function timestamp(): string {
  return chalk.dim(new Date().toISOString().slice(11, 23));
}

const LEVEL_SYMBOL: Record<LogLevel, string> = {
  debug: "◆",
  info: "ℹ",
  warn: "⊚",
  error: "✖",
};

function level_markup(level: LogLevel): string {
  const label = `${LEVEL_LABEL[level]} ${LEVEL_SYMBOL[level]}  `;
  switch (level) {
    case "debug":
      return chalk.white.bold.bgCyan(label);
    case "info":
      return chalk.white.bold.bgGreen(label);
    case "warn":
      return chalk.white.bold.bgYellow(label);
    case "error":
      return chalk.white.bold.bgRed(label);
  }
}

const SCOPE_WIDTH = 6;

function scope_markup(scope: string): string {
  return chalk.magenta(scope.padEnd(SCOPE_WIDTH));
}

function emit(
  level: LogLevel,
  scope: string,
  msg: string,
  ctx?: unknown,
): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[configured_level]) return;
  const pipe = chalk.dim("│");
  const head = `${timestamp()}  ${level_markup(level)} ${
    scope_markup(scope)
  } ${pipe}`;
  const ctx_str = format_context(ctx);
  const line = ctx_str ? `${head} ${msg}${ctx_str}` : `${head} ${msg}`;
  sink(line);
}

export function create_logger(scope: string): Logger {
  return {
    debug: (msg, ctx) => emit("debug", scope, msg, ctx),
    info: (msg, ctx) => emit("info", scope, msg, ctx),
    warn: (msg, ctx) => emit("warn", scope, msg, ctx),
    error: (msg, ctx) => emit("error", scope, msg, ctx),
  };
}

export function print_banner(
  title: string,
  rows: Array<[string, string]>,
): void {
  const label_w = rows.length === 0
    ? 0
    : Math.max(...rows.map(([l]) => l.length));
  const value_w = rows.length === 0
    ? 0
    : Math.max(...rows.map(([, v]) => v.length));
  const inner_w = Math.max(title.length + 4, label_w + 2 + value_w);
  const top = chalk.dim("╭─ ") + chalk.cyan.bold(title) + chalk.dim(
    " " + "─".repeat(Math.max(0, inner_w - title.length - 1)) + "╮",
  );
  const bottom = chalk.dim(
    "╰" + "─".repeat(inner_w + 2) + "╯",
  );
  const body = rows.map(([label, value]) => {
    const pane = `${label.padEnd(label_w)}  ${value}`;
    const pad = " ".repeat(Math.max(0, inner_w - pane.length));
    return chalk.dim("│ ") + pane + pad + chalk.dim(" │");
  });
  for (const line of [top, ...body, bottom]) sink(line);
}
