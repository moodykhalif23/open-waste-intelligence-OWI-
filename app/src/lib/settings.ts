import type { Lang } from "../i18n";

export interface AppSettings {
  apiUrl: string;
  token: string;
  lang: Lang;
}

const KEY = "owi-settings";

const defaults: AppSettings = {
  apiUrl: import.meta.env.VITE_API_URL ?? "https://localhost:8000",
  token: import.meta.env.VITE_DEVICE_TOKEN ?? "",
  lang: "en",
};

export function loadSettings(): AppSettings {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}
