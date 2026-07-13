import { useCallback, useEffect, useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
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
import BuildIcon from "@mui/icons-material/Build";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import RouteOutlined from "@mui/icons-material/RouteOutlined";
import LocalGasStationOutlined from "@mui/icons-material/LocalGasStationOutlined";
import { api } from "../api";
import { DataTable, type GridColDef } from "../components/DataTable";
import { Muted, PageHeader, PageStack, Panel, SectionCard, StatCard } from "../components/ui";
import { useI18n } from "../i18n";

interface Truck {
  id: string;
  name: string;
  capacity_kg: number;
  fuel_l_per_100km: number;
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
  const [routes, setRoutes] = useState<Route[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const [savings, setSavings] = useState<Savings | null>(null);
  const [savingsBusy, setSavingsBusy] = useState(false);

  const reload = useCallback(async () => {
    const [tk, rt] = await Promise.all([
      api<Truck[]>("/api/v1/trucks"),
      api<Route[]>("/api/v1/routes"),
    ]);
    setTrucks(tk);
    setRoutes(rt);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function planToday() {
    setPlanning(true);
    setError(null);
    try {
      const planned = await api<Route[]>("/api/v1/routes/optimize", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setRoutes(planned);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPlanning(false);
    }
  }

  async function replan(disableTruckId?: string) {
    setPlanning(true);
    setError(null);
    try {
      const planned = await api<Route[]>("/api/v1/routes/replan", {
        method: "POST",
        body: JSON.stringify(disableTruckId ? { disable_truck_ids: [disableTruckId] } : {}),
      });
      setRoutes(planned);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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

  if (trucks === null) return <Muted>{t("loading")}</Muted>;

  const totalKm = routes.reduce((s, r) => s + r.planned_km, 0);
  const totalFuel = routes.reduce((s, r) => s + r.planned_fuel_l, 0);

  const truckCols: GridColDef<Truck>[] = [
    { field: "name", headerName: t("name"), flex: 1, minWidth: 120 },
    { field: "capacity_kg", headerName: t("capacityKg"), type: "number", width: 120 },
    { field: "fuel_l_per_100km", headerName: t("fuelUse"), type: "number", flex: 1, minWidth: 120, valueFormatter: (v) => `${v} L/100km` },
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
        onClick={() => void planToday()}
      >
        {planning ? t("planning") : t("planToday")}
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
        {routes.length === 0 ? (
          <Muted>{t("noRoutes")}</Muted>
        ) : (
          <Grid container spacing={{ xs: 2, md: 2.5 }}>
            {routes.map((route) => (
              <Grid size={{ xs: 12, md: 6 }} key={route.id}>
                <Panel
                  title={
                    <Box>
                      <Typography variant="h6">{route.truck_name}</Typography>
                      <Muted>
                        {route.bins_served} {t("stops")} · {route.planned_km} km ·{" "}
                        {route.planned_fuel_l} L · {Math.round(route.demand_kg)} kg
                      </Muted>
                    </Box>
                  }
                  action={
                    <Button
                      variant="outlined"
                      size="small"
                      color="warning"
                      startIcon={<BuildIcon />}
                      disabled={planning}
                      title={t("breakdownHint")}
                      onClick={() => void replan(route.truck_id)}
                    >
                      {t("breakdown")}
                    </Button>
                  }
                >
                  {route.stops.length === 0 ? (
                    <Muted>{t("noStops")}</Muted>
                  ) : (
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                        columnGap: 2,
                      }}
                    >
                      {route.stops.map((s) => (
                        <Box
                          key={s.bin_id}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1.25,
                            py: 0.75,
                            borderBottom: "1px solid",
                            borderColor: "divider",
                          }}
                        >
                          <Box
                            sx={{
                              minWidth: 22,
                              textAlign: "right",
                              fontWeight: 700,
                              fontSize: "0.8rem",
                              color: "text.secondary",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {s.seq}
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontFamily: "ui-monospace, monospace", fontSize: "0.85rem" }} noWrap>
                              {s.qr_code}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Panel>
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
          <TruckForm onCreated={reload} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard title={t("trucks")}>
            {trucks.length === 0 ? (
              <Muted>{t("noTrucks")}</Muted>
            ) : (
              <DataTable rows={trucks} columns={truckCols} toolbar={false} pageSize={5} />
            )}
          </SectionCard>
        </Grid>
      </Grid>
    </PageStack>
  );
}

function TruckForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("2000");
  const [fuel, setFuel] = useState("25");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await api("/api/v1/trucks", {
      method: "POST",
      body: JSON.stringify({
        name,
        capacity_kg: Number(capacity),
        fuel_l_per_100km: Number(fuel),
        depot_lat: Number(lat),
        depot_lng: Number(lng),
      }),
    });
    setName("");
    setLat("");
    setLng("");
    await onCreated();
  }

  return (
    <SectionCard title={t("addTruck")}>
      <Box component="form" onSubmit={(e) => void onSubmit(e)}>
        <Stack spacing={2}>
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
          <TextField
            size="small"
            fullWidth
            type="number"
            label={t("fuelUse")}
            value={fuel}
            onChange={(e) => setFuel(e.target.value)}
            required
            slotProps={{ htmlInput: { min: 1, step: 0.1 } }}
          />
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
          <Button variant="contained" color="primary" type="submit">
            {t("addTruck")}
          </Button>
        </Stack>
      </Box>
    </SectionCard>
  );
}
