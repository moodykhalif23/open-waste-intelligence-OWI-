import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

const strings = {
  en: {
    appName: "OpenWaste Intelligence",
    login: "Sign in",
    phone: "Phone",
    password: "Password",
    loginFailed: "Sign-in failed — check phone and password",
    logout: "Sign out",
    overview: "Overview",
    bins: "Bins",
    reports: "Reports",
    language: "Language",
    totalBins: "Bins registered",
    reports7d: "Reports, last 7 days",
    overflowing7d: "Overflowing, last 7 days",
    reportsPerDay: "Reports per day — last 14 days",
    fillDistribution: "Fill levels — last 7 days",
    empty: "Empty",
    low: "Low",
    half: "Half",
    high: "High",
    overflowing: "Overflowing",
    noData: "No data yet",
    loading: "Loading…",
    site: "Site",
    sites: "Sites",
    newSite: "Add site",
    newBin: "Add bin",
    name: "Name",
    siteType: "Type",
    ward: "Ward",
    qrCode: "QR code",
    volume: "Volume (L)",
    binType: "Bin type",
    lat: "Latitude",
    lng: "Longitude",
    downloadQr: "QR",
    create: "Create",
    capturedAt: "Captured",
    fillTap: "Fill tap",
    source: "Source",
    privacy: "Privacy",
    photo: "Photo",
    view: "View",
    bin: "Bin",
    noBin: "—",
  },
  sw: {
    appName: "OpenWaste Intelligence",
    login: "Ingia",
    phone: "Simu",
    password: "Nenosiri",
    loginFailed: "Imeshindikana kuingia — angalia simu na nenosiri",
    logout: "Toka",
    overview: "Muhtasari",
    bins: "Mapipa",
    reports: "Ripoti",
    language: "Lugha",
    totalBins: "Mapipa yaliyosajiliwa",
    reports7d: "Ripoti, siku 7 zilizopita",
    overflowing7d: "Yaliyofurika, siku 7 zilizopita",
    reportsPerDay: "Ripoti kwa siku — siku 14 zilizopita",
    fillDistribution: "Viwango vya kujaa — siku 7 zilizopita",
    empty: "Tupu",
    low: "Kidogo",
    half: "Nusu",
    high: "Karibu kujaa",
    overflowing: "Limefurika",
    noData: "Hakuna data bado",
    loading: "Inapakia…",
    site: "Eneo",
    sites: "Maeneo",
    newSite: "Ongeza eneo",
    newBin: "Ongeza pipa",
    name: "Jina",
    siteType: "Aina",
    ward: "Wodi",
    qrCode: "Nambari ya QR",
    volume: "Ujazo (L)",
    binType: "Aina ya pipa",
    lat: "Latitudo",
    lng: "Longitudo",
    downloadQr: "QR",
    create: "Unda",
    capturedAt: "Ilipopigwa",
    fillTap: "Kujaa",
    source: "Chanzo",
    privacy: "Faragha",
    photo: "Picha",
    view: "Tazama",
    bin: "Pipa",
    noBin: "—",
  },
} as const;

export type Lang = "en" | "sw";
export type StringKey = keyof (typeof strings)["en"];

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: StringKey) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(
    () => (localStorage.getItem("owi-lang") as Lang | null) ?? "en",
  );
  const setLang = useCallback((next: Lang) => {
    localStorage.setItem("owi-lang", next);
    setLangState(next);
  }, []);
  const t = useCallback((key: StringKey) => strings[lang][key], [lang]);
  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n outside I18nProvider");
  return ctx;
}
