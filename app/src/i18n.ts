export type Lang = "en" | "sw";

const strings = {
  en: {
    title: "OWI Field Report",
    takePhoto: "Take photo",
    retake: "Retake",
    fillLevel: "How full is the bin?",
    empty: "Empty",
    low: "Low",
    half: "Half",
    high: "High",
    overflowing: "Overflowing",
    save: "Save report",
    saved: "Saved to queue",
    gpsWaiting: "Getting location…",
    gpsAccuracy: "GPS ±{m} m",
    gpsFailed: "No GPS — report saved without location",
    queued: "{n} waiting to send",
    syncNow: "Send now",
    syncing: "Sending…",
    syncDone: "All reports sent",
    syncFailed: "Sending failed — will retry",
    offline: "Offline",
    online: "Online",
    settings: "Settings",
    deviceToken: "Device token",
    language: "Language",
    seconds: "{s}s",
    scanBin: "Scan bin QR",
    binLinked: "Bin {code}",
    manualCode: "Or type the bin code",
    cancel: "Cancel",
    ok: "OK",
    cameraDenied: "Camera unavailable — type the code instead",
  },
  sw: {
    title: "Ripoti ya OWI",
    takePhoto: "Piga picha",
    retake: "Piga tena",
    fillLevel: "Pipa limejaa kiasi gani?",
    empty: "Tupu",
    low: "Kidogo",
    half: "Nusu",
    high: "Karibu kujaa",
    overflowing: "Limefurika",
    save: "Hifadhi ripoti",
    saved: "Imehifadhiwa kwenye foleni",
    gpsWaiting: "Inatafuta mahali…",
    gpsAccuracy: "GPS ±{m} m",
    gpsFailed: "Hakuna GPS — ripoti imehifadhiwa bila mahali",
    queued: "{n} zinasubiri kutumwa",
    syncNow: "Tuma sasa",
    syncing: "Inatuma…",
    syncDone: "Ripoti zote zimetumwa",
    syncFailed: "Kutuma kumeshindikana — itajaribu tena",
    offline: "Nje ya mtandao",
    online: "Mtandaoni",
    settings: "Mipangilio",
    deviceToken: "Tokeni ya kifaa",
    language: "Lugha",
    seconds: "{s}s",
    scanBin: "Skani QR ya pipa",
    binLinked: "Pipa {code}",
    manualCode: "Au andika nambari ya pipa",
    cancel: "Ghairi",
    ok: "Sawa",
    cameraDenied: "Kamera haipatikani — andika nambari",
  },
} as const;

export type StringKey = keyof (typeof strings)["en"];

export function t(lang: Lang, key: StringKey, vars?: Record<string, string | number>): string {
  let text: string = strings[lang][key];
  for (const [name, value] of Object.entries(vars ?? {})) {
    text = text.replace(`{${name}}`, String(value));
  }
  return text;
}
