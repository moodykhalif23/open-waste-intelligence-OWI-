import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import AddOutlined from "@mui/icons-material/AddOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Checkbox from "@mui/material/Checkbox";
import Collapse from "@mui/material/Collapse";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import ListItemButton from "@mui/material/ListItemButton";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AltRouteOutlined from "@mui/icons-material/AltRouteOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import LocalShippingOutlined from "@mui/icons-material/LocalShippingOutlined";
import { api, type User } from "../api";
import { SERIES } from "../components/EChart";
import { DataTable, type GridColDef } from "../components/DataTable";
import MapView, { type MapLine, type MapPoint } from "../components/MapView";
import {
  CodeLabel,
  EmptyState,
  ErrorPanel,
  GAP,
  InlineStat,
  MapFrame,
  Kicker,
  Muted,
  PageSkeleton,
  PageStack,
  SearchField,
  SectionCard,
  Tag,
  TableSection,
  type Tone,
} from "../components/ui";
import { useI18n, type StringKey } from "../i18n";
import { owi } from "../theme";
interface CrewMember {
  id: string;
  name: string;
  phone: string | null;
}

interface Truck {
  id: string;
  name: string;
  method: string;
  capacity_kg: number;
  fuel_l_per_100km: number;
  crew: CrewMember[];
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
  collected: boolean;
  skipped: boolean;
  skip_reason: string | null;
}

const SKIP_REASONS = ["blocked", "missing", "damaged", "other"];

interface Route {
  id: string;
  truck_id: string;
  truck_name: string;
  method: string;
  planned_km: number;
  planned_fuel_l: number;
  demand_kg: number;
  bins_served: number;
  status: "planned" | "active" | "done";
  actual_distance_km: number | null;
  actual_duration_seconds: number | null;
  actual_fuel_l: number | null;
  actual_weight_kg: number | null;
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
  const [truckOpen, setTruckOpen] = useState(false);
  const [openRoute, setOpenRoute] = useState<string | null>(null);
  const [crewTruck, setCrewTruck] = useState<Truck | null>(null);

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
      if (planned.length === 0) {
        await reload();
        setToast(t("routeComplete"));
        return;
      }
      await reload();
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

  const colorOf = useMemo(
    () => new Map(routes.map((r, i) => [r.id, SERIES[i % SERIES.length] ?? owi.ink])),
    [routes],
  );

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
  const hasPendingStops = routes.some((route) =>
    route.stops.some((stop) => !stop.collected && !stop.skipped),
  );

  const routeColor = (r: Route) => colorOf.get(r.id) ?? owi.ink;
  const mapPoints: MapPoint[] = routes.flatMap((r) =>
    r.stops.map((s) => ({ lat: s.lat, lng: s.lng, color: routeColor(r), label: `${r.truck_name} · #${s.seq} ${s.qr_code}` })),
  );
  const mapLines: MapLine[] = routes
    .filter((r) => r.stops.length > 1)
    .map((r) => ({
      color: routeColor(r),
      points: [...r.stops].sort((a, b) => a.seq - b.seq).map((s) => [s.lat, s.lng] as [number, number]),
    }));

  const methodLabel = (m: string) => t(`method_${m}` as StringKey);

