import { useCallback, useEffect, useRef, useState } from "react";
import QrScan from "./components/QrScan";
import { t, type Lang, type StringKey } from "./i18n";
import { compressImage } from "./lib/compress";
import { getFix, type GpsFix } from "./lib/gps";
import { enqueue, listQueued, type FillBand } from "./lib/queue";
import { loadSettings, saveSettings, type AppSettings } from "./lib/settings";
import { SyncError, syncQueue } from "./lib/sync";

const FILL_BANDS: FillBand[] = ["empty", "low", "half", "high", "overflowing"];

type GpsState = { kind: "waiting" } | { kind: "fix"; fix: GpsFix } | { kind: "failed" };

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [gps, setGps] = useState<GpsState>({ kind: "waiting" });
  const [binQr, setBinQr] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [fillTap, setFillTap] = useState<FillBand | null>(null);
  const [queueCount, setQueueCount] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [toast, setToast] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const startedAt = useRef<number>(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const lang = settings.lang;
  const tr = useCallback(
    (key: StringKey, vars?: Record<string, string | number>) => t(lang, key, vars),
    [lang],
  );

  const refreshCount = useCallback(async () => {
    setQueueCount((await listQueued()).length);
  }, []);

  const runSync = useCallback(async () => {
    if (!navigator.onLine || (await listQueued()).length === 0) return;
    setToast(tr("syncing"));
    try {
      const outcome = await syncQueue(settings.token);
      setToast(outcome.remaining === 0 && outcome.rejected === 0 ? tr("syncDone") : null);
    } catch (error) {
      const unauthorized = error instanceof SyncError && error.status === 401;
      setToast(unauthorized ? tr("tokenInvalid") : tr("syncFailed"));
    }
    await refreshCount();
  }, [settings, tr, refreshCount]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    void refreshCount();
    const goOnline = () => {
      setOnline(true);
      void runSync();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [runSync, refreshCount]);

  async function onPhotoPicked(file: File) {
    startedAt.current = performance.now();
    const compressed = await compressImage(file);
    setPhoto(compressed);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(compressed);
    });
    setGps({ kind: "waiting" });
    const fix = await getFix();
    setGps(fix ? { kind: "fix", fix } : { kind: "failed" });
  }

  async function onSave() {
    if (!photo) return;
    const fix = gps.kind === "fix" ? gps.fix : null;
    await enqueue({
      id: crypto.randomUUID(),
      capturedAt: new Date().toISOString(),
      lat: fix?.lat ?? null,
      lng: fix?.lng ?? null,
      binQr,
      fillTap,
      image: photo,
    });
    const elapsed = Math.round((performance.now() - startedAt.current) / 1000);
    setToast(`${tr("saved")} · ${tr("seconds", { s: elapsed })}`);
    setPhoto(null);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setFillTap(null);
    setBinQr(null);
    await refreshCount();
    void runSync();
  }

  function updateSettings(patch: Partial<AppSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <h1>{tr("title")}</h1>
        <span className={online ? "pill pill-on" : "pill pill-off"}>
          <span className="dot" aria-hidden />
          {online ? tr("online") : tr("offline")}
        </span>
      </header>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onPhotoPicked(file);
          e.target.value = "";
        }}
      />

      {scanning && (
        <QrScan
          onResult={(code) => {
            setBinQr(code);
            setScanning(false);
          }}
          onCancel={() => setScanning(false)}
          labels={{
            manual: tr("manualCode"),
            cancel: tr("cancel"),
            ok: tr("ok"),
            cameraDenied: tr("cameraDenied"),
          }}
        />
      )}

      {!scanning && (
        <div className="binbar">
          <button className="secondary" onClick={() => setScanning(true)}>
            <QrIcon />
            {tr("scanBin")}
          </button>
          {binQr && <span className="chip">{tr("binLinked", { code: binQr })}</span>}
        </div>
      )}

      {!scanning && previewUrl ? (
        <section className="capture">
          <img src={previewUrl} alt="" className="preview" />
          <p className="gps">
            {gps.kind === "waiting" && tr("gpsWaiting")}
            {gps.kind === "fix" && tr("gpsAccuracy", { m: Math.round(gps.fix.accuracyM) })}
            {gps.kind === "failed" && tr("gpsFailed")}
          </p>
          <p className="label">{tr("fillLevel")}</p>
          <div className="bands">
            {FILL_BANDS.map((band) => (
              <button
                key={band}
                className={fillTap === band ? "band band-active" : "band"}
                onClick={() => setFillTap(band)}
              >
                {tr(band)}
              </button>
            ))}
          </div>
          <div className="actions">
            <button className="secondary" onClick={() => fileInput.current?.click()}>
              {tr("retake")}
            </button>
            <button className="primary" onClick={() => void onSave()}>
              {tr("save")}
            </button>
          </div>
        </section>
      ) : (
        !scanning && (
          <button className="primary big" onClick={() => fileInput.current?.click()}>
            <CameraIcon />
            {tr("takePhoto")}
          </button>
        )
      )}

      {queueCount > 0 && (
        <section className="queue">
          <span>{tr("queued", { n: queueCount })}</span>
          <button className="secondary" onClick={() => void runSync()} disabled={!online}>
            {tr("syncNow")}
          </button>
        </section>
      )}

      {toast && <p className="toast">{toast}</p>}

      <footer>
        <button className="linklike" onClick={() => setShowSettings((v) => !v)}>
          {tr("settings")}
        </button>
        {showSettings && (
          <div className="settings">
            <label>
              {tr("deviceToken")}
              <input
                value={settings.token}
                onChange={(e) => updateSettings({ token: e.target.value })}
              />
            </label>
            <label>
              {tr("language")}
              <select
                value={lang}
                onChange={(e) => updateSettings({ lang: e.target.value as Lang })}
              >
                <option value="en">English</option>
                <option value="sw">Kiswahili</option>
              </select>
            </label>
          </div>
        )}
      </footer>
    </main>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 7h3l2-2.5h6L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <path d="M14 14h3v3h3v3h-6z" />
    </svg>
  );
}
