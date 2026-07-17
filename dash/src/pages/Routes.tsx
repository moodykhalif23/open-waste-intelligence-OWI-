import { useCallback, useEffect, useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AltRouteOutlined from "@mui/icons-material/AltRouteOutlined";
import BuildIcon from "@mui/icons-material/Build";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import LocalShippingOutlined from "@mui/icons-material/LocalShippingOutlined";
import RouteOutlined from "@mui/icons-material/RouteOutlined";
import LocalGasStationOutlined from "@mui/icons-material/LocalGasStationOutlined";
import { api } from "../api";
import { CATEGORICAL } from "../components/EChart";
import { DataTable, type GridColDef } from "../components/DataTable";
import MapView, { type MapLine, type MapPoint } from "../components/MapView";
import {
  EmptyState,
  ErrorPanel,
  Muted,
  PageHeader,
  PageSkeleton,
  PageStack,
  SectionCard,
  StatCard,
  TableSection,
} from "../components/ui";
import { useI18n, type StringKey } from "../i18n";

interface Truck {
  id: string;
  name: string;
  method: string;
  capacity_kg: number;
  fuel_l_per_100km: number;
}

interface MethodSpec {
  method: string;
  motorized: boolean;
  default_capacity_kg: number;
  default_fuel_l_per_100km: number;
}

interface Stop {
  seq: number;
  bin_id: string;
  qr_code: string;
  lat: number;
  lng: number;
}

interface Route {
  id: string;
  truck_id: string;
  truck_name: string;
  method: string;
  planned_km: number;
  planned_fuel_l: number;
  demand_kg: number;
  bins_served: number;
  stops: Stop[];
}

interface ScenarioFacts {
  km: number;
  tonnes: number;
  fuel_l: number;
  bins: number;
}

interface Savings {
  baseline: ScenarioFacts;
  optimized: ScenarioFacts;
  baseline_km_per_tonne: number | null;
  optimized_km_per_tonne: number | null;
  km_per_tonne_reduction_pct: number | null;
  fuel_l_saved: number;
  kes_saved: number | null;
}

export default function Routes() {
  const { t } = useI18n();
  const [trucks, setTrucks] = useState<Truck[] | null>(null);
  const [methods, setMethods] = useState<MethodSpec[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const [savings, setSavings] = useState<Savings | null>(null);
  const [savingsBusy, setSavingsBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);

  const announce = (planned: Route[]) => {
    const stops = planned.reduce((s, r) => s + r.stops.length, 0);
    setToast(stops > 0 ? `${t("routesPlanned")} · ${stops} ${t("stops")}` : t("noBinsDue"));
  };

  const reload = useCallback(async () => {
    const [tk, rt, ms] = await Promise.all([
      api<Truck[]>("/api/v1/trucks"),
      api<Route[]>("/api/v1/routes"),
      api<MethodSpec[]>("/api/v1/collection-methods"),
    ]);
    setTrucks(tk);
    setRoutes(rt);
    setMethods(ms);
  }, []);

  // Initial load + retry: catches into loadError so reload() itself keeps
  // throwing for callers with their own error UI (e.g. TruckForm).
  const load = useCallback(() => {
    setLoadError(null);
    reload().catch((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, [reload]);

  useEffect(() => {
    load();
  }, [load]);

  async function replan(disableTruckId?: string) {
    setPlanning(true);
    setError(null);
    try {
      const planned = await api<Route[]>("/api/v1/routes/replan", {
        method: "POST",
        body: JSON.stringify(disableTruckId ? { disable_truck_ids: [disableTruckId] } : {}),
      });
      setRoutes(planned);
      announce(planned);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setToast(msg);
    } finally {
      setPlanning(false);
    }
  }

  async function loadSavings() {
    setSavingsBusy(true);
    setError(null);
    try {
      setSavings(await api<Savings>("/api/v1/routes/savings"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingsBusy(false);
    }
  }

  if (loadError) {
    return (
      <PageStack>
        <ErrorPanel message={t("errorLoad")} retryLabel={t("retry")} onRetry={load} />
      </PageStack>
    );
  }

  if (trucks === null) return <PageSkeleton />;

  const totalKm = routes.reduce((s, r) => s + r.planned_km, 0);
  const totalFuel = routes.reduce((s, r) => s + r.planned_fuel_l, 0);

  const routeColor = (i: number) => CATEGORICAL[i % CATEGORICAL.length] ?? "#101828";
  const mapPoints: MapPoint[] = routes.flatMap((r, i) =>
    r.stops.map((s) => ({ lat: s.lat, lng: s.lng, color: routeColor(i), label: `${r.truck_name} · #${s.seq} ${s.qr_code}` })),
  );
  const mapLines: MapLine[] = routes
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.stops.length > 1)
    .map(({ r, i }) => ({
      color: routeColor(i),
      points: [...r.stops].sort((a, b) => a.seq - b.seq).map((s) => [s.lat, s.lng] as [number, number]),
    }));

  const methodLabel = (m: string) => t(`method_${m}` as StringKey);

  const truckCols: GridColDef<Truck>[] = [
    { field: "name", headerName: t("name"), flex: 1, minWidth: 120 },
    { field: "method", headerName: t("method"), minWidth: 110, valueFormatter: (v) => methodLabel(v) },
    { field: "capacity_kg", headerName: t("capacityKg"), type: "number", width: 120 },
    { field: "fuel_l_per_100km", headerName: t("fuelUse"), type: "number", flex: 1, minWidth: 120, valueFormatter: (v) => (v > 0 ? `${v} L/100km` : "—") },
  ];

  const routesAction = (
    <Stack direction="row" spacing={1.5}>
      {routes.length > 0 && (
        <Button variant="outlined" size="small" disabled={planning} onClick={() => void replan()}>
          {t("replan")}
        </Button>
      )}
      <Button
        variant="contained"
        size="small"
        color="primary"
        disabled={planning}
        onClick={() => setPlanOpen(true)}
      >
        {t("planToday")}
      </Button>
    </Stack>
  );

  const savingsAction = (
    <Button variant="outlined" size="small" disabled={savingsBusy} onClick={() => void loadSavings()}>
      {savingsBusy ? t("calculating") : t("calcSavings")}
    </Button>
  );

  return (
    <PageStack>
      <PageHeader description={t("savingsHint")} action={routesAction} />

      <Grid container spacing={{ xs: 2, md: 2.5 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard
            label={t("binsToCollect")}
            value={routes.reduce((s, r) => s + r.bins_served, 0)}
            icon={<DeleteOutlineOutlined />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard label={t("plannedKm")} value={Math.round(totalKm * 10) / 10} icon={<RouteOutlined />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard label={t("plannedFuelL")} value={Math.round(totalFuel * 10) / 10} icon={<LocalGasStationOutlined />} />
        </Grid>
      </Grid>

      <SectionCard title={t("todaysRoutes")}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {mapPoints.length > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <MapView points={mapPoints} lines={mapLines} height={360} />
          </Box>
        )}
        {routes.length === 0 ? (
          <EmptyState icon={<AltRouteOutlined />} title={t("noRoutes")} />
        ) : (
          <Grid container spacing={{ xs: 2, md: 2.5 }}>
            {[...routes]
              .sort((a, b) => b.stops.length - a.stops.length)
              .map((route) => (
                <Grid size={{ xs: 12, md: route.stops.length === 0 ? 6 : 12, lg: 6 }} key={route.id}>
                  <RouteCard
                    route={route}
                    methodLabel={methodLabel(route.method)}
                    disabled={planning}
                    breakdownLabel={t("breakdown")}
                    breakdownHint={t("breakdownHint")}
                    stopsLabel={t("stops")}
                    noStopsLabel={t("noStops")}
                    onBreakdown={() => void replan(route.truck_id)}
                  />
                </Grid>
              ))}
          </Grid>
        )}
      </SectionCard>

      <SectionCard title={t("savingsTitle")} action={savingsAction}>
        {savings === null ? (
          <Muted>{t("savingsHint")}</Muted>
        ) : savings.km_per_tonne_reduction_pct === null ? (
          <Muted>{t("savingsNoData")}</Muted>
        ) : (
          <Stack spacing={2.5}>
            <Box>
              <Typography
                sx={{
                  fontWeight: 720,
                  letterSpacing: "-0.02em",
                  fontSize: "2.6rem",
                  lineHeight: 1.05,
                  color: "primary.main",
                }}
              >
                −{savings.km_per_tonne_reduction_pct}%
              </Typography>
              <Muted>{t("kmPerTonneCut")}</Muted>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell />
                    <TableCell>{t("fixedSweep")}</TableCell>
                    <TableCell>{t("needDriven")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>{t("binsVisited")}</TableCell>
                    <TableCell>{savings.baseline.bins}</TableCell>
                    <TableCell>{savings.optimized.bins}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>{t("distanceKm")}</TableCell>
                    <TableCell>{savings.baseline.km}</TableCell>
                    <TableCell>{savings.optimized.km}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>{t("kmPerTonne")}</TableCell>
                    <TableCell>{savings.baseline_km_per_tonne}</TableCell>
                    <TableCell>{savings.optimized_km_per_tonne}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
            <Muted>
              {t("fuelSaved")}: {savings.fuel_l_saved} L
              {savings.kes_saved !== null ? ` · ~KES ${savings.kes_saved}` : ""}. {t("savingsMethod")}
            </Muted>
          </Stack>
        )}
      </SectionCard>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TruckForm methods={methods} methodLabel={methodLabel} onCreated={reload} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TableSection title={t("trucks")}>
            {trucks.length === 0 ? (
              <EmptyState icon={<LocalShippingOutlined />} title={t("noTrucks")} />
            ) : (
              <DataTable rows={trucks} columns={truckCols} toolbar={false} pageSize={5} />
            )}
          </TableSection>
        </Grid>
      </Grid>

      <PlanDialog
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        truckCount={trucks.length}
        onPlanned={(planned) => {
          setRoutes(planned);
          announce(planned);
        }}
        onError={(msg) => setToast(msg)}
      />

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </PageStack>
  );
}

interface HealthRow {
  bin_id: string;
  qr_code: string;
  site_name: string;
  fill_pct: number;
  overflow_risk: "low" | "medium" | "high";
  recommendation: string;
}

const RISK_CHIP = { high: "error", medium: "warning", low: "success" } as const;

// The planning step: admins see the trucks available and the bins due, choose
// which to include, then commit — instead of a blind optimise-and-reload.
function PlanDialog({
  open,
  onClose,
  truckCount,
  onPlanned,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  truckCount: number;
  onPlanned: (routes: Route[]) => void;
  onError: (msg: string) => void;
}) {
  const { t } = useI18n();
  const [due, setDue] = useState<HealthRow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDue(null);
    setErr(null);
    void api<HealthRow[]>("/api/v1/bins/health")
      .then((rows) => {
        const dueRows = rows.filter((r) => r.recommendation !== "no_action");
        setDue(dueRows);
        setSelected(
          new Set(dueRows.filter((r) => r.recommendation === "collect_today").map((r) => r.bin_id)),
        );
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [open]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function confirm() {
    setBusy(true);
    setErr(null);
    try {
      const planned = await api<Route[]>("/api/v1/routes/optimize", {
        method: "POST",
        body: JSON.stringify({ bin_ids: [...selected] }),
      });
      onPlanned(planned);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      onError(msg);
    } finally {
      setBusy(false);
    }
  }

  const riskLabel = (r: HealthRow["overflow_risk"]) =>
    t(r === "high" ? "riskHigh" : r === "medium" ? "riskMedium" : "riskLow");

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("planTitle")}</DialogTitle>
      <DialogContent dividers>
        <Muted>{t("planPick")}</Muted>
        <Stack direction="row" spacing={1} sx={{ my: 2, flexWrap: "wrap", gap: 1 }}>
          <Chip color="secondary" label={`${truckCount} ${t("vehicles")}`} />
          <Chip variant="outlined" label={`${due?.length ?? 0} ${t("binsToCollect")}`} />
          <Chip variant="outlined" label={`${selected.size} ${t("selected")}`} />
        </Stack>
        {err && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {err}
          </Alert>
        )}
        {due === null ? (
          <Muted>{t("loading")}</Muted>
        ) : due.length === 0 ? (
          <Muted>{t("noBinsDue")}</Muted>
        ) : (
          <Box sx={{ maxHeight: 340, overflowY: "auto" }}>
            {due.map((r) => (
              <ListItemButton
                key={r.bin_id}
                onClick={() => toggle(r.bin_id)}
                sx={{ borderRadius: "4px", gap: 1 }}
              >
                <Checkbox edge="start" checked={selected.has(r.bin_id)} tabIndex={-1} disableRipple sx={{ p: 0.5 }} />
                <ListItemText
                  primary={`${r.site_name} · ${r.qr_code}`}
                  secondary={`${Math.round(r.fill_pct)}%`}
                  slotProps={{ primary: { sx: { fontSize: "0.9rem", fontWeight: 550 } } }}
                />
                <Chip size="small" color={RISK_CHIP[r.overflow_risk]} label={riskLabel(r.overflow_risk)} />
              </ListItemButton>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("cancel")}</Button>
        <Button variant="contained" disabled={busy || selected.size === 0} onClick={() => void confirm()}>
          {busy ? t("planning") : `${t("planToday")} · ${selected.size}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function RouteCard({
  route,
  methodLabel,
  disabled,
  breakdownLabel,
  breakdownHint,
  stopsLabel,
  noStopsLabel,
  onBreakdown,
}: {
  route: Route;
  methodLabel: string;
  disabled: boolean;
  breakdownLabel: string;
  breakdownHint: string;
  stopsLabel: string;
  noStopsLabel: string;
  onBreakdown: () => void;
}) {
  const breakdownBtn = (
    <Button
      variant="outlined"
      size="small"
      color="warning"
      startIcon={<BuildIcon />}
      disabled={disabled}
      title={breakdownHint}
      onClick={onBreakdown}
    >
      {breakdownLabel}
    </Button>
  );

  if (route.stops.length === 0) {
    return (
      <Card variant="outlined" sx={{ height: "100%" }}>
        <Box sx={{ p: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" noWrap>
              {route.truck_name}
            </Typography>
            <Muted>{noStopsLabel}</Muted>
          </Box>
          {breakdownBtn}
        </Box>
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <Box sx={{ p: 2, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" noWrap>
            {route.truck_name}
          </Typography>
          <Stack direction="row" sx={{ mt: 1, flexWrap: "wrap", gap: 0.75 }}>
            <Chip size="small" variant="outlined" label={methodLabel} />
            <Chip size="small" color="secondary" label={`${route.bins_served} ${stopsLabel}`} />
            <Chip size="small" variant="outlined" label={`${route.planned_km} km`} />
            {route.planned_fuel_l > 0 && (
              <Chip size="small" variant="outlined" label={`${route.planned_fuel_l} L`} />
            )}
            <Chip size="small" variant="outlined" label={`${Math.round(route.demand_kg)} kg`} />
          </Stack>
        </Box>
        {breakdownBtn}
      </Box>
      <Divider />
      <Box
        sx={{
          p: 2,
          maxHeight: 280,
          overflowY: "auto",
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          columnGap: 2,
          rowGap: 0.5,
        }}
      >
        {route.stops.map((s) => (
          <Stack key={s.bin_id} direction="row" spacing={1.25} sx={{ alignItems: "center", py: 0.5, minWidth: 0 }}>
            <Box
              sx={{
                width: 22,
                height: 22,
                flexShrink: 0,
                borderRadius: "4px",
                bgcolor: "#fbeecf",
                color: "#835a09",
                fontSize: "0.72rem",
                fontWeight: 700,
                display: "grid",
                placeItems: "center",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {s.seq}
            </Box>
            <Typography sx={{ fontFamily: "ui-monospace, monospace", fontSize: "0.85rem" }} noWrap>
              {s.qr_code}
            </Typography>
          </Stack>
        ))}
      </Box>
    </Card>
  );
}

function TruckForm({
  methods,
  methodLabel,
  onCreated,
}: {
  methods: MethodSpec[];
  methodLabel: (m: string) => string;
  onCreated: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [method, setMethod] = useState("truck");
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("2000");
  const [fuel, setFuel] = useState("25");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const spec = methods.find((m) => m.method === method);
  const motorized = spec?.motorized ?? true;

  const pickMethod = (next: string) => {
    setMethod(next);
    const s = methods.find((m) => m.method === next);
    if (s) {
      setCapacity(String(s.default_capacity_kg));
      setFuel(String(s.default_fuel_l_per_100km));
    }
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const depotLat = Number(lat);
    const depotLng = Number(lng);
    if (!Number.isFinite(depotLat) || !Number.isFinite(depotLng)) {
      setErr(`${t("depotLat")} / ${t("depotLng")}`);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api("/api/v1/trucks", {
        method: "POST",
        body: JSON.stringify({
          name,
          method,
          capacity_kg: Number(capacity),
          fuel_l_per_100km: motorized ? Number(fuel) : 0,
          depot_lat: depotLat,
          depot_lng: depotLng,
        }),
      });
      setName("");
      setLat("");
      setLng("");
      await onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard collapsible title={t("addTruck")}>
      <Box component="form" onSubmit={(e) => void onSubmit(e)}>
        <Stack spacing={2}>
          {err && <Alert severity="error">{err}</Alert>}
          <TextField
            size="small"
            fullWidth
            select
            label={t("method")}
            value={method}
            onChange={(e) => pickMethod(e.target.value)}
          >
            {(methods.length > 0 ? methods : [{ method: "truck" } as MethodSpec]).map((m) => (
              <MenuItem key={m.method} value={m.method}>
                {methodLabel(m.method)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            fullWidth
            label={t("name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <TextField
            size="small"
            fullWidth
            type="number"
            label={t("capacityKg")}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            required
            slotProps={{ htmlInput: { min: 1 } }}
          />
          {motorized && (
            <TextField
              size="small"
              fullWidth
              type="number"
              label={t("fuelUse")}
              value={fuel}
              onChange={(e) => setFuel(e.target.value)}
              required
              slotProps={{ htmlInput: { min: 0, step: 0.1 } }}
            />
          )}
          <TextField
            size="small"
            fullWidth
            label={t("depotLat")}
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            required
            slotProps={{ htmlInput: { inputMode: "decimal" } }}
          />
          <TextField
            size="small"
            fullWidth
            label={t("depotLng")}
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            required
            slotProps={{ htmlInput: { inputMode: "decimal" } }}
          />
          <Button variant="contained" color="primary" type="submit" disabled={busy}>
            {t("addTruck")}
          </Button>
        </Stack>
      </Box>
    </SectionCard>
  );
}
