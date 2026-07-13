import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
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
  truck_name: string;
  planned_km: number;
  planned_fuel_l: number;
  demand_kg: number;
  bins_served: number;
  stops: Stop[];
}

export default function Routes() {
  const { t } = useI18n();
  const [trucks, setTrucks] = useState<Truck[] | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);

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

  if (trucks === null) return <p className="muted">{t("loading")}</p>;

  const totalKm = routes.reduce((s, r) => s + r.planned_km, 0);
  const totalFuel = routes.reduce((s, r) => s + r.planned_fuel_l, 0);

  return (
    <>
      <section className="tiles">
        <Tile value={routes.reduce((s, r) => s + r.bins_served, 0)} label={t("binsToCollect")} />
        <Tile value={Math.round(totalKm * 10) / 10} label={t("plannedKm")} />
        <Tile value={Math.round(totalFuel * 10) / 10} label={t("plannedFuelL")} />
      </section>

      <section>
        <div className="section-head">
          <h2>{t("todaysRoutes")}</h2>
          <button className="primary" disabled={planning} onClick={() => void planToday()}>
            {planning ? t("planning") : t("planToday")}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        {routes.length === 0 ? (
          <p className="muted">{t("noRoutes")}</p>
        ) : (
          <div className="route-grid">
            {routes.map((route) => (
              <div className="route-card" key={route.id}>
                <div className="route-head">
                  <strong>{route.truck_name}</strong>
                  <span className="muted">
                    {route.bins_served} {t("stops")} · {route.planned_km} km ·{" "}
                    {route.planned_fuel_l} L · {Math.round(route.demand_kg)} kg
                  </span>
                </div>
                {route.stops.length === 0 ? (
                  <p className="muted">{t("noStops")}</p>
                ) : (
                  <ol className="stop-list">
                    {route.stops.map((s) => (
                      <li key={s.bin_id}>
                        <span className="mono">{s.qr_code}</span>
                        <span className="muted">
                          {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="cards">
        <TruckForm onCreated={reload} />
        <div className="card">
          <h2>{t("trucks")}</h2>
          {trucks.length === 0 ? (
            <p className="muted">{t("noTrucks")}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t("name")}</th>
                  <th>{t("capacityKg")}</th>
                  <th>{t("fuelUse")}</th>
                </tr>
              </thead>
              <tbody>
                {trucks.map((tk) => (
                  <tr key={tk.id}>
                    <td>{tk.name}</td>
                    <td>{tk.capacity_kg}</td>
                    <td>{tk.fuel_l_per_100km} L/100km</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <div className="tile">
      <span className="tile-value">{value}</span>
      <span className="tile-label">{label}</span>
    </div>
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
    <form className="card form" onSubmit={(e) => void onSubmit(e)}>
      <h2>{t("addTruck")}</h2>
      <label>
        {t("name")}
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        {t("capacityKg")}
        <input
          type="number"
          min="1"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          required
        />
      </label>
      <label>
        {t("fuelUse")}
        <input type="number" min="1" step="0.1" value={fuel} onChange={(e) => setFuel(e.target.value)} required />
      </label>
      <label>
        {t("depotLat")}
        <input value={lat} onChange={(e) => setLat(e.target.value)} required inputMode="decimal" />
      </label>
      <label>
        {t("depotLng")}
        <input value={lng} onChange={(e) => setLng(e.target.value)} required inputMode="decimal" />
      </label>
      <button className="primary" type="submit">
        {t("addTruck")}
      </button>
    </form>
  );
}
