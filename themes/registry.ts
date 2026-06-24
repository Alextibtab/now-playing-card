export interface ThemeEntry {
  name: string;
  display_name: string;
  description: string;
}

export const THEME_REGISTRY: readonly ThemeEntry[] = [
  {
    name: "default",
    display_name: "Default",
    description: "Dynamic colors from album art",
  },
  {
    name: "catppuccin_mocha",
    display_name: "Catppuccin Mocha",
    description: "Soothing dark pastels",
  },
  {
    name: "catppuccin_latte",
    display_name: "Catppuccin Latte",
    description: "Warm light pastels",
  },
  {
    name: "gruvbox_dark",
    display_name: "Gruvbox Dark",
    description: "Retro warm dark tones",
  },
  {
    name: "gruvbox_light",
    display_name: "Gruvbox Light",
    description: "Retro warm light tones",
  },
  {
    name: "dracula",
    display_name: "Dracula",
    description: "Dark purple with vivid accents",
  },
  {
    name: "nord",
    display_name: "Nord",
    description: "Cool arctic blue palette",
  },
  {
    name: "tokyo_night",
    display_name: "Tokyo Night",
    description: "Modern dark blue-purple",
  },
  {
    name: "rose_pine",
    display_name: "Rosé Pine",
    description: "Soft elegant dark theme",
  },
];
