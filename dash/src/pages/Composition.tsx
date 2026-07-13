import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import EChart, { barOption } from "../components/EChart";
import { useI18n, type StringKey } from "../i18n";

interface MaterialShare {
  material: string;
  count: number;
  share_pct: number;
  delta_pct: number | null;
}

interface Composition {
  window_days: number;
  total: number;
  sufficient: boolean;
  materials: MaterialShare[];
}

const PERIODS = [7, 30, 90];

export default function Composition() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Composition | null>(null);

  const reload = useCallback(async () => {
    setData(await api<Composition>(`/api/v1/analytics/composition?days=${days}`));
  }, [days]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const label = (m: string) => t(m as StringKey);

  return (
    <>
      <div className="section-head">
        <h2>{t("wasteComposition")}</h2>
        <div className="head-actions">
          {PERIODS.map((p) => (
            <button
              key={p}
              className={p === days ? "primary" : "secondary"}
              onClick={() => setDays(p)}
            >
              {t("lastNDays").replace("{n}", String(p))}
            </button>
          ))}
        </div>
      </div>

      {data === null ? (
        <p className="muted">{t("loading")}</p>
      ) : data.total === 0 ? (
        <p className="muted">{t("noComposition")}</p>
      ) : (
        <>
          {!data.sufficient && (
            <p className="notice">{t("insufficientData").replace("{n}", String(data.total))}</p>
          )}
          <section className="composition-head">
            {data.materials.slice(0, 5).map((m) => (
              <div className="comp-tile" key={m.material}>
                <span className="comp-pct">{Math.round(m.share_pct)}%</span>
                <span className="comp-label">{label(m.material)}</span>
              </div>
            ))}
          </section>
          <section>
            <EChart
              option={barOption(
                data.materials.map((m) => label(m.material)),
                data.materials.map((m) => m.share_pct),
              )}
            />
          </section>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>{t("material")}</th>
                  <th>{t("share")}</th>
                  <th>{t("change")}</th>
                  <th>{t("observationsCol")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.materials.map((m) => (
                  <tr key={m.material}>
                    <td>{label(m.material)}</td>
                    <td>{m.share_pct}%</td>
                    <td>
                      {m.delta_pct === null ? (
                        "—"
                      ) : (
                        <span className={m.delta_pct >= 0 ? "delta-up" : "delta-down"}>
                          {m.delta_pct >= 0 ? "▲" : "▼"} {Math.abs(m.delta_pct)}
                        </span>
                      )}
                    </td>
                    <td>{m.count}</td>
                    <td>
                      <button
                        className="secondary"
                        onClick={() => navigate(`/reports?material=${m.material}`)}
                      >
                        {t("view")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
