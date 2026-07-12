import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useI18n } from "../i18n";

interface HealthRow {
  bin_id: string;
  qr_code: string;
  site_name: string;
  date: string;
  fill_pct: number;
  days_to_full: number | null;
  days_since_collection: number | null;
  overflow_risk: "low" | "medium" | "high";
  recommendation: "collect_today" | "schedule_soon" | "no_action";
}

export default function BinHealth() {
  const { t } = useI18n();
  const [rows, setRows] = useState<HealthRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setRows(await api<HealthRow[]>("/api/v1/bins/health"));
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function refresh() {
    setBusy(true);
    try {
      await api("/api/v1/admin/analytics/refresh", { method: "POST" });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function markCollected(row: HealthRow) {
    await api("/api/v1/collections", {
      method: "POST",
      body: JSON.stringify({ bin_id: row.bin_id }),
    });
    await reload();
  }

  if (rows === null) return <p className="muted">{t("loading")}</p>;

  return (
    <div className="card">
      <div className="section-head">
        <h2>{t("collectToday")}</h2>
        <button className="secondary" onClick={() => void refresh()} disabled={busy}>
          {busy ? t("refreshing") : t("refresh")}
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="muted">{t("noHealthData")}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t("bin")}</th>
              <th>{t("site")}</th>
              <th>{t("fillLevel")}</th>
              <th>{t("daysToFull")}</th>
              <th>{t("sinceCollection")}</th>
              <th>{t("risk")}</th>
              <th>{t("recommendation")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.bin_id}>
                <td className="mono">{row.qr_code}</td>
                <td>{row.site_name}</td>
                <td>{Math.round(row.fill_pct)}%</td>
                <td>{row.days_to_full === null ? "—" : row.days_to_full.toFixed(1)}</td>
                <td>
                  {row.days_since_collection === null
                    ? "—"
                    : row.days_since_collection.toFixed(1)}
                </td>
                <td>
                  <span className={`badge badge-${row.overflow_risk}`}>
                    {t(row.overflow_risk === "high" ? "riskHigh" : row.overflow_risk === "medium" ? "riskMedium" : "riskLow")}
                  </span>
                </td>
                <td>
                  {row.recommendation === "collect_today" && t("collectTodayRec")}
                  {row.recommendation === "schedule_soon" && t("scheduleSoonRec")}
                  {row.recommendation === "no_action" && "—"}
                </td>
                <td>
                  <button className="secondary" onClick={() => void markCollected(row)}>
                    {t("markCollected")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
