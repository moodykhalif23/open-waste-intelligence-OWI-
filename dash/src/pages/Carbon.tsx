import { useEffect, useState } from "react";
import { api } from "../api";
import { useI18n, type StringKey } from "../i18n";

interface MaterialCarbon {
  material: string;
  kg: number;
  co2e_kg: number;
}

interface Carbon {
  window_days: number;
  method_version: string;
  co2e_avoided_kg: number;
  co2e_low_kg: number;
  co2e_high_kg: number;
  landfill_m3_saved: number;
  plastic_diverted_kg: number;
  trees_equivalent: number;
  car_km_equivalent: number;
  materials: MaterialCarbon[];
}

export default function Carbon() {
  const { t } = useI18n();
  const [data, setData] = useState<Carbon | null>(null);

  useEffect(() => {
    void api<Carbon>("/api/v1/carbon?days=30").then(setData);
  }, []);

  if (data === null) return <p className="muted">{t("loading")}</p>;
  const label = (m: string) => t(m as StringKey);
  const range = `${Math.round(data.co2e_low_kg)}–${Math.round(data.co2e_high_kg)}`;

  return (
    <>
      <section className="composition-head">
        <div className="comp-tile">
          <span className="comp-pct">{range}</span>
          <span className="comp-label">{t("co2eAvoided")}</span>
        </div>
        <div className="comp-tile">
          <span className="comp-pct">{data.landfill_m3_saved}</span>
          <span className="comp-label">{t("landfillSaved")}</span>
        </div>
        <div className="comp-tile">
          <span className="comp-pct">{Math.round(data.plastic_diverted_kg)}</span>
          <span className="comp-label">{t("plasticDiverted")}</span>
        </div>
        <div className="comp-tile">
          <span className="comp-pct">≈{data.trees_equivalent}</span>
          <span className="comp-label">{t("treesEquiv")}</span>
        </div>
      </section>

      {data.co2e_avoided_kg === 0 ? (
        <p className="muted">{t("noCarbonYet")}</p>
      ) : (
        <div className="card">
          <h2>{t("co2eByMaterial")}</h2>
          <table>
            <thead>
              <tr>
                <th>{t("material")}</th>
                <th>{t("kgEst")}</th>
                <th>{t("co2eKg")}</th>
              </tr>
            </thead>
            <tbody>
              {data.materials.map((m) => (
                <tr key={m.material}>
                  <td>{label(m.material)}</td>
                  <td>{m.kg.toLocaleString()}</td>
                  <td>{m.co2e_kg.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="notice">
        {t("carbonNotOffsets")} ({t("methodology")}: {data.method_version}, ≈{t("carEquiv")}{" "}
        {data.car_km_equivalent.toLocaleString()} km)
      </p>
    </>
  );
}
