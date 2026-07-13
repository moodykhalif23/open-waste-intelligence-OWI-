import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, apiBlob, type Bin, type Observation } from "../api";
import { useI18n, type StringKey } from "../i18n";

export default function Reports() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const material = params.get("material");
  const [observations, setObservations] = useState<Observation[] | null>(null);
  const [bins, setBins] = useState<Bin[]>([]);

  useEffect(() => {
    setObservations(null);
    const q = material ? `&material=${encodeURIComponent(material)}` : "";
    void api<Observation[]>(`/api/v1/observations?limit=200${q}`).then(setObservations);
    void api<Bin[]>("/api/v1/bins").then(setBins);
  }, [material]);

  async function viewPhoto(id: string) {
    const blob = await apiBlob(`/api/v1/observations/${id}/image`);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  if (observations === null) return <p className="muted">{t("loading")}</p>;
  const binCode = (id: string | null) =>
    id === null ? t("noBin") : (bins.find((b) => b.id === id)?.qr_code ?? id.slice(0, 8));

  return (
    <div className="card">
      <div className="section-head">
        <h2>{t("reports")}</h2>
        {material && (
          <button className="secondary" onClick={() => navigate("/reports")}>
            {t("filteredBy")}: {t(material as StringKey)} ✕
          </button>
        )}
      </div>
      {observations.length === 0 ? (
        <p className="muted">{t("noData")}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t("capturedAt")}</th>
              <th>{t("bin")}</th>
              <th>{t("fillTap")}</th>
              <th>{t("source")}</th>
              <th>{t("privacy")}</th>
              <th>{t("photo")}</th>
            </tr>
          </thead>
          <tbody>
            {observations.map((obs) => (
              <tr key={obs.id}>
                <td>{new Date(obs.captured_at).toLocaleString()}</td>
                <td className="mono">{binCode(obs.bin_id)}</td>
                <td>{obs.fill_tap ? t(obs.fill_tap as StringKey) : "—"}</td>
                <td>{obs.location_source}</td>
                <td>{obs.privacy_status}</td>
                <td>
                  <button className="secondary" onClick={() => void viewPhoto(obs.id)}>
                    {t("view")}
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
