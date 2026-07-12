import type { Lang } from "../i18n";

export interface AppSettings {
  token: string;
  lang: Lang;
}

const KEY = "owi-settings";

const defaults: AppSettings = {
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