  const truckCols: GridColDef<Truck>[] = [
    { field: "name", headerName: t("name"), flex: 1, minWidth: 120, renderCell: (p) => <CodeLabel>{p.value as string}</CodeLabel> },
    { field: "method", headerName: t("method"), minWidth: 100, flex: 0.8, valueFormatter: (v) => methodLabel(v) },
    { field: "capacity_kg", headerName: t("capacityKg"), type: "number", width: 120, valueFormatter: (v) => Number(v).toLocaleString() },
    { field: "fuel_l_per_100km", headerName: t("fuelUse"), type: "number", width: 130, valueFormatter: (v) => (v > 0 ? `${v} L/100km` : "—") },
    {
      field: "crew",
      headerName: t("crew"),
      flex: 1.6,
      minWidth: 200,
      sortable: false,
      valueGetter: (_v, row) => row.crew.map((c) => c.name).join(", "),
      renderCell: (p) =>
        p.row.crew.length > 0 ? (
          <Typography noWrap sx={{ fontSize: "0.88rem", color: owi.inkSoft, lineHeight: "inherit" }} title={p.value as string}>
            {p.value as string}
          </Typography>
        ) : (
          <Typography sx={{ fontSize: "0.88rem", color: "text.secondary", lineHeight: "inherit" }}>{t("noCrew")}</Typography>
        ),
    },
    {
      field: "assign",
      headerName: "",
      width: 140,
      sortable: false,
      filterable: false,
      disableExport: true,
      align: "right",
      renderCell: (p) => (
        <Button variant="text" size="small" onClick={() => setCrewTruck(p.row)}>
          {t("assignCrew")}
        </Button>
      ),
    },
  ];

  const routesAction = (
    <>
      {routes.length > 0 && (
        <Button variant="outlined" disabled={planning} onClick={() => void replan()}>
          {t("replan")}
        </Button>
      )}
      <Button
        variant="contained"
        color="primary"
        disabled={planning || hasPendingStops}
        onClick={() => setPlanOpen(true)}
      >
        {planning ? t("planning") : t("planToday")}
      </Button>
    </>
  );

  const savingsAction = (
    <Button variant="outlined" size="small" disabled={savingsBusy} onClick={() => void loadSavings()}>
      {savingsBusy ? t("calculating") : t("calcSavings")}
    </Button>
  );

  const sorted = [...routes].sort((a, b) => b.stops.length - a.stops.length);
  const dash = (v: number) => (routes.length === 0 ? "—" : (Math.round(v * 10) / 10).toLocaleString());

