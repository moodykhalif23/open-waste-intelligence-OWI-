import { useCallback, useEffect, useState } from "react";
import { t, type Lang, type StringKey } from "../i18n";
import {
  collectStop,
  fetchCollectList,
  fetchRoutes,
  markCollected,
  type BinHealth,
  type Route,
} from "../lib/collect";

type Load =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "routes"; routes: Route[] }
  | { kind: "list"; bins: BinHealth[] };

export default function CollectList({ lang, token }: { lang: Lang; token: string }) {
  const tr = (key: StringKey, vars?: Record<string, string | number>) => t(lang, key, vars);
  const [state, setState] = useState<Load>({ kind: "loading" });

  const reload = useCallback(async () => {
    if (!token) return setState({ kind: "error" });
    try {
      const routes = (await fetchRoutes(token)).filter((r) => r.stops.length > 0);
      if (routes.length > 0) return setState({ kind: "routes", routes });
      // No route planned yet — fall back to the raw collect-today list.
      setState({ kind: "list", bins: await fetchCollectList(token) });
    } catch {
      setState({ kind: "error" });
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function doStop(stopId: string) {
    await collectStop(token, stopId);
    await reload();
  }

  async function doBin(binId: string) {
    await markCollected(token, binId);
    await reload();
  }

  if (state.kind === "loading") return <p className="gps">{tr("loading")}</p>;
  if (state.kind === "error") return <p className="warning">{tr("collectOffline")}</p>;

  if (state.kind === "list") {
    if (state.bins.length === 0) return <p className="gps">{tr("collectNone")}</p>;
    return (
      <ul className="collect-list">
        {state.bins.map((bin) => (
          <li key={bin.bin_id} className="collect-row">
            <div className="collect-info">
              <span className="collect-bin">
                <span className={`ring ring-${bin.overflow_risk}`} aria-hidden />
                {bin.site_name} · {bin.qr_code}
              </span>
              <span className="collect-sub">
                {Math.round(bin.fill_pct)}% ·{" "}
                {bin.recommendation === "collect_today" ? tr("collectNow") : tr("collectSoon")}
              </span>
            </div>
            <button className="primary collect-btn" onClick={() => void doBin(bin.bin_id)}>
              {tr("done")}
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="routes">
      {state.routes.map((route) => {
        const done = route.stops.filter((s) => s.collected).length;
        return (
          <section key={route.id} className="route-block">
            <div className="route-title">
              <strong>{route.truck_name}</strong>
              <span className="collect-sub">
                {done}/{route.stops.length} · {route.planned_km} km
              </span>
            </div>
            <ol className="stop-seq">
              {route.stops.map((stop) => (
                <li key={stop.id} className={stop.collected ? "stop done" : "stop"}>
                  <span className="stop-num">{stop.seq + 1}</span>
                  <span className="stop-code mono">{stop.qr_code}</span>
                  {stop.collected ? (
                    <span className="stop-check" aria-label={tr("done")}>
                      ✓
                    </span>
                  ) : (
                    <button className="primary stop-btn" onClick={() => void doStop(stop.id)}>
                      {tr("done")}
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
