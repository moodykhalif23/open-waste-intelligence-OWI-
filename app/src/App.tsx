import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
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
import Circle from "@mui/icons-material/Circle";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import CloudDoneOutlined from "@mui/icons-material/CloudDoneOutlined";
import CloudUploadOutlined from "@mui/icons-material/CloudUploadOutlined";
import TaskAltOutlined from "@mui/icons-material/TaskAltOutlined";
import WifiOffOutlined from "@mui/icons-material/WifiOffOutlined";
import InstallMobileOutlined from "@mui/icons-material/InstallMobileOutlined";
import LocalShippingOutlined from "@mui/icons-material/LocalShippingOutlined";
import QrCodeScannerOutlined from "@mui/icons-material/QrCodeScannerOutlined";
import InsightsOutlined from "@mui/icons-material/InsightsOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import CollectList from "./components/CollectList";
import Insights from "./components/Insights";
import QrScan from "./components/QrScan";
import SignIn from "./components/SignIn";
import { UNAUTHORIZED_EVENT } from "./lib/api";
import { fetchIdentity } from "./lib/auth";
import { t, type Lang, type StringKey } from "./i18n";
import { compressImage, type QualityWarning } from "./lib/compress";
import { getFix, type GpsFix } from "./lib/gps";
import { FILL_BANDS, enqueue, listQueued, listRouteActions, type FillBand } from "./lib/queue";
import { loadSettings, saveSettings, type AppSettings } from "./lib/settings";
import {
  SyncError,
  discardUnlocatable,
  eraseObservation,
  isLocatable,
  recentSynced,
  syncQueue,
  syncRouteActions,
  type RecentReport,
} from "./lib/sync";

// Chromium-only event; not in lib.dom, so declare the minimal surface we use.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

