export interface ThemeColors {
  bg: string;
  surface0: string;
  surface1: string;
  surface2: string;
  surface3: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  accentActive: string;
  nowPlaying: string;
  nowPlayingDim: string;
  nowPlayingHover: string;
  nowPlayingGlow: string;
  onAccent: string;
  separator: string;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
}

const CSS_VAR_MAP: Record<keyof ThemeColors, string> = {
  bg: "--bg",
  surface0: "--surface-0",
  surface1: "--surface-1",
  surface2: "--surface-2",
  surface3: "--surface-3",
  border: "--border",
  textPrimary: "--text-primary",
  textSecondary: "--text-secondary",
  textMuted: "--text-muted",
  accent: "--accent",
  accentHover: "--accent-hover",
  accentActive: "--accent-active",
  nowPlaying: "--now-playing",
  nowPlayingDim: "--now-playing-dim",
  nowPlayingHover: "--now-playing-hover",
  nowPlayingGlow: "--now-playing-glow",
  onAccent: "--on-accent",
  separator: "--separator",
};

export const themes: Theme[] = [
  {
    id: "default",
    name: "Default",
    colors: {
      bg: "#080808",
      surface0: "#0c0c0c",
      surface1: "#111111",
      surface2: "#171717",
      surface3: "#222222",
      border: "#1a1a1a",
      textPrimary: "#d4d4d4",
      textSecondary: "#737373",
      textMuted: "#4a4a4a",
      accent: "#2a2a2a",
      accentHover: "#333333",
      accentActive: "#d4d4d4",
      nowPlaying: "#c89b3c",
      nowPlayingDim: "rgba(200, 155, 60, 0.08)",
      nowPlayingHover: "rgba(200, 155, 60, 0.12)",
      nowPlayingGlow: "rgba(200, 155, 60, 0.06)",
      onAccent: "#080808",
      separator: "rgba(255, 255, 255, 0.03)",
    },
  },
  {
    id: "catppuccin-mocha",
    name: "Catppuccin Mocha",
    colors: {
      bg: "#1e1e2e",
      surface0: "#181825",
      surface1: "#313244",
      surface2: "#45475a",
      surface3: "#585b70",
      border: "#313244",
      textPrimary: "#cdd6f4",
      textSecondary: "#a6adc8",
      textMuted: "#6c7086",
      accent: "#45475a",
      accentHover: "#585b70",
      accentActive: "#cdd6f4",
      nowPlaying: "#f9e2af",
      nowPlayingDim: "rgba(249, 226, 175, 0.08)",
      nowPlayingHover: "rgba(249, 226, 175, 0.12)",
      nowPlayingGlow: "rgba(249, 226, 175, 0.06)",
      onAccent: "#1e1e2e",
      separator: "rgba(205, 214, 244, 0.03)",
    },
  },
  {
    id: "nord",
    name: "Nord",
    colors: {
      bg: "#2e3440",
      surface0: "#272c36",
      surface1: "#3b4252",
      surface2: "#434c5e",
      surface3: "#4c566a",
      border: "#3b4252",
      textPrimary: "#eceff4",
      textSecondary: "#d8dee9",
      textMuted: "#616e88",
      accent: "#434c5e",
      accentHover: "#4c566a",
      accentActive: "#eceff4",
      nowPlaying: "#ebcb8b",
      nowPlayingDim: "rgba(235, 203, 139, 0.08)",
      nowPlayingHover: "rgba(235, 203, 139, 0.12)",
      nowPlayingGlow: "rgba(235, 203, 139, 0.06)",
      onAccent: "#2e3440",
      separator: "rgba(236, 239, 244, 0.03)",
    },
  },
  {
    id: "dracula",
    name: "Dracula",
    colors: {
      bg: "#282a36",
      surface0: "#21222c",
      surface1: "#313545",
      surface2: "#3e4357",
      surface3: "#4d5269",
      border: "#313545",
      textPrimary: "#f8f8f2",
      textSecondary: "#bfbfb9",
      textMuted: "#6272a4",
      accent: "#3e4357",
      accentHover: "#4d5269",
      accentActive: "#f8f8f2",
      nowPlaying: "#f1fa8c",
      nowPlayingDim: "rgba(241, 250, 140, 0.08)",
      nowPlayingHover: "rgba(241, 250, 140, 0.12)",
      nowPlayingGlow: "rgba(241, 250, 140, 0.06)",
      onAccent: "#282a36",
      separator: "rgba(248, 248, 242, 0.03)",
    },
  },
  {
    id: "gruvbox-dark",
    name: "Gruvbox Dark",
    colors: {
      bg: "#282828",
      surface0: "#1d2021",
      surface1: "#3c3836",
      surface2: "#504945",
      surface3: "#665c54",
      border: "#3c3836",
      textPrimary: "#ebdbb2",
      textSecondary: "#bdae93",
      textMuted: "#7c6f64",
      accent: "#504945",
      accentHover: "#665c54",
      accentActive: "#ebdbb2",
      nowPlaying: "#fabd2f",
      nowPlayingDim: "rgba(250, 189, 47, 0.08)",
      nowPlayingHover: "rgba(250, 189, 47, 0.12)",
      nowPlayingGlow: "rgba(250, 189, 47, 0.06)",
      onAccent: "#282828",
      separator: "rgba(235, 219, 178, 0.03)",
    },
  },
  {
    id: "rose-pine",
    name: "Rose Pine",
    colors: {
      bg: "#191724",
      surface0: "#1f1d2e",
      surface1: "#26233a",
      surface2: "#2a2740",
      surface3: "#393552",
      border: "#26233a",
      textPrimary: "#e0def4",
      textSecondary: "#908caa",
      textMuted: "#6e6a86",
      accent: "#2a2740",
      accentHover: "#393552",
      accentActive: "#e0def4",
      nowPlaying: "#f6c177",
      nowPlayingDim: "rgba(246, 193, 119, 0.08)",
      nowPlayingHover: "rgba(246, 193, 119, 0.12)",
      nowPlayingGlow: "rgba(246, 193, 119, 0.06)",
      onAccent: "#191724",
      separator: "rgba(224, 222, 244, 0.03)",
    },
  },
  {
    id: "one-dark",
    name: "One Dark",
    colors: {
      bg: "#282c34",
      surface0: "#21252b",
      surface1: "#2c313a",
      surface2: "#353b45",
      surface3: "#3e4451",
      border: "#2c313a",
      textPrimary: "#abb2bf",
      textSecondary: "#848b98",
      textMuted: "#5c6370",
      accent: "#353b45",
      accentHover: "#3e4451",
      accentActive: "#abb2bf",
      nowPlaying: "#e5c07b",
      nowPlayingDim: "rgba(229, 192, 123, 0.08)",
      nowPlayingHover: "rgba(229, 192, 123, 0.12)",
      nowPlayingGlow: "rgba(229, 192, 123, 0.06)",
      onAccent: "#282c34",
      separator: "rgba(171, 178, 191, 0.03)",
    },
  },
  {
    id: "kanagawa",
    name: "Kanagawa",
    colors: {
      bg: "#1f1f28",
      surface0: "#16161d",
      surface1: "#2a2a37",
      surface2: "#363646",
      surface3: "#54546d",
      border: "#2a2a37",
      textPrimary: "#dcd7ba",
      textSecondary: "#c8c093",
      textMuted: "#727169",
      accent: "#363646",
      accentHover: "#54546d",
      accentActive: "#dcd7ba",
      nowPlaying: "#e6c384",
      nowPlayingDim: "rgba(230, 195, 132, 0.08)",
      nowPlayingHover: "rgba(230, 195, 132, 0.12)",
      nowPlayingGlow: "rgba(230, 195, 132, 0.06)",
      onAccent: "#1f1f28",
      separator: "rgba(220, 215, 186, 0.03)",
    },
  },
  {
    id: "everforest-dark",
    name: "Everforest Dark",
    colors: {
      bg: "#2d353b",
      surface0: "#272e33",
      surface1: "#343f44",
      surface2: "#3d484d",
      surface3: "#475258",
      border: "#343f44",
      textPrimary: "#d3c6aa",
      textSecondary: "#a7c080",
      textMuted: "#7a8478",
      accent: "#3d484d",
      accentHover: "#475258",
      accentActive: "#d3c6aa",
      nowPlaying: "#dbbc7f",
      nowPlayingDim: "rgba(219, 188, 127, 0.08)",
      nowPlayingHover: "rgba(219, 188, 127, 0.12)",
      nowPlayingGlow: "rgba(219, 188, 127, 0.06)",
      onAccent: "#2d353b",
      separator: "rgba(211, 198, 170, 0.03)",
    },
  },
];

export function applyTheme(themeId: string): void {
  const theme = themes.find((t) => t.id === themeId) ?? themes[0];
  const root = document.documentElement;

  // Add transition for smooth theme switching
  root.classList.add("theme-transition");

  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
    root.style.setProperty(cssVar, theme.colors[key as keyof ThemeColors]);
  }

  // Remove transition class after animation completes
  const onEnd = () => {
    root.classList.remove("theme-transition");
    root.removeEventListener("transitionend", onEnd);
  };
  root.addEventListener("transitionend", onEnd);
  // Fallback in case transitionend doesn't fire
  setTimeout(() => root.classList.remove("theme-transition"), 400);
}
