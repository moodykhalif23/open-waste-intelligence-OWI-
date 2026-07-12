import type { Lang } from "../i18n";

export interface AppSettings {
  apiUrl: string;
  token: string;
  lang: Lang;
}

const KEY = "owi-settings";

const defaults: AppSettings = {
  // Empty = same origin: the dev server (and production reverse proxy) forwards /api.
  apiUrl: import.meta.env.VITE_API_URL ?? "",
  token: import.meta.env.VITE_DEVICE_TOKEN ?? "",
  lang: "en",
};

export function loadSettings(): AppSettings {
  try {
    const settings = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
    // Migrate away the pre-proxy default that pointed at a non-TLS port over https.
    if (settings.apiUrl === "https://localhost:8000") settings.apiUrl = defaults.apiUrl;
    return settings;
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}