  return (
    <PageStack>
      <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 3, md: 5 }, flexWrap: "wrap" }}>
        <InlineStat label={t("binsToCollect")} value={routes.reduce((s, r) => s + r.bins_served, 0).toLocaleString()} />
        <InlineStat label={t("plannedKm")} value={dash(totalKm)} />
        <InlineStat label={t("plannedFuelL")} value={dash(totalFuel)} />
        <Box sx={{ ml: "auto", display: "flex", gap: 1.25, flexWrap: "wrap" }}>{routesAction}</Box>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {routes.length === 0 ? (
        <SectionCard title={t("todaysRoutes")}>
          <EmptyState icon={<AltRouteOutlined />} title={t("noRoutes")} />
        </SectionCard>
      ) : (
        <Grid container spacing={GAP}>
          <Grid size={{ xs: 12, lg: 7 }}>
            {mapPoints.length > 0 ? (
              <MapFrame>
                <MapView points={mapPoints} lines={mapLines} height={480} />
              </MapFrame>
            ) : (
              <SectionCard>
                <EmptyState icon={<AltRouteOutlined />} title={t("noStops")} height={420} />
              </SectionCard>
            )}
          </Grid>
          <Grid size={{ xs: 12, lg: 5 }}>
            <SectionCard title={t("todaysRoutes")} hint={`${routes.length}`}>
              <Box sx={{ mx: -1, maxHeight: { lg: 404 }, overflowY: "auto" }}>
                {sorted.map((route) => (
                  <RouteRow
                    key={route.id}
                    route={route}
                    color={routeColor(route)}
                    open={openRoute === route.id}
                    onToggle={() => setOpenRoute((cur) => (cur === route.id ? null : route.id))}
                    methodLabel={methodLabel(route.method)}
                    disabled={planning || !hasPendingStops}
                    onBreakdown={() => void replan(route.truck_id)}
                  />
                ))}
              </Box>
            </SectionCard>
          </Grid>
        </Grid>
      )}

      <Grid container spacing={GAP} sx={{ alignItems: "flex-start" }}>
        <Grid size={{ xs: 12 }}>
          <SectionCard title={t("savingsTitle")} action={savingsAction}>
            {savings === null ? (
              <Muted>{t("savingsHint")}</Muted>
            ) : savings.km_per_tonne_reduction_pct === null ? (
              <Muted>{t("savingsNoData")}</Muted>
            ) : (
              <Stack spacing={2.25}>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
                  <Typography
                    sx={{
                      fontWeight: 760,
                      letterSpacing: "-0.02em",
                      fontSize: "2.2rem",
                      lineHeight: 1.05,
                      color: owi.ok,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    −{savings.km_per_tonne_reduction_pct}%
                  </Typography>
                  <Muted>{t("kmPerTonneCut")}</Muted>
                </Box>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    columnGap: 3,
                    rowGap: 1.1,
                    alignItems: "baseline",
                    fontSize: "0.94rem",
                    color: owi.inkSoft,
                    "& b": { color: owi.ink, textAlign: "right", fontWeight: 660, fontVariantNumeric: "tabular-nums" },
                  }}
                >
                  <span />
                  <Kicker sx={{ textAlign: "right" }}>{t("fixedSweep")}</Kicker>
                  <Kicker sx={{ textAlign: "right" }}>{t("needDriven")}</Kicker>
                  <span>{t("binsVisited")}</span>
                  <b>{savings.baseline.bins.toLocaleString()}</b>
                  <b>{savings.optimized.bins.toLocaleString()}</b>
                  <span>{t("distanceKm")}</span>
                  <b>{savings.baseline.km.toLocaleString()}</b>
                  <b>{savings.optimized.km.toLocaleString()}</b>
                  <span>{t("kmPerTonne")}</span>
                  <b>{savings.baseline_km_per_tonne ?? "—"}</b>
                  <b>{savings.optimized_km_per_tonne ?? "—"}</b>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.86rem" }}>
                  {t("fuelSaved")}: {savings.fuel_l_saved} L
                  {savings.kes_saved !== null ? ` · ~KES ${savings.kes_saved.toLocaleString()}` : ""}. {t("savingsMethod")}
                </Typography>
              </Stack>
            )}
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TableSection
            title={t("trucks")}
            hint={trucks.length > 0 ? `${trucks.length}` : undefined}
            action={
              <Button variant="outlined" size="small" startIcon={<AddOutlined />} onClick={() => setTruckOpen(true)}>
                {t("addTruck")}
              </Button>
            }
          >
            {trucks.length === 0 ? (
              <SectionCard>
                <EmptyState icon={<LocalShippingOutlined />} title={t("noTrucks")} />
              </SectionCard>
            ) : (
              <DataTable rows={trucks} columns={truckCols} toolbar={false} pageSize={10} />
            )}
          </TableSection>
        </Grid>
      </Grid>

      <CrewDialog
        truck={crewTruck}
        trucks={trucks}
        onClose={() => setCrewTruck(null)}
        onSaved={async () => {
          await reload();
          setToast(t("crewSaved"));
        }}
      />

      <TruckForm
        open={truckOpen}
        onClose={() => setTruckOpen(false)}
        methods={methods}
        methodLabel={methodLabel}
        onCreated={reload}
      />

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