const INSTALL_DISMISSED_KEY = "owi-install-dismissed";
const BIN_QR_MAX = 64;

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
  const [unlocatable, setUnlocatable] = useState(0);
  const [recent, setRecent] = useState<RecentReport[]>(recentSynced);
  const [online, setOnline] = useState(navigator.onLine);
  const [toast, setToast] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [tab, setTab] = useState<"report" | "collect" | "insights">("report");
  const [routeRevision, setRouteRevision] = useState(0);
  const [expired, setExpired] = useState(false);
  const [pendingRouteActions, setPendingRouteActions] = useState(0);
  const startedAt = useRef<number>(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const lang = settings.lang;
  const tr = useCallback(
    (key: StringKey, vars?: Record<string, string | number>) => t(lang, key, vars),
    [lang],
  );

  const refreshCount = useCallback(async () => {
    const queued = await listQueued();
    setQueueCount(queued.length);
    setUnlocatable(queued.filter((r) => !isLocatable(r)).length);
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const expireSession = useCallback(() => {
    updateSettings({ token: "", crew: null });
    setShowSettings(false);
    setExpired(true);
  }, [updateSettings]);

  const runSync = useCallback(async () => {
    if (!settings.token || !navigator.onLine || (await listQueued()).length === 0) return;
    setToast(tr("syncing"));
    try {
      const outcome = await syncQueue(settings.token);
      if (outcome.rejected > 0) {
        setToast(tr("syncRejected", { n: outcome.rejected, reason: outcome.rejectedReasons[0] ?? "" }));
      } else if (outcome.unlocatable > 0) {
        setToast(tr("syncUnlocatable", { n: outcome.unlocatable }));
      } else {
        setToast(outcome.remaining === 0 ? tr("syncDone") : null);
      }
    } catch (error) {
      if (error instanceof SyncError && error.status === 401) expireSession();
      else setToast(tr("syncFailed"));
    }
    await refreshCount();
    setRecent(recentSynced());
  }, [settings, tr, refreshCount, expireSession]);

  const runRouteSync = useCallback(async () => {
    if (!settings.token || !navigator.onLine) return;
    try {
      const outcome = await syncRouteActions(settings.token);
      if (outcome.unauthorized) expireSession();
      else if (outcome.rejected > 0) setToast(tr("routeActionsRejected", { n: outcome.rejected }));
      if (outcome.sent > 0 || outcome.rejected > 0) setRouteRevision((n) => n + 1);
    } catch {
      setToast(tr("syncFailed"));
    }
    setPendingRouteActions((await listRouteActions().catch(() => [])).length);
  }, [settings, tr, expireSession]);

  async function doErase(id: string) {
    try {
      await eraseObservation(settings.token, id);
      setRecent(recentSynced());
      setToast(tr("photoDeleted"));
    } catch {
      setToast(tr("syncFailed"));
    }
  }

  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, expireSession);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, expireSession);
  }, [expireSession]);

  useEffect(() => {
    if (!settings.token || !online) return;
    let live = true;
    fetchIdentity(settings.token)
      .then((crew) => {
        if (live) updateSettings({ crew });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [settings.token, online, updateSettings]);

  useEffect(() => {
    if (!showSettings) return;
    void refreshCount();
    void listRouteActions()
      .then((actions) => setPendingRouteActions(actions.length))
      .catch(() => undefined);
  }, [showSettings, refreshCount]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const onInstallPrompt = (e: Event) => {
      e.preventDefault();
      if (localStorage.getItem(INSTALL_DISMISSED_KEY)) return;
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onInstallPrompt);
  }, []);

  useEffect(() => {
    void refreshCount();
    void runRouteSync();
    const goOnline = () => {
      setOnline(true);
      void runSync();
      void runRouteSync();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [runSync, runRouteSync, refreshCount]);

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

  async function onDiscardUnlocatable() {
    await discardUnlocatable();
    await refreshCount();
  }

  async function onSave() {
    if (!photo || !locatable) return;
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

  const unsent = queueCount + pendingRouteActions;

  async function sendEverything() {
    await runSync();
    await runRouteSync();
    await refreshCount();
  }

  function signOut() {
    if (unsent > 0) return;
    updateSettings({ token: "", crew: null });
    setShowSettings(false);
    setExpired(false);
    setTab("report");
  }

  const sentToday = recent.filter((r) => isToday(r.at)).length;
  const staged = !scanning && previewUrl !== null;
  const locatable = gps.kind === "fix" || binQr !== null;

  const qualityText =
    warning === "dark"
      ? tr("qualityDark")
      : warning === "bright"
        ? tr("qualityBright")
        : warning === "blurry"
          ? tr("qualityBlurry")
          : null;

  if (!settings.token) {
    return (
      <SignIn
        lang={lang}
        expired={expired}
        onLang={(next) => updateSettings({ lang: next })}
        onSignedIn={(token, crew) => {
          updateSettings({ token, crew });
          setExpired(false);
        }}
      />
    );
  }

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
        <Toolbar sx={{ gap: 1, minHeight: { xs: 56 } }}>
          <Box component="img" src="/icon.svg" alt="" sx={{ width: 28, height: 28, borderRadius: "8px" }} />
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 680, fontSize: "1rem", letterSpacing: "-0.01em", lineHeight: 1.2 }} noWrap>
              {tr("title")}
            </Typography>
            {settings.crew && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.3 }} noWrap>
                {settings.crew.name} · {settings.crew.vehicle?.name ?? tr("noVehicle")}
              </Typography>
            )}
          </Box>
          <Chip
            size="small"
            variant="outlined"
            icon={<Circle sx={{ fontSize: 9 }} />}
            label={online ? tr("online") : tr("offline")}
            sx={{
              fontWeight: 600,
              borderColor: "divider",
              "& .MuiChip-icon": { color: online ? "success.main" : "error.main", ml: 1 },
            }}
          />
          <IconButton
            aria-label={tr("settings")}
            onClick={() => setShowSettings((v) => !v)}
            color={showSettings ? "primary" : "default"}
            sx={{ width: 48, height: 48 }}
          >
            <SettingsOutlined />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="right"
        open={showSettings}
        onClose={() => setShowSettings(false)}
        sx={{ "& .MuiDrawer-paper": { width: { xs: "85%", sm: 360 }, p: 2 } }}
      >
        <Stack spacing={2}>
          <Typography variant="h6">{tr("settings")}</Typography>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              {tr("signedInAs")}
            </Typography>
            <Typography sx={{ fontWeight: 700, mt: 0.25 }}>{settings.crew?.name || "—"}</Typography>
            <Typography variant="body2" color="text.secondary">
              {settings.crew?.vehicle?.name ?? tr("noVehicle")}
            </Typography>
            {unsent > 0 && (
              <Alert
                severity="warning"
                sx={{ mt: 1.5 }}
                action={
                  online ? (
                    <Button color="inherit" size="small" onClick={() => void sendEverything()}>
                      {tr("syncNow")}
                    </Button>
                  ) : undefined
                }
              >
                {tr("signOutBlocked", { n: unsent })}
              </Alert>
            )}
            <Button
              fullWidth
              variant="outlined"
              color="error"
              disabled={unsent > 0}
              onClick={signOut}
              sx={{ mt: 1.5 }}
            >
              {tr("signOut")}
            </Button>
          </Paper>
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
          <Accordion disableGutters elevation={0} sx={{ border: "1px solid", borderColor: "divider", "&:before": { display: "none" } }}>
            <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {tr("advanced")}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <TextField
                size="small"
                fullWidth
                label={tr("deviceToken")}
                value={settings.token}
                onChange={(e) => updateSettings({ token: e.target.value, crew: null })}
              />
            </AccordionDetails>
          </Accordion>
        </Stack>
      </Drawer>

      {!online && queueCount > 0 && (
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: "center",
            mx: 2,
            mt: 2,
            px: 2,
            py: 1.25,
            borderRadius: "14px",
            bgcolor: "#fbeecf",
            color: "#835a09",
            fontSize: "0.9rem",
            fontWeight: 600,
          }}
        >
          <WifiOffOutlined fontSize="small" />
          <span>{tr("queued", { n: queueCount })}</span>
        </Stack>
      )}

      <Box
        key={tab}
        className="rise-stack"
        sx={{ flex: 1, p: 2, pb: 12, display: "flex", flexDirection: "column", gap: 1.5 }}
      >
        <Box sx={{ pt: 0.5, pb: 0.5, display: "flex", justifyContent: "flex-end" }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 540, mt: 0.25 }}>
            {todayLabel(lang)}
          </Typography>
        </Box>
        {tab === "collect" && (
          <CollectList
            lang={lang}
            token={settings.token}
            crew={settings.crew}
            revision={routeRevision}
            onRouteAction={() => void runRouteSync()}
          />
        )}
        {tab === "insights" && <Insights lang={lang} token={settings.token} />}

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
                  setScanning(false);
                  if (code.length > BIN_QR_MAX) {
                    setToast(tr("qrNotBin"));
                    return;
                  }
                  setBinQr(code);
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

            {!scanning && !staged && (
              <Stack spacing={1.5}>
                {binQr && (
                  <Chip
                    size="small"
                    color="success"
                    variant="outlined"
                    label={tr("binLinked", { code: binQr })}
                    sx={{ alignSelf: "flex-start" }}
                  />
                )}
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => fileInput.current?.click()}
                  sx={{ minHeight: 188, borderRadius: "16px", flexDirection: "column", gap: 1.25, px: 2 }}
                >
                  <Box
                    sx={{
                      width: 66,
                      height: 66,
                      borderRadius: "50%",
                      bgcolor: "secondary.main",
                      color: "primary.main",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <PhotoCameraOutlined sx={{ fontSize: 32 }} />
                  </Box>
                  <Typography component="span" sx={{ fontSize: "1.25rem", fontWeight: 720, lineHeight: 1.2 }}>
                    {tr("takePhoto")}
                  </Typography>
                  <Typography component="span" sx={{ fontSize: "0.85rem", fontWeight: 480, color: "#c2c7d0" }}>
                    {tr("captureHint")}
                  </Typography>
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<QrCodeScannerOutlined />}
                  onClick={() => setScanning(true)}
                >
                  {tr("scanBin")}
                </Button>
              </Stack>
            )}

            {staged && (
              <Stack spacing={2}>
                {binQr && (
                  <Chip size="small" color="success" variant="outlined" label={tr("binLinked", { code: binQr })} sx={{ alignSelf: "flex-start" }} />
                )}
                <Box
                  component="img"
                  src={previewUrl ?? undefined}
                  alt=""
                  sx={{ width: "100%", borderRadius: "18px", display: "block" }}
                />
                {qualityText && <Alert severity="warning">{qualityText}</Alert>}
                <Typography variant="body2" color="text.secondary">
                  {gps.kind === "waiting" && tr("gpsWaiting")}
                  {gps.kind === "fix" && tr("gpsAccuracy", { m: Math.round(gps.fix.accuracyM) })}
                  {gps.kind === "failed" && !binQr && tr("gpsFailed")}
                </Typography>
                {gps.kind === "failed" && !binQr && (
                  <Button variant="outlined" startIcon={<QrCodeScannerOutlined />} onClick={() => setScanning(true)}>
                    {tr("scanBin")}
                  </Button>
                )}
                <Typography sx={{ fontWeight: 620 }}>{tr("fillLevel")}</Typography>
                <ToggleButtonGroup
                  fullWidth
                  exclusive
                  value={fillTap}
                  onChange={(_, val: FillBand | null) => val && setFillTap(val)}
                  sx={{ gap: 1, "& .MuiToggleButtonGroup-grouped": { border: "1px solid", borderColor: "divider", borderRadius: "12px !important", minHeight: 56 } }}
                >
                  {FILL_BANDS.map((band) => (
                    <ToggleButton key={band} value={band}>
                      {tr(band)}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
                {/* Sticky keeps Save in one-hand reach on tall phones while a photo is staged. */}
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{
                    position: "sticky",
                    bottom: "calc(64px + env(safe-area-inset-bottom))",
                    bgcolor: "background.default",
                    py: 1,
                    zIndex: 2,
                  }}
                >
                  <Button variant="outlined" sx={{ flex: 1 }} onClick={() => fileInput.current?.click()}>
                    {tr("retake")}
                  </Button>
                  <Button variant="contained" sx={{ flex: 2 }} disabled={!locatable} onClick={() => void onSave()}>
                    {tr("save")}
                  </Button>
                </Stack>
              </Stack>
            )}

            {!scanning && !staged && (
              <>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                  <Widget
                    icon={<CloudUploadOutlined fontSize="small" />}
                    value={queueCount}
                    label={tr("statWaiting")}
                    action={
                      queueCount > 0 ? (
                        <>
                          {queueCount > unlocatable && (
                            <Button
                              fullWidth
                              size="small"
                              variant="contained"
                              disabled={!online}
                              onClick={() => void runSync()}
                              sx={{ mt: 1.5, minHeight: 40 }}
                            >
                              {tr("syncNow")}
                            </Button>
                          )}
                          {unlocatable > 0 && (
                            <>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
                                {tr("unlocatableHint", { n: unlocatable })}
                              </Typography>
                              <Button
                                fullWidth
                                size="small"
                                variant="outlined"
                                color="error"
                                onClick={() => void onDiscardUnlocatable()}
                                sx={{ mt: 1, minHeight: 40 }}
                              >
                                {tr("discard")}
                              </Button>
                            </>
                          )}
                        </>
                      ) : null
                    }
                  />
                  <Widget icon={<TaskAltOutlined fontSize="small" />} value={sentToday} label={tr("statSentToday")} />
                </Box>

                <Paper variant="outlined" sx={{ p: 2 }}>
                  {recent.length === 0 ? (
                    <Stack spacing={0.5} sx={{ alignItems: "center", textAlign: "center", py: 2.5 }}>
                      <Box sx={{ color: "#835a09", display: "grid", placeItems: "center", mb: 1 }}>
                        <CloudDoneOutlined sx={{ fontSize: 40 }} />
                      </Box>
                      <Typography sx={{ fontWeight: 620 }}>{tr("noReports")}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 260 }}>
                        {tr("noReportsHint")}
                      </Typography>
                    </Stack>
                  ) : (
                    <Stack divider={<Divider sx={{ ml: 0 }} />}>
                      {recent.map((r) => (
                        <Stack
                          key={r.id}
                          direction="row"
                          sx={{ alignItems: "center", justifyContent: "space-between", py: 0.75 }}
                        >
                          <Box>
                            <Typography sx={{ fontWeight: 620, fontSize: "0.95rem", fontVariantNumeric: "tabular-nums" }}>
                              {timeLabel(r.at)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem" }}>
                              {isToday(r.at) ? tr("today") : dayLabel(r.at)}
                            </Typography>
                          </Box>
                          <IconButton
                            aria-label={tr("deletePhoto")}
                            title={tr("deletePhoto")}
                            sx={{ width: 48, height: 48 }}
                            disabled={!online}
                            onClick={() => void doErase(r.id)}
                          >
                            <DeleteOutlineOutlined fontSize="small" />
                          </IconButton>
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </Paper>
              </>
            )}
          </>
        )}
      </Box>

      <Paper
        elevation={0}
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          maxWidth: 480,
          mx: "auto",
          borderTop: "1px solid",
          borderLeft: "1px solid",
          borderRight: "1px solid",
          borderColor: "divider",
          borderTopLeftRadius: "20px",
          borderTopRightRadius: "20px",
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          overflow: "hidden",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {installEvt && (
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", px: 2, py: 0.5, borderBottom: "1px solid", borderColor: "divider" }}
          >
            <InstallMobileOutlined fontSize="small" />
            <Typography variant="body2" sx={{ flex: 1, fontWeight: 550 }}>
              {tr("installTitle")}
            </Typography>
            <Button
              variant="contained"
              size="small"
              onClick={() => {
                void installEvt.prompt();
                setInstallEvt(null);
              }}
            >
              {tr("installAction")}
            </Button>
            <IconButton
              aria-label={tr("cancel")}
              sx={{ width: 48, height: 48 }}
              onClick={() => {
                localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
                setInstallEvt(null);
              }}
            >
              <CloseOutlined fontSize="small" />
            </IconButton>
          </Stack>
        )}
        <BottomNavigation
          showLabels
          value={tab}
          onChange={(_, val: "report" | "collect" | "insights") => setTab(val)}
        >
          <BottomNavigationAction value="report" label={tr("tabReport")} icon={<PhotoCameraOutlined />} />
          <BottomNavigationAction value="collect" label={tr("tabCollect")} icon={<LocalShippingOutlined />} />
          <BottomNavigationAction value="insights" label={tr("tabInsights")} icon={<InsightsOutlined />} />
        </BottomNavigation>
      </Paper>

      <Snackbar
        open={!!toast}
        message={toast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: { xs: "calc(80px + env(safe-area-inset-bottom))" } }}
      />
    </Box>
  );
}

function Widget({
  icon,
  value,
  label,
  action,
}: {
  icon: ReactNode;
  value: number;
  label: string;
  action?: ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, minWidth: 0 }}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem", fontWeight: 600 }} noWrap>
          {label}
        </Typography>
        <Box sx={{ color: "text.secondary", display: "grid", placeItems: "center", flexShrink: 0 }}>
          {icon}
        </Box>
      </Stack>
      <Typography sx={{ fontSize: "2rem", fontWeight: 760, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Typography>
      {action}
    </Paper>
  );
}

function todayLabel(lang: Lang): string {
  return new Date().toLocaleDateString(lang === "sw" ? "sw-KE" : "en-KE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" });
}
