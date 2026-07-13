import { useCallback, useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import PhotoCameraOutlined from "@mui/icons-material/PhotoCameraOutlined";
import LocalShippingOutlined from "@mui/icons-material/LocalShippingOutlined";
import QrCodeScannerOutlined from "@mui/icons-material/QrCodeScannerOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import CollectList from "./components/CollectList";
import QrScan from "./components/QrScan";
import { t, type Lang, type StringKey } from "./i18n";
import { compressImage, type QualityWarning } from "./lib/compress";
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
  const [warning, setWarning] = useState<QualityWarning | null>(null);
  const [gps, setGps] = useState<GpsState>({ kind: "waiting" });
  const [binQr, setBinQr] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [fillTap, setFillTap] = useState<FillBand | null>(null);
  const [queueCount, setQueueCount] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [toast, setToast] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [tab, setTab] = useState<"report" | "collect">("report");
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
    const captured = await compressImage(file);
    setPhoto(captured.blob);
    setWarning(captured.warning);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(captured.blob);
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
    setWarning(null);
    await refreshCount();
    void runSync();
  }

  function updateSettings(patch: Partial<AppSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  }

  const qualityText =
    warning === "dark"
      ? tr("qualityDark")
      : warning === "bright"
        ? tr("qualityBright")
        : warning === "blurry"
          ? tr("qualityBlurry")
          : null;

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 480,
        mx: "auto",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
        bgcolor: "background.default",
      }}
    >
      <AppBar position="sticky">
        <Toolbar sx={{ gap: 1 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {tr("title")}
          </Typography>
          <Chip
            size="small"
            color={online ? "success" : "error"}
            variant={online ? "filled" : "outlined"}
            label={online ? tr("online") : tr("offline")}
          />
          <IconButton
            aria-label={tr("settings")}
            onClick={() => setShowSettings((v) => !v)}
            color={showSettings ? "primary" : "default"}
          >
            <SettingsOutlined />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Collapse in={showSettings}>
        <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
          <Stack spacing={2}>
            <TextField
              size="small"
              fullWidth
              label={tr("deviceToken")}
              value={settings.token}
              onChange={(e) => updateSettings({ token: e.target.value })}
            />
            <TextField
              select
              size="small"
              fullWidth
              label={tr("language")}
              value={lang}
              onChange={(e) => updateSettings({ lang: e.target.value as Lang })}
            >
              <MenuItem value="en">English</MenuItem>
              <MenuItem value="sw">Kiswahili</MenuItem>
            </TextField>
          </Stack>
        </Box>
      </Collapse>

      <Box sx={{ flex: 1, p: 2, pb: 10, display: "flex", flexDirection: "column", gap: 2 }}>
        {tab === "collect" && <CollectList lang={lang} token={settings.token} />}

        {tab === "report" && (
          <>
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
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                <Button
                  variant="outlined"
                  startIcon={<QrCodeScannerOutlined />}
                  onClick={() => setScanning(true)}
                >
                  {tr("scanBin")}
                </Button>
                {binQr && <Chip color="success" variant="outlined" label={tr("binLinked", { code: binQr })} />}
              </Stack>
            )}

            {!scanning && previewUrl ? (
              <Stack spacing={2}>
                <Box
                  component="img"
                  src={previewUrl}
                  alt=""
                  sx={{ width: "100%", borderRadius: 3, display: "block" }}
                />
                {qualityText && <Alert severity="warning">{qualityText}</Alert>}
                <Typography variant="body2" color="text.secondary">
                  {gps.kind === "waiting" && tr("gpsWaiting")}
                  {gps.kind === "fix" && tr("gpsAccuracy", { m: Math.round(gps.fix.accuracyM) })}
                  {gps.kind === "failed" && tr("gpsFailed")}
                </Typography>
                <Typography sx={{ fontWeight: 620 }}>{tr("fillLevel")}</Typography>
                <ToggleButtonGroup
                  fullWidth
                  exclusive
                  value={fillTap}
                  onChange={(_, val: FillBand | null) => val && setFillTap(val)}
                  sx={{ gap: 1, "& .MuiToggleButtonGroup-grouped": { border: "1px solid", borderColor: "divider", borderRadius: "12px !important", minHeight: 54 } }}
                >
                  {FILL_BANDS.map((band) => (
                    <ToggleButton key={band} value={band}>
                      {tr(band)}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
                <Stack direction="row" spacing={1.5}>
                  <Button variant="outlined" sx={{ flex: 1 }} onClick={() => fileInput.current?.click()}>
                    {tr("retake")}
                  </Button>
                  <Button variant="contained" sx={{ flex: 2 }} onClick={() => void onSave()}>
                    {tr("save")}
                  </Button>
                </Stack>
              </Stack>
            ) : (
              !scanning && (
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<PhotoCameraOutlined />}
                  onClick={() => fileInput.current?.click()}
                  sx={{ minHeight: 140, fontSize: "1.15rem", borderRadius: 4 }}
                >
                  {tr("takePhoto")}
                </Button>
              )
            )}

            {queueCount > 0 && (
              <Stack
                direction="row"
                sx={{ alignItems: "center", justifyContent: "space-between", pt: 2, borderTop: "1px solid", borderColor: "divider" }}
              >
                <Typography variant="body2" sx={{ fontWeight: 550 }} color="text.secondary">
                  {tr("queued", { n: queueCount })}
                </Typography>
                <Button variant="outlined" size="small" onClick={() => void runSync()} disabled={!online}>
                  {tr("syncNow")}
                </Button>
              </Stack>
            )}
          </>
        )}
      </Box>

      <Paper
        elevation={0}
        sx={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 480, mx: "auto", borderTop: "1px solid", borderColor: "divider" }}
      >
        <BottomNavigation
          showLabels
          value={tab}
          onChange={(_, val: "report" | "collect") => setTab(val)}
        >
          <BottomNavigationAction value="report" label={tr("tabReport")} icon={<PhotoCameraOutlined />} />
          <BottomNavigationAction value="collect" label={tr("tabCollect")} icon={<LocalShippingOutlined />} />
        </BottomNavigation>
      </Paper>

      <Snackbar
        open={!!toast}
        message={toast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: { xs: 80 } }}
      />
    </Box>
  );
}
