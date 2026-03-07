const CSP_NONCE = document.currentScript?.nonce || "";
const SAMPLE_ART_URL = "/assets/sample-art.jpg";

let sample_art_base64 = null;

async function fetch_sample_art() {
  if (sample_art_base64) return sample_art_base64;
  try {
    const response = await fetch(SAMPLE_ART_URL);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(",")[1];
        sample_art_base64 = base64;
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const DEFAULT_THEME = {
  width: 800,
  height: 200,
  textPrimary: "#fafafa",
  textSecondary: "#cbd5e1",
  textMuted: "#94a3b8",
  albumSize: 150,
  borderRadius: 16,
  albumPosition: "left",
  textAlign: "left",
  showStatus: true,
  showTitle: true,
  showArtist: true,
  showAlbum: true,
  fontTitleFamily: "DotGothic16",
  fontBodyFamily: "Space Mono",
  fontTitleWeight: 400,
  fontBodyWeight: 400,
  fontFallback: "'Segoe UI', sans-serif",
  visualisation: "waveform",
};

const DEFAULT_DATA = {
  title: "Resonance",
  artist: "HOME",
  album: "Odyssey",
  status: "playing",
  artBase64: null,
  colors: {
    dominant: "#2a1f3d",
    accent: "#332550",
    highlight: "#e67ab2",
  },
  updatedAt: Date.now(),
};

const card_bg_row = document.getElementById("cardBgRow");
const card_bg_color = document.getElementById("cardBgColor");
const card_bg_value = document.getElementById("cardBgValue");
const card_bg_clear = document.getElementById("cardBgClear");
const card_border_row = document.getElementById("cardBorderRow");
const card_border_color = document.getElementById("cardBorderColor");
const card_border_value = document.getElementById("cardBorderValue");
const card_border_clear = document.getElementById("cardBorderClear");
const theme_editor = document.getElementById("themeEditor");
const data_editor = document.getElementById("dataEditor");
const svg_preview = document.getElementById("svgPreview");
const json_error = document.getElementById("jsonError");
const status_dot = document.getElementById("statusDot");
const status_text = document.getElementById("statusText");
const status_select = document.getElementById("statusSelect");
const vis_select = document.getElementById("visSelect");
const show_status = document.getElementById("showStatus");
const show_title = document.getElementById("showTitle");
const show_artist = document.getElementById("showArtist");
const show_album = document.getElementById("showAlbum");
const album_position = document.getElementById("albumPosition");
const text_align_el = document.getElementById("textAlign");
const upload_btn = document.getElementById("uploadBtn");
const art_file_input = document.getElementById("artFileInput");
const reset_btn = document.getElementById("resetBtn");
const export_btn = document.getElementById("exportBtn");
const tab_theme = document.getElementById("tabTheme");
const tab_data = document.getElementById("tabData");

let debounce_timer = null;
let syncing = false;
let _active_tab = "theme";

const DANGEROUS_ELEMENTS = new Set([
  "script",
  "foreignobject",
  "iframe",
  "object",
  "embed",
  "math",
  "annotation-xml",
]);

const URI_ATTRS = new Set([
  "href",
  "xlink:href",
  "src",
  "action",
  "formaction",
]);

function normalize_uri(val) {
  // deno-lint-ignore no-control-regex
  return val.replace(/[\s\x00-\x1f]+/g, "").toLowerCase();
}

function has_dangerous_uri(val) {
  const norm = normalize_uri(val);
  if (/^(javascript|vbscript):/.test(norm)) return true;
  if (norm.startsWith("data:") && !/^data:image\//.test(norm)) {
    return true;
  }
  return false;
}

function has_dangerous_style(val) {
  const norm = val.replace(/\s+/g, "").toLowerCase();
  if (/expression\s*\(/.test(norm)) return true;
  if (/url\s*\(\s*(["']?)\s*javascript:/i.test(norm)) return true;
  if (/-moz-binding/.test(norm)) return true;
  return false;
}

function sanitize_element(el) {
  for (const child of [...el.children]) {
    if (DANGEROUS_ELEMENTS.has(child.tagName.toLowerCase())) {
      child.remove();
      continue;
    }
    for (const attr of [...child.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) {
        child.removeAttribute(attr.name);
      } else if (URI_ATTRS.has(name) && has_dangerous_uri(attr.value)) {
        child.removeAttribute(attr.name);
      } else if (name === "style" && has_dangerous_style(attr.value)) {
        child.removeAttribute(attr.name);
      }
    }
    sanitize_element(child);
  }
}

function sanitize_svg(raw) {
  const doc = new DOMParser().parseFromString(raw, "image/svg+xml");
  const error_node = doc.querySelector("parsererror");
  if (error_node) return null;

  const svg = doc.documentElement;
  if (svg.tagName !== "svg") return null;

  for (const attr of [...svg.attributes]) {
    const name = attr.name.toLowerCase();
    if (name.startsWith("on")) {
      svg.removeAttribute(attr.name);
    } else if (URI_ATTRS.has(name) && has_dangerous_uri(attr.value)) {
      svg.removeAttribute(attr.name);
    }
  }

  sanitize_element(svg);

  return document.importNode(svg, true);
}

function switch_tab(tab) {
  _active_tab = tab;
  tab_theme.classList.toggle("active", tab === "theme");
  tab_data.classList.toggle("active", tab === "data");
  theme_editor.classList.toggle("hidden", tab !== "theme");
  data_editor.classList.toggle("hidden", tab !== "data");
}

tab_theme.addEventListener("click", () => switch_tab("theme"));
tab_data.addEventListener("click", () => switch_tab("data"));

function parse_editor(textarea) {
  try {
    const parsed = JSON.parse(textarea.value);
    json_error.textContent = "";
    return parsed;
  } catch (e) {
    json_error.textContent = e.message;
    return null;
  }
}

function set_editor_value(textarea, obj) {
  textarea.value = JSON.stringify(obj, null, 2);
}

function get_theme_from_editor() {
  return parse_editor(theme_editor);
}

function get_data_from_editor() {
  return parse_editor(data_editor);
}

function set_color_active(row, input, value_el, clear_btn, hex) {
  row.classList.remove("inactive");
  input.value = hex;
  value_el.textContent = hex;
  clear_btn.classList.remove("hidden");
}

function set_color_inactive(row, _input, value_el, clear_btn) {
  row.classList.add("inactive");
  value_el.textContent = "auto";
  clear_btn.classList.add("hidden");
}

function sync_controls_from_theme(theme) {
  if (!theme) return;
  syncing = true;
  if (theme.visualisation) vis_select.value = theme.visualisation;
  if (typeof theme.showStatus === "boolean") {
    show_status.checked = theme.showStatus;
  }
  if (typeof theme.showTitle === "boolean") {
    show_title.checked = theme.showTitle;
  }
  if (typeof theme.showArtist === "boolean") {
    show_artist.checked = theme.showArtist;
  }
  if (typeof theme.showAlbum === "boolean") {
    show_album.checked = theme.showAlbum;
  }
  if (theme.albumPosition) {
    album_position.value = theme.albumPosition;
  }
  if (theme.textAlign) text_align_el.value = theme.textAlign;

  if (theme.cardBackground) {
    set_color_active(
      card_bg_row,
      card_bg_color,
      card_bg_value,
      card_bg_clear,
      theme.cardBackground,
    );
  } else {
    set_color_inactive(
      card_bg_row,
      card_bg_color,
      card_bg_value,
      card_bg_clear,
    );
  }
  if (theme.cardBorder) {
    set_color_active(
      card_border_row,
      card_border_color,
      card_border_value,
      card_border_clear,
      theme.cardBorder,
    );
  } else {
    set_color_inactive(
      card_border_row,
      card_border_color,
      card_border_value,
      card_border_clear,
    );
  }

  syncing = false;
}

function apply_controls_to_theme() {
  const theme = get_theme_from_editor();
  if (!theme) return null;
  theme.showStatus = show_status.checked;
  theme.showTitle = show_title.checked;
  theme.showArtist = show_artist.checked;
  theme.showAlbum = show_album.checked;
  theme.albumPosition = album_position.value;
  theme.textAlign = text_align_el.value;
  theme.visualisation = vis_select.value;

  if (!card_bg_row.classList.contains("inactive")) {
    theme.cardBackground = card_bg_color.value;
  } else {
    delete theme.cardBackground;
  }
  if (!card_border_row.classList.contains("inactive")) {
    theme.cardBorder = card_border_color.value;
  } else {
    delete theme.cardBorder;
  }

  set_editor_value(theme_editor, theme);
  return theme;
}

function apply_status_mode(data) {
  const mode = status_select.value;
  if (mode === "playing") {
    data.status = "playing";
    data.updatedAt = Date.now();
  } else if (mode === "last-played") {
    data.status = "last-played";
    data.updatedAt = Date.now();
  }
  return data;
}

function set_status(state, text) {
  status_dot.className = "status-dot " + state;
  status_text.textContent = text;
}

async function render_preview() {
  const theme = get_theme_from_editor();
  const data = get_data_from_editor();
  if (!theme || !data) {
    set_status("error", "Invalid JSON");
    return;
  }

  const mode = status_select.value;
  const send_data = mode === "empty" ? null : apply_status_mode({ ...data });

  set_status("loading", "Rendering...");

  try {
    const res = await fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: send_data,
        config: theme,
        nonce: CSP_NONCE,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      set_status("error", err.error || "Render failed");
      return;
    }

    const svg = await res.text();
    const sanitized = sanitize_svg(svg);
    if (!sanitized) {
      set_status("error", "Invalid SVG response");
      return;
    }
    svg_preview.replaceChildren(sanitized);
    set_status("ok", "Rendered");
  } catch (_e) {
    set_status("error", "Network error");
  }
}

function schedule_render() {
  clearTimeout(debounce_timer);
  debounce_timer = setTimeout(render_preview, 300);
}

theme_editor.addEventListener("input", () => {
  const theme = get_theme_from_editor();
  if (theme) sync_controls_from_theme(theme);
  schedule_render();
});

data_editor.addEventListener("input", schedule_render);

function on_control_change() {
  if (syncing) return;
  apply_controls_to_theme();
  schedule_render();
}

[
  vis_select,
  show_status,
  show_title,
  show_artist,
  show_album,
  album_position,
  text_align_el,
].forEach((el) => el.addEventListener("change", on_control_change));

status_select.addEventListener("change", () => {
  if (!syncing) schedule_render();
});

card_bg_color.addEventListener("input", () => {
  set_color_active(
    card_bg_row,
    card_bg_color,
    card_bg_value,
    card_bg_clear,
    card_bg_color.value,
  );
  if (!syncing) {
    apply_controls_to_theme();
    schedule_render();
  }
});

card_border_color.addEventListener("input", () => {
  set_color_active(
    card_border_row,
    card_border_color,
    card_border_value,
    card_border_clear,
    card_border_color.value,
  );
  if (!syncing) {
    apply_controls_to_theme();
    schedule_render();
  }
});

card_bg_clear.addEventListener("click", () => {
  set_color_inactive(
    card_bg_row,
    card_bg_color,
    card_bg_value,
    card_bg_clear,
  );
  apply_controls_to_theme();
  schedule_render();
});

card_border_clear.addEventListener("click", () => {
  set_color_inactive(
    card_border_row,
    card_border_color,
    card_border_value,
    card_border_clear,
  );
  apply_controls_to_theme();
  schedule_render();
});

upload_btn.addEventListener("click", () => art_file_input.click());

const MAX_ART_SIZE = 5 * 1024 * 1024;

art_file_input.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > MAX_ART_SIZE) {
    set_status("error", "Image exceeds 5 MB limit");
    art_file_input.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const base64 = reader.result.split(",")[1];
    const data = get_data_from_editor();
    if (data) {
      data.artBase64 = base64;
      set_editor_value(data_editor, data);
      schedule_render();
    }
  };
  reader.readAsDataURL(file);
  art_file_input.value = "";
});

export_btn.addEventListener("click", () => {
  const theme = get_theme_from_editor();
  if (!theme) return;
  const json = JSON.stringify(theme, null, 2) + "\n";
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "theme.json";
  a.click();
  URL.revokeObjectURL(url);
});

reset_btn.addEventListener("click", async () => {
  syncing = true;
  status_select.value = "playing";
  vis_select.value = "waveform";
  show_status.checked = true;
  show_title.checked = true;
  show_artist.checked = true;
  show_album.checked = true;
  album_position.value = "left";
  text_align_el.value = "left";
  set_color_inactive(
    card_bg_row,
    card_bg_color,
    card_bg_value,
    card_bg_clear,
  );
  set_color_inactive(
    card_border_row,
    card_border_color,
    card_border_value,
    card_border_clear,
  );
  syncing = false;
  set_editor_value(theme_editor, { ...DEFAULT_THEME });
  const art_value = await fetch_sample_art();
  set_editor_value(data_editor, {
    ...DEFAULT_DATA,
    artBase64: art_value,
    updatedAt: Date.now(),
  });
  schedule_render();
});

async function init() {
  const art_value = await fetch_sample_art();
  set_editor_value(theme_editor, { ...DEFAULT_THEME });
  set_editor_value(data_editor, {
    ...DEFAULT_DATA,
    artBase64: art_value,
    updatedAt: Date.now(),
  });
  sync_controls_from_theme(DEFAULT_THEME);
  render_preview();
}

init();
