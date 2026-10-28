import { useCallback, useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import CheckCircle from "@mui/icons-material/CheckCircle";
import EChart, { RISK_HUE, ringOption } from "./EChart";
import { t, type Lang, type StringKey } from "../i18n";
import {
  SKIP_REASONS,
  applyRouteActions,
  cacheRoutes,
  cachedRoutes,
  fetchCollectList,
  fetchRoutes,
  markCollected,
  type BinHealth,
  type Route,
  type RouteAction,
  type SkipReason,
} from "../lib/collect";
import { ApiError } from "../lib/api";
import { distanceKm } from "../lib/gps";
import { enqueueRouteAction, listRouteActions } from "../lib/queue";
import { clearRejectedRouteActions, rejectedRouteActions } from "../lib/sync";

const TRACKING_ROUTE_KEY = "owi-tracking-route";

function storedDistance(routeId: string | null): number {
  if (!routeId) return 0;
  try {
    const value = Number(window.localStorage.getItem(`owi-route-km:${routeId}`));
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

type Load =
  | { kind: "loading" }
  | { kind: "error"; message: StringKey }
  | { kind: "routes"; routes: Route[]; notice: StringKey | null }
  | { kind: "list"; bins: BinHealth[] };

const BIN_PAGE = 20;

export default function CollectList({
  lang,
  token,
  revision,
  onRouteAction,
}: {
  lang: Lang;
  token: string;
  revision: number;
  onRouteAction: () => void;
}) {
  const tr = (key: StringKey, vars?: Record<string, string | number>) => t(lang, key, vars);
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [shownBins, setShownBins] = useState(BIN_PAGE);
  const [trackingRouteId, setTrackingRouteId] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(TRACKING_ROUTE_KEY);
    } catch {
      return null;
    }
  });
  const [distance, setDistance] = useState(() => storedDistance(trackingRouteId));
  const [gpsUnavailable, setGpsUnavailable] = useState(false);
  const [distanceStorageUnavailable, setDistanceStorageUnavailable] = useState(false);
  const [completeDialogRouteId, setCompleteDialogRouteId] = useState<string | null>(null);
  const [fuel, setFuel] = useState("");
  const [weight, setWeight] = useState("");
  const [actionError, setActionError] = useState(false);
  const [queued, setQueued] = useState(0);
  const [rejected, setRejected] = useState(rejectedRouteActions);
  const [skipTarget, setSkipTarget] = useState<{ id: string; code: string } | null>(null);
  const [skipReason, setSkipReason] = useState<SkipReason | null>(null);
  const lastFix = useRef<{ lat: number; lng: number; accuracy: number } | null>(null);
  const snapshot = useRef<Route[]>(cachedRoutes());
  const loadSeq = useRef(0);

  const show = useCallback((actions: RouteAction[], notice?: StringKey | null) => {
    const routes = applyRouteActions(snapshot.current, actions).filter((r) => r.stops.length > 0);
    setQueued(actions.length);
    setRejected(rejectedRouteActions());
    if (routes.length === 0) return false;
    setState((prev) => ({
      kind: "routes",
      routes,
      notice: notice === undefined ? (prev.kind === "routes" ? prev.notice : null) : notice,
    }));
    return true;
  }, []);

  const reload = useCallback(async () => {
    if (!token) {
      setState({ kind: "error", message: "tokenMissing" });
      return;
    }
    const seq = ++loadSeq.current;
    const actions = await listRouteActions().catch(() => []);
    if (seq === loadSeq.current) show(actions);
    try {
      const routes = await fetchRoutes(token);
      if (seq !== loadSeq.current) return;
      snapshot.current = routes;
      cacheRoutes(routes);
      if (show(actions, null)) return;
      // No route planned yet — fall back to the raw collect-today list.
      const bins = await fetchCollectList(token);
      if (seq === loadSeq.current) setState({ kind: "list", bins });
    } catch (error) {
      if (seq !== loadSeq.current) return;
      const message =
        error instanceof ApiError
          ? error.status === 401
            ? "tokenInvalid"
            : error.status === 403
              ? "accessDenied"
              : "loadFailed"
          : "collectOffline";
      if (!show(actions, message === "collectOffline" ? "routeSavedOffline" : message)) {
        setState({ kind: "error", message });
      }
    }
  }, [token, show]);

  useEffect(() => {
    void reload();
  }, [reload, revision]);

  useEffect(() => {
    const retryWhenOnline = () => void reload();
    window.addEventListener("online", retryWhenOnline);
    return () => window.removeEventListener("online", retryWhenOnline);
  }, [reload]);

  const trackedRoute =
    state.kind === "routes"
      ? state.routes.find((route) => route.id === trackingRouteId && route.status === "active")
      : undefined;

  useEffect(() => {
    if (!trackedRoute?.started_by_me) return;
    if (!navigator.geolocation) {
      setGpsUnavailable(true);
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        if (coords.accuracy > 50) return;
        const current = {
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
        };
        const previous = lastFix.current;
        if (!previous) {
          lastFix.current = current;
          return;
        }
        const segment = distanceKm(previous, current);
        if (segment > 0.5) {
          lastFix.current = current;
          return;
        }
        const noiseFloorKm = Math.max(
          0.003,
          Math.min(0.015, (previous.accuracy + current.accuracy) / 2000),
        );
        if (segment <= noiseFloorKm) return;
        lastFix.current = current;
        setDistance((total) => {
          const next = total + segment;
          try {
            window.localStorage.setItem(`owi-route-km:${trackedRoute.id}`, String(next));
          } catch {
            setDistanceStorageUnavailable(true);
          }
          return next;
        });
      },
      () => setGpsUnavailable(true),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [trackedRoute?.id, trackedRoute?.started_by_me]);

  async function act(action: RouteAction): Promise<boolean> {
    try {
      setActionError(false);
      await enqueueRouteAction(action);
      loadSeq.current += 1;
      show(await listRouteActions());
      onRouteAction();
      return true;
    } catch {
      setActionError(true);
      return false;
    }
  }

  async function doStop(stopId: string) {
    await act({ kind: "collect", stopId, occurredAt: new Date().toISOString() });
  }

  async function doSkip() {
    if (!skipTarget || !skipReason) return;
    const skipped = await act({
      kind: "skip",
      stopId: skipTarget.id,
      reason: skipReason,
      occurredAt: new Date().toISOString(),
    });
    if (skipped) setSkipTarget(null);
  }

  async function doBin(binId: string) {
    try {
      setActionError(false);
      await markCollected(token, binId);
      await reload();
    } catch {
      setActionError(true);
    }
  }

  async function doStart(routeId: string) {
    if (!(await act({ kind: "start", routeId, occurredAt: new Date().toISOString() }))) return;
    setTrackingRouteId(routeId);
    setDistance(storedDistance(routeId));
    try {
      window.localStorage.setItem(TRACKING_ROUTE_KEY, routeId);
    } catch {
      setDistanceStorageUnavailable(true);
    }
    lastFix.current = null;
  }

  async function doComplete() {
    if (!completeDialogRouteId || fuel.trim() === "" || weight.trim() === "") return;
    const actualFuel = Number(fuel);
    const actualWeight = Number(weight);
    if (
      !Number.isFinite(actualFuel) ||
      actualFuel < 0 ||
      !Number.isFinite(actualWeight) ||
      actualWeight < 0
    ) {
      setActionError(true);
      return;
    }
    const completed = await act({
      kind: "complete",
      routeId: completeDialogRouteId,
      completion: {
        actual_distance_km: distance > 0 ? Math.round(distance * 100) / 100 : null,
        actual_fuel_l: actualFuel,
        actual_weight_kg: actualWeight,
      },
      occurredAt: new Date().toISOString(),
    });
    if (!completed) return;
    try {
      window.localStorage.removeItem(TRACKING_ROUTE_KEY);
      window.localStorage.removeItem(`owi-route-km:${completeDialogRouteId}`);
    } catch {
      setDistanceStorageUnavailable(true);
    }
    setTrackingRouteId(null);
    setDistance(0);
    setCompleteDialogRouteId(null);
    setFuel("");
    setWeight("");
    lastFix.current = null;
  }

  const reasonLabel = (reason: string) =>
    (SKIP_REASONS as readonly string[]).includes(reason)
      ? tr(`skipReason_${reason}` as StringKey)
      : reason;

  if (state.kind === "loading")
    return <Typography variant="body2" color="text.secondary">{tr("loading")}</Typography>;
  if (state.kind === "error")
    return (
      <Alert
        severity="warning"
        action={<Button color="inherit" size="small" onClick={() => void reload()}>{tr("retry")}</Button>}
      >
        {tr(state.message)}
      </Alert>
    );

  if (state.kind === "list") {
    if (state.bins.length === 0)
      return <Typography variant="body2" color="text.secondary">{tr("collectNone")}</Typography>;
    return (
      <Stack divider={<Divider />}>
        {actionError && <Alert severity="error">{tr("routeActionFailed")}</Alert>}
        {state.bins.slice(0, shownBins).map((bin) => (
          <Stack
            key={bin.bin_id}
            direction="row"
            spacing={1.5}
            sx={{ alignItems: "center", py: 1.5 }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Box
                  sx={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, bgcolor: RISK_HUE[bin.overflow_risk] }}
                  aria-hidden
                />
                <Typography sx={{ fontWeight: 600, fontSize: "0.92rem" }} noWrap>
                  {bin.site_name} · {bin.qr_code}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {Math.round(bin.fill_pct)}% ·{" "}
                {bin.recommendation === "collect_today" ? tr("collectNow") : tr("collectSoon")}
              </Typography>
            </Box>
            <Button variant="contained" size="small" onClick={() => void doBin(bin.bin_id)}>
              {tr("done")}
            </Button>
          </Stack>
        ))}
        {state.bins.length > shownBins && (
          <Button variant="outlined" onClick={() => setShownBins((n) => n + BIN_PAGE)} sx={{ mt: 1.5 }}>
            {tr("insightsShowMore", { n: Math.min(BIN_PAGE, state.bins.length - shownBins) })}
          </Button>
        )}
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5}>
      {state.notice && (
        <Alert severity={state.notice === "routeSavedOffline" ? "info" : "warning"}>
          {tr(state.notice)}
        </Alert>
      )}
      {rejected > 0 && (
        <Alert
          severity="warning"
          onClose={() => {
            clearRejectedRouteActions();
            setRejected(0);
          }}
        >
          {tr("routeActionsRejected", { n: rejected })}
        </Alert>
      )}
      {queued > 0 && <Alert severity="info">{tr("routeQueued", { n: queued })}</Alert>}
      {actionError && <Alert severity="error">{tr("routeActionFailed")}</Alert>}
      {state.routes.map((route) => {
        const skipped = route.stops.filter((s) => s.skipped).length;
        const done = route.stops.filter((s) => s.collected).length + skipped;
        const actionable = route.status === "active" && route.started_by_me;
        return (
          <Box key={route.id}>
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ alignItems: "center", justifyContent: "space-between", pb: 1.25, mb: 1.25, borderBottom: "1px solid", borderColor: "divider" }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 660 }} noWrap>
                  {route.truck_name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {tr(`method_${route.method}` as StringKey)} · {route.planned_km} km ·{" "}
                  {route.stops.length} {tr("stopsShort")}
                  {skipped > 0 && ` · ${skipped} ${tr("skippedShort")}`}
                </Typography>
              </Box>
              {route.status === "planned" && (
                <Button variant="contained" size="small" onClick={() => void doStart(route.id)}>
                  {tr("routeStart")}
                </Button>
              )}
              {actionable && (
                <Stack sx={{ alignItems: "flex-end" }} spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    {tr("routeTracking")} · {distance.toFixed(2)} km
                  </Typography>
                  <Button
                    variant="contained"
                    size="small"
                    disabled={done !== route.stops.length}
                    onClick={() => {
                      setCompleteDialogRouteId(route.id);
                      setFuel(
                        ["handcart", "bicycle", "on_foot"].includes(route.method) ? "0" : "",
                      );
                    }}
                  >
                    {tr("routeCompleteAction")}
                  </Button>
                </Stack>
              )}
              {route.status === "active" && !route.started_by_me && (
                <Typography variant="caption" color="text.secondary">
                  {tr("routeActiveOther")}
                </Typography>
              )}
              <Box sx={{ width: 54, height: 54, flexShrink: 0 }}>
                <EChart height={54} option={ringOption(done, route.stops.length)} />
              </Box>
            </Stack>
            {route.status === "done" && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
                {tr("routeDistance")}: {route.actual_distance_km ?? "—"} · {tr("routeFuel")}:{" "}
                {route.actual_fuel_l ?? "—"} · {tr("routeWeight")}: {route.actual_weight_kg ?? "—"}
              </Typography>
            )}
            {route.id === trackingRouteId && gpsUnavailable && (
              <Alert severity="info" sx={{ mb: 1.25 }}>{tr("routeGpsUnavailable")}</Alert>
            )}
            {route.id === trackingRouteId && distanceStorageUnavailable && (
              <Alert severity="info" sx={{ mb: 1.25 }}>
                {tr("routeDistanceStorageUnavailable")}
              </Alert>
            )}
            <Stack spacing={1}>
              {route.stops.map((stop) => (
                <Stack key={stop.id} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                  <Box
                    sx={{
                      width: 26,
                      height: 26,
                      flexShrink: 0,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.82rem",
                      fontWeight: 650,
                      bgcolor: stop.collected
                        ? "primary.main"
                        : stop.skipped
                          ? "secondary.light"
                          : "#eceef1",
                      color: stop.collected ? "#fff" : stop.skipped ? "secondary.dark" : "primary.dark",
                    }}
                  >
                    {stop.seq + 1}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontFamily: "ui-monospace, Consolas, monospace",
                        fontSize: "0.9rem",
                        color: stop.collected || stop.skipped ? "text.secondary" : "text.primary",
                        textDecoration: stop.collected ? "line-through" : "none",
                      }}
                    >
                      {stop.qr_code}
                    </Typography>
                    {stop.skipped && (
                      <Typography
                        variant="caption"
                        sx={{ display: "block", color: "secondary.dark", fontWeight: 600 }}
                      >
                        {tr("routeSkipped")}
                        {stop.skip_reason ? ` · ${reasonLabel(stop.skip_reason)}` : ""}
                      </Typography>
                    )}
                  </Box>
                  {stop.collected && (
                    <CheckCircle color="primary" aria-label={tr("done")} />
                  )}
                  {!stop.collected && !stop.skipped && actionable && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => {
                        setSkipTarget({ id: stop.id, code: stop.qr_code });
                        setSkipReason(null);
                      }}
                    >
                      {tr("routeSkip")}
                    </Button>
                  )}
                  {!stop.collected && actionable && (
                    <Button variant="contained" size="small" onClick={() => void doStop(stop.id)}>
                      {tr("done")}
                    </Button>
                  )}
                </Stack>
              ))}
            </Stack>
          </Box>
        );
      })}
      <Dialog
        open={completeDialogRouteId !== null}
        onClose={() => setCompleteDialogRouteId(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{tr("routeCompleteTitle")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {tr("routeCompleteHint")}
          </Typography>
          <Stack spacing={2}>
            <TextField
              label={tr("routeDistance")}
              value={distance.toFixed(2)}
              type="number"
              slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next) && next >= 0) setDistance(next);
              }}
            />
            <TextField
              label={tr("routeFuel")}
              value={fuel}
              type="number"
              required
              slotProps={{ htmlInput: { min: 0, step: 0.1 } }}
              onChange={(event) => setFuel(event.target.value)}
            />
            <TextField
              label={tr("routeWeight")}
              value={weight}
              type="number"
              required
              slotProps={{ htmlInput: { min: 0, step: 0.1 } }}
              onChange={(event) => setWeight(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompleteDialogRouteId(null)}>{tr("cancel")}</Button>
          <Button
            variant="contained"
            disabled={fuel.trim() === "" || weight.trim() === ""}
            onClick={() => void doComplete()}
          >
            {tr("routeCompleteAction")}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={skipTarget !== null} onClose={() => setSkipTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>{tr("routeSkipTitle", { code: skipTarget?.code ?? "" })}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {tr("routeSkipHint")}
          </Typography>
          <ToggleButtonGroup
            orientation="vertical"
            fullWidth
            exclusive
            value={skipReason}
            onChange={(_, value: SkipReason | null) => value && setSkipReason(value)}
            sx={{ "& .MuiToggleButton-root": { minHeight: 48, justifyContent: "flex-start" } }}
          >
            {SKIP_REASONS.map((reason) => (
              <ToggleButton key={reason} value={reason}>
                {tr(`skipReason_${reason}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSkipTarget(null)}>{tr("cancel")}</Button>
          <Button variant="contained" disabled={skipReason === null} onClick={() => void doSkip()}>
            {tr("routeSkip")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
