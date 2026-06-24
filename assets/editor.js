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
  text_primary: "#fafafa",
  text_secondary: "#cbd5e1",
  text_muted: "#94a3b8",
  album_size: 150,
  border_radius: 16,
  album_position: "left",
  text_align: "left",
  show_status: true,
  show_title: true,
  show_artist: true,
  show_album: true,
  font_title_family: "DotGothic16",
  font_body_family: "Space Mono",
  font_title_weight: 400,
  font_body_weight: 400,
  font_fallback: "'Segoe UI', sans-serif",
  visualisation: "waveform",
};

const DEFAULT_DATA = {
  title: "Resonance",
  artist: "HOME",
  album: "Odyssey",
  status: "playing",
  art_base64: null,
  colors: {
    dominant: "#2a1f3d",
    accent: "#332550",
    highlight: "#e67ab2",
  },
  updated_at: Date.now(),
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
const theme_select = document.getElementById("themeSelect");
const swatch_bg = document.getElementById("swatchBg");
const swatch_primary = document.getElementById("swatchPrimary");
const swatch_secondary = document.getElementById("swatchSecondary");

let debounce_timer = null;
let syncing = false;
let loading_theme = false;
let _active_tab = "theme";
let current_theme_name = "default";

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

function update_swatches(theme) {
  const bg = theme?.card_background || "#0f0f12";
  const primary = theme?.text_primary || "#fafafa";
  const secondary = theme?.text_secondary || "#cbd5e1";
  swatch_bg.style.background = bg;
  swatch_primary.style.background = primary;
  swatch_secondary.style.background = secondary;
}

function sync_controls_from_theme(theme) {
  if (!theme) return;
  syncing = true;
  if (theme.visualisation) vis_select.value = theme.visualisation;
  if (typeof theme.show_status === "boolean") {
    show_status.checked = theme.show_status;
  }
  if (typeof theme.show_title === "boolean") {
    show_title.checked = theme.show_title;
  }
  if (typeof theme.show_artist === "boolean") {
    show_artist.checked = theme.show_artist;
  }
  if (typeof theme.show_album === "boolean") {
    show_album.checked = theme.show_album;
  }
  if (theme.album_position) {
    album_position.value = theme.album_position;
  }
  if (theme.text_align) text_align_el.value = theme.text_align;

  if (theme.card_background) {
    set_color_active(
      card_bg_row,
      card_bg_color,
      card_bg_value,
      card_bg_clear,
      theme.card_background,
    );
  } else {
    set_color_inactive(
      card_bg_row,
      card_bg_color,
      card_bg_value,
      card_bg_clear,
    );
  }
  if (theme.card_border) {
    set_color_active(
      card_border_row,
      card_border_color,
      card_border_value,
      card_border_clear,
      theme.card_border,
    );
  } else {
    set_color_inactive(
      card_border_row,
      card_border_color,
      card_border_value,
      card_border_clear,
    );
  }

  update_swatches(theme);
  syncing = false;
}

function apply_controls_to_theme() {
  const theme = get_theme_from_editor();
  if (!theme) return null;
  theme.show_status = show_status.checked;
  theme.show_title = show_title.checked;
  theme.show_artist = show_artist.checked;
  theme.show_album = show_album.checked;
  theme.album_position = album_position.value;
  theme.text_align = text_align_el.value;
  theme.visualisation = vis_select.value;

  if (!card_bg_row.classList.contains("inactive")) {
    theme.card_background = card_bg_color.value;
  } else {
    delete theme.card_background;
  }
  if (!card_border_row.classList.contains("inactive")) {
    theme.card_border = card_border_color.value;
  } else {
    delete theme.card_border;
  }

  set_editor_value(theme_editor, theme);
  update_swatches(theme);
  return theme;
}

function apply_status_mode(data) {
  const mode = status_select.value;
  if (mode === "playing") {
    data.status = "playing";
    data.updated_at = Date.now();
  } else if (mode === "last-played") {
    data.status = "last-played";
    data.updated_at = Date.now();
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

function mark_custom_theme() {
  if (loading_theme || syncing) return;
  if (current_theme_name !== "__custom__") {
    current_theme_name = "__custom__";
    theme_select.value = "__custom__";
  }
}

theme_editor.addEventListener("input", () => {
  const theme = get_theme_from_editor();
  if (theme) {
    sync_controls_from_theme(theme);
    mark_custom_theme();
  }
  schedule_render();
});

data_editor.addEventListener("input", schedule_render);

function on_control_change() {
  if (syncing) return;
  apply_controls_to_theme();
  mark_custom_theme();
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
    mark_custom_theme();
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
    mark_custom_theme();
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
  mark_custom_theme();
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
  mark_custom_theme();
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
      data.art_base64 = base64;
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

async function load_theme_by_name(name) {
  if (name === "__custom__") return;
  loading_theme = true;
  try {
    const res = await fetch(`/api/themes/${name}`);
    if (!res.ok) {
      set_status("error", "Failed to load theme");
      loading_theme = false;
      return;
    }
    const theme = await res.json();
    set_editor_value(theme_editor, theme);
    sync_controls_from_theme(theme);
    current_theme_name = name;
    theme_select.value = name;
    schedule_render();
  } catch {
    set_status("error", "Failed to load theme");
  }
  loading_theme = false;
}

async function fetch_theme_list() {
  try {
    const res = await fetch("/api/themes");
    if (!res.ok) return;
    const themes = await res.json();
    theme_select.innerHTML = "";
    for (const entry of themes) {
      const opt = document.createElement("option");
      opt.value = entry.name;
      opt.textContent = entry.display_name;
      opt.title = entry.description;
      theme_select.appendChild(opt);
    }
    const custom_opt = document.createElement("option");
    custom_opt.value = "__custom__";
    custom_opt.textContent = "Custom";
    theme_select.appendChild(custom_opt);
    theme_select.value = current_theme_name;
  } catch {
    // keep default option if fetch fails
  }
}

theme_select.addEventListener("change", () => {
  load_theme_by_name(theme_select.value);
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
  current_theme_name = "default";
  theme_select.value = "default";
  set_editor_value(theme_editor, { ...DEFAULT_THEME });
  update_swatches(DEFAULT_THEME);
  const art_value = await fetch_sample_art();
  set_editor_value(data_editor, {
    ...DEFAULT_DATA,
    art_base64: art_value,
    updated_at: Date.now(),
  });
  schedule_render();
});

async function init() {
  const art_promise = fetch_sample_art();
  await fetch_theme_list();
  const art_value = await art_promise;
  set_editor_value(theme_editor, { ...DEFAULT_THEME });
  set_editor_value(data_editor, {
    ...DEFAULT_DATA,
    art_base64: art_value,
    updated_at: Date.now(),
  });
  sync_controls_from_theme(DEFAULT_THEME);
  render_preview();
}

init();