const RISK_TONE: Record<HealthRow["overflow_risk"], Tone> = { high: "bad", medium: "warn", low: "ok" };

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
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setDue(null);
    setErr(null);
    setQuery("");
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
  const q = query.trim().toLowerCase();
  const shown = (due ?? []).filter(
    (r) => !q || r.qr_code.toLowerCase().includes(q) || r.site_name.toLowerCase().includes(q),
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("planTitle")}</DialogTitle>
      <DialogContent dividers>
        <Muted>{t("planPick")}</Muted>
        <Box sx={{ display: "flex", gap: 1, my: 2, flexWrap: "wrap", alignItems: "center" }}>
          <Tag tone="gold">{`${truckCount} ${t("vehicles")}`}</Tag>
          <Tag>{`${(due?.length ?? 0).toLocaleString()} ${t("binsToCollect")}`}</Tag>
          <Tag>{`${selected.size.toLocaleString()} ${t("selected")}`}</Tag>
        </Box>
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
          <>
            {due.length > 8 && (
              <Box sx={{ mb: 1.5 }}>
                <SearchField value={query} onChange={setQuery} placeholder={t("searchBins")} width="100%" />
              </Box>
            )}
            <Box sx={{ maxHeight: 340, overflowY: "auto", mx: -1 }}>
              {shown.map((r) => (
                <ListItemButton
                  key={r.bin_id}
                  onClick={() => toggle(r.bin_id)}
                  sx={{ gap: 1.25, mx: 0, py: 0.75 }}
                >
                  <Checkbox edge="start" checked={selected.has(r.bin_id)} tabIndex={-1} disableRipple sx={{ p: 0.5 }} />
                  <Box sx={{ minWidth: 0, flex: 1, display: "flex", gap: 1.25, alignItems: "baseline", fontSize: "0.9rem" }}>
                    <CodeLabel>{r.qr_code}</CodeLabel>
                    <Typography noWrap sx={{ fontSize: "0.88rem", color: owi.inkSoft, minWidth: 0 }}>
                      {r.site_name}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: "0.84rem", color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>
                    {Math.round(r.fill_pct)}%
                  </Typography>
                  <Tag tone={RISK_TONE[r.overflow_risk]}>{riskLabel(r.overflow_risk)}</Tag>
                </ListItemButton>
              ))}
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>{t("cancel")}</Button>
        <Button variant="contained" disabled={busy || selected.size === 0} onClick={() => void confirm()}>
          {busy ? t("planning") : `${t("planToday")} · ${selected.size}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function RouteRow({
  route,
  color,
  open,
  onToggle,
  methodLabel,
  disabled,
  onBreakdown,
}: {
  route: Route;
  color: string;
  open: boolean;
  onToggle: () => void;
  methodLabel: string;
  disabled: boolean;
  onBreakdown: () => void;
}) {
  const { t } = useI18n();
  const rowRef = useRef<HTMLDivElement>(null);
  const empty = route.stops.length === 0;
  const hasPendingStops = route.stops.some((stop) => !stop.collected && !stop.skipped);
  const skipped = route.stops.filter((stop) => stop.skipped).length;
  const reasonLabel = (reason: string) =>
    SKIP_REASONS.includes(reason) ? t(`skipReason_${reason}` as StringKey) : reason;
  const meta = empty
    ? t("noStops")
    : [
        `${route.bins_served} ${t("stops")}`,
        `${route.planned_km} km`,
        route.planned_fuel_l > 0 ? `${route.planned_fuel_l} L` : `${Math.round(route.demand_kg).toLocaleString()} kg`,
      ]
        .filter(Boolean)
        .join(" · ");

  return (
    <Box ref={rowRef} sx={{ borderTop: "1px solid", borderColor: owi.rule, "&:first-of-type": { borderTop: 0 } }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          alignItems: "center",
          gap: 1,
          px: 1,
          borderRadius: "10px",
          bgcolor: open ? owi.wash : "transparent",
        }}
      >
        <ButtonBase
          onClick={onToggle}
          disabled={empty}
          aria-expanded={open}
          sx={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            alignItems: "center",
            gap: 1.5,
            py: 1.25,
            textAlign: "left",
            justifyContent: "stretch",
            borderRadius: "10px",
            minWidth: 0,
          }}
        >
          <Box sx={{ width: 6, height: 36, borderRadius: 999, bgcolor: color, opacity: empty ? 0.35 : 1 }} />
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ fontWeight: 680, color: "text.primary", fontSize: "0.98rem" }}>
                {route.truck_name}
              </Typography>
              <Typography noWrap sx={{ color: "text.secondary", fontSize: "0.82rem", flexShrink: 0 }}>
                {methodLabel}
              </Typography>
            </Box>
            <Typography sx={{ color: owi.inkSoft, fontSize: "0.86rem", fontVariantNumeric: "tabular-nums" }}>
              {meta}
              {skipped > 0 && (
                <Box component="span" sx={{ color: owi.bad, fontWeight: 620 }}>{` · ${skipped} ${t("stopsSkipped")}`}</Box>
              )}
            </Typography>
          </Box>
          {!empty && (
            <ExpandMoreOutlined
              sx={{ color: "text.secondary", fontSize: 20, transition: "transform 160ms", transform: open ? "rotate(180deg)" : "none" }}
            />
          )}
        </ButtonBase>
        <Button
          variant="outlined"
          size="small"
          color="error"
          disabled={disabled}
          title={t("breakdownHint")}
          onClick={onBreakdown}
          sx={{ borderColor: owi.badLine, px: 1.25, minWidth: 0 }}
        >
          {t("breakdown")}
        </Button>
      </Box>
      <Collapse
        in={open}
        unmountOnExit
        onEntered={() => rowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })}
      >
        <Box sx={{ px: 2.5, pb: 2, pt: 1 }}>
          <Typography sx={{ color: "text.secondary", fontSize: "0.84rem", mb: 1.25, fontVariantNumeric: "tabular-nums" }}>
            {[
              `${route.planned_km} km`,
              route.planned_fuel_l > 0 ? `${route.planned_fuel_l} L` : null,
              `${Math.round(route.demand_kg).toLocaleString()} kg`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Typography>
          {!hasPendingStops && (
            <Typography sx={{ color: "text.secondary", fontSize: "0.84rem", mb: 1.25 }}>{t("routeComplete")}</Typography>
          )}
          {route.status === "done" && (
            <Box sx={{ mb: 1.75 }}>
              <Kicker sx={{ mb: 0.75 }}>{t("actualOutcomes")}</Kicker>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  columnGap: 2,
                  rowGap: 0.6,
                  alignItems: "baseline",
                  fontSize: "0.88rem",
                  color: owi.inkSoft,
                  "& b": { color: owi.ink, textAlign: "right", fontWeight: 660, fontVariantNumeric: "tabular-nums" },
                  "& em": { color: "text.secondary", fontStyle: "normal", fontSize: "0.82rem" },
                }}
              >
                <span>{t("distanceKm")}</span>
                <b>{route.actual_distance_km ?? "—"}</b>
                <em>{`${t("planned")} ${route.planned_km}`}</em>
                <span>{t("actualFuel")} (L)</span>
                <b>{route.actual_fuel_l ?? "—"}</b>
                <em>{`${t("planned")} ${route.planned_fuel_l}`}</em>
                <span>{t("weighedWaste")} (kg)</span>
                <b>{route.actual_weight_kg?.toLocaleString() ?? "—"}</b>
                <em>
                  {route.actual_duration_seconds !== null ? `${Math.round(route.actual_duration_seconds / 60)} min` : ""}
                </em>
              </Box>
            </Box>
          )}
          <Kicker sx={{ mb: 0.5 }}>{t("stopsTitle")}</Kicker>
          <Box
            sx={{
              maxHeight: 220,
              overflowY: "auto",
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              columnGap: 2,
            }}
          >
            {[...route.stops]
              .sort((a, b) => a.seq - b.seq)
              .map((s) => (
                <Box
                  key={s.bin_id}
                  sx={{ display: "flex", alignItems: "baseline", gap: 1, py: 0.4, minWidth: 0, gridColumn: s.skipped ? "1 / -1" : "auto" }}
                >
                  <Typography
                    sx={{ width: 22, flexShrink: 0, color: "text.secondary", fontSize: "0.78rem", fontVariantNumeric: "tabular-nums", textAlign: "right" }}
                  >
                    {s.seq}
                  </Typography>
                  <Typography
                    noWrap
                    sx={{
                      fontSize: "0.86rem",
                      fontWeight: 600,
                      color: s.skipped ? "text.secondary" : "text.primary",
                      textDecoration: s.collected ? "line-through" : "none",
                      textDecorationColor: owi.stroke,
                    }}
                  >
                    {s.qr_code}
                  </Typography>
                  {s.skipped && (
                    <Typography
                      variant="caption"
                      title={s.skip_reason ?? undefined}
                      sx={{ color: "error.main", fontWeight: 640, minWidth: 0 }}
                      noWrap
                    >
                      {t("stopSkipped")}
                      {s.skip_reason ? ` · ${reasonLabel(s.skip_reason)}` : ""}
                    </Typography>
                  )}
                </Box>
              ))}
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}

function CrewDialog({
  truck,
  trucks,
  onClose,
  onSaved,
}: {
  truck: Truck | null;
  trucks: Truck[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [collectors, setCollectors] = useState<User[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!truck) return;
    setSelected(new Set(truck.crew.map((c) => c.id)));
    setQuery("");
    setErr(null);
    setCollectors(null);
    api<User[]>("/api/v1/users")
      .then((users) => setCollectors(users.filter((u) => u.role === "collector")))
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, [truck]);

  const vehicleOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const tk of trucks) for (const member of tk.crew) map.set(member.id, tk.name);
    return map;
  }, [trucks]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const onTruck = new Set((truck?.crew ?? []).map((c) => c.id));
    return (collectors ?? [])
      .filter((u) => !q || u.name.toLowerCase().includes(q) || (u.phone ?? "").includes(q))
      .sort((a, b) => Number(onTruck.has(b.id)) - Number(onTruck.has(a.id)) || a.name.localeCompare(b.name));
  }, [collectors, query, truck]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function save() {
    if (!truck) return;
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/v1/trucks/${truck.id}/crew`, {
        method: "PUT",
        body: JSON.stringify({ user_ids: [...selected] }),
      });
      await onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={truck !== null} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t("assignCrew")}
        {truck && (
          <Typography component="span" sx={{ display: "block", color: "text.secondary", fontWeight: 500, fontSize: "0.92rem", mt: 0.25 }}>
            {truck.name}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Muted>{t("crewHint")}</Muted>
          <SearchField value={query} onChange={setQuery} placeholder={t("searchCrew")} width="100%" />
          {err && <Alert severity="error">{err}</Alert>}
          {collectors === null ? (
            <Muted>{t("loading")}</Muted>
          ) : shown.length === 0 ? (
            <Muted>{t("noCollectors")}</Muted>
          ) : (
            <Box sx={{ maxHeight: 360, overflowY: "auto", mx: -1 }}>
              {shown.map((u) => {
                const current = vehicleOf.get(u.id);
                const elsewhere = current !== undefined && current !== truck?.name;
                return (
                  <ListItemButton key={u.id} onClick={() => toggle(u.id)} sx={{ gap: 1.25, py: 0.75 }}>
                    <Checkbox edge="start" checked={selected.has(u.id)} tabIndex={-1} disableRipple sx={{ p: 0.5 }} />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography noWrap sx={{ fontSize: "0.92rem", fontWeight: 600 }}>
                        {u.name}
                      </Typography>
                      <Typography noWrap sx={{ fontSize: "0.82rem", color: "text.secondary" }}>
                        {u.phone ?? "—"}
                      </Typography>
                    </Box>
                    {elsewhere && <Tag tone={selected.has(u.id) ? "warn" : "neutral"}>{t("crewOnVehicle").replace("{vehicle}", current)}</Tag>}
                  </ListItemButton>
                );
              })}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("cancel")}</Button>
        <Button variant="contained" disabled={busy || collectors === null} onClick={() => void save()}>
          {t("saveCrew").replace("{n}", String(selected.size))}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function TruckForm({
  open,
  onClose,
  methods,
  methodLabel,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
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
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("addTruck")}</DialogTitle>
      <DialogContent dividers>
        <Box id="truck-form" component="form" onSubmit={(e) => void onSubmit(e)}>
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
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("close")}</Button>
        <Button variant="contained" color="primary" type="submit" disabled={busy} form="truck-form">
          {busy ? t("creating") : t("addTruck")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
