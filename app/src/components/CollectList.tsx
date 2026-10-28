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
import Typography from "@mui/material/Typography";
import CheckCircle from "@mui/icons-material/CheckCircle";
import EChart, { RISK_HUE, ringOption } from "./EChart";
import { t, type Lang, type StringKey } from "../i18n";
import {
  collectStop,
  completeRoute,
  fetchCollectList,
  fetchRoutes,
  markCollected,
  startRoute,
  type BinHealth,
  type Route,
} from "../lib/collect";
import { ApiError } from "../lib/api";
import { distanceKm } from "../lib/gps";

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
  | { kind: "routes"; routes: Route[] }
  | { kind: "list"; bins: BinHealth[] };

export default function CollectList({ lang, token }: { lang: Lang; token: string }) {
  const tr = (key: StringKey, vars?: Record<string, string | number>) => t(lang, key, vars);
  const [state, setState] = useState<Load>({ kind: "loading" });
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
  const lastFix = useRef<{ lat: number; lng: number; accuracy: number } | null>(null);

  const reload = useCallback(async () => {
    if (!token) {
      setState({ kind: "error", message: "tokenMissing" });
      return;
    }
    try {
      const routes = (await fetchRoutes(token)).filter((r) => r.stops.length > 0);
      if (routes.length > 0) return setState({ kind: "routes", routes });
      // No route planned yet — fall back to the raw collect-today list.
      setState({ kind: "list", bins: await fetchCollectList(token) });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.status === 401
            ? "tokenInvalid"
            : error.status === 403
              ? "accessDenied"
              : "loadFailed"
          : "collectOffline";
      setState({ kind: "error", message });
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

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

  async function doStop(stopId: string) {
    try {
      setActionError(false);
      await collectStop(token, stopId);
      await reload();
    } catch {
      setActionError(true);
    }
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
    try {
      setActionError(false);
      const route = await startRoute(token, routeId);
      setTrackingRouteId(route.id);
      setDistance(storedDistance(route.id));
      try {
        window.localStorage.setItem(TRACKING_ROUTE_KEY, route.id);
      } catch {
        setDistanceStorageUnavailable(true);
      }
      lastFix.current = null;
      await reload();
    } catch {
      setActionError(true);
    }
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
    try {
      setActionError(false);
      await completeRoute(token, completeDialogRouteId, {
        actual_distance_km: distance > 0 ? Math.round(distance * 100) / 100 : null,
        actual_fuel_l: actualFuel,
        actual_weight_kg: actualWeight,
      });
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
      await reload();
    } catch {
      setActionError(true);
    }
  }

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
        {state.bins.map((bin) => (
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
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5}>
      {actionError && <Alert severity="error">{tr("routeActionFailed")}</Alert>}
      {state.routes.map((route) => {
        const done = route.stops.filter((s) => s.collected).length;
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
                </Typography>
              </Box>
              {route.status === "planned" && (
                <Button variant="contained" size="small" onClick={() => void doStart(route.id)}>
                  {tr("routeStart")}
                </Button>
              )}
              {route.status === "active" && route.started_by_me && (
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
                      bgcolor: stop.collected ? "primary.main" : "#eceef1",
                      color: stop.collected ? "#fff" : "primary.dark",
                    }}
                  >
                    {stop.seq + 1}
                  </Box>
                  <Typography
                    sx={{
                      flex: 1,
                      fontFamily: "ui-monospace, Consolas, monospace",
                      fontSize: "0.9rem",
                      color: stop.collected ? "text.secondary" : "text.primary",
                      textDecoration: stop.collected ? "line-through" : "none",
                    }}
                  >
                    {stop.qr_code}
                  </Typography>
                  {stop.collected && (
                    <CheckCircle color="primary" aria-label={tr("done")} />
                  )}
                  {!stop.collected && route.status === "active" && route.started_by_me && (
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
    </Stack>
  );
}
