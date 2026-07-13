import { useEffect, useState } from "react";
import { api } from "../api";
import { useI18n, type StringKey } from "../i18n";

interface Component {
  name: string;
  value: number;
  weight: number;
}

interface AreaScore {
  site_id: string;
  site_name: string;
  score: number | null;
  sufficient: boolean;
  method_version: string;
  components: Component[];
}

interface Methodology {
  version: string;
  weights: Record<string, number>;
  note: string;
}

function scoreClass(score: number): string {
  if (score >= 75) return "low"; // clean → green badge
  if (score >= 50) return "medium";
  return "high";
}

export default function Cleanliness() {
  const { t } = useI18n();
  const [areas, setAreas] = useState<AreaScore[] | null>(null);
  const [method, setMethod] = useState<Methodology | null>(null);

  useEffect(() => {
    void api<AreaScore[]>("/api/v1/cleanliness").then(setAreas);
    void api<Methodology>("/api/v1/cleanliness/methodology").then(setMethod);
  }, []);

  if (areas === null) return <p className="muted">{t("loading")}</p>;

  return (
    <>
      <h2>{t("cleanlinessIndex")}</h2>
      {areas.length === 0 ? (
        <p className="muted">{t("noAreas")}</p>
      ) : (
        <section className="area-grid">
          {areas.map((a) => (
            <div className="card area-card" key={a.site_id}>
              <div className="area-head">
                <strong>{a.site_name}</strong>
                {a.sufficient && a.score !== null ? (
                  <span className={`score-badge badge-${scoreClass(a.score)}`}>
                    {Math.round(a.score)}
                  </span>
                ) : (
                  <span className="muted">{t("insufficient")}</span>
                )}
              </div>
              <ul className="component-list">
                {a.components.map((c) => (
                  <li key={c.name}>
                    <span>{t(`comp_${c.name}` as StringKey)}</span>
                    <span className="component-bar">
                      <span className="component-fill" style={{ width: `${c.value}%` }} />
                    </span>
                    <span className="mono">{Math.round(c.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {method && (
        <p className="notice">
          {t("methodology")} {method.version}: {method.note}
        </p>
      )}
    </>
  );
}
