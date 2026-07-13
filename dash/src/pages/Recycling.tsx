import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { useI18n, type StringKey } from "../i18n";

const MATERIALS = ["plastic", "glass", "metal", "paper", "organic", "e_waste", "textile"] as const;

interface MaterialValue {
  material: string;
  kg: number;
  kes_per_kg: number | null;
  value_kes: number;
  partners: number;
}

interface ValueReport {
  window_days: number;
  total_kg: number;
  total_value_kes: number;
  materials: MaterialValue[];
}

interface Price {
  id: string;
  material: string;
  kes_per_kg: number;
  effective_date: string;
}

interface Partner {
  id: string;
  name: string;
  materials_accepted: string[];
  min_kg_per_month: number;
  contact: string | null;
}

export default function Recycling() {
  const { t } = useI18n();
  const [value, setValue] = useState<ValueReport | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);

  const reload = useCallback(async () => {
    const [v, p, pa] = await Promise.all([
      api<ValueReport>("/api/v1/recycling/value?days=30"),
      api<Price[]>("/api/v1/recycling/prices"),
      api<Partner[]>("/api/v1/recycling/partners"),
    ]);
    setValue(v);
    setPrices(p);
    setPartners(pa);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const label = (m: string) => t(m as StringKey);
  if (value === null) return <p className="muted">{t("loading")}</p>;

  return (
    <>
      <section className="tiles">
        <div className="tile">
          <span className="tile-value">{Math.round(value.total_kg).toLocaleString()}</span>
          <span className="tile-label">{t("kgCollected30")}</span>
        </div>
        <div className="tile">
          <span className="tile-value">KES {Math.round(value.total_value_kes).toLocaleString()}</span>
          <span className="tile-label">{t("estValue30")}</span>
        </div>
        <div className="tile">
          <span className="tile-value">{partners.length}</span>
          <span className="tile-label">{t("partnersRegistered")}</span>
        </div>
      </section>

      <section>
        <h2>{t("recoverableValue")}</h2>
        {value.materials.length === 0 ? (
          <p className="muted">{t("noValueYet")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("material")}</th>
                <th>{t("kgEst")}</th>
                <th>{t("pricePerKg")}</th>
                <th>{t("valueKes")}</th>
                <th>{t("matchingPartners")}</th>
              </tr>
            </thead>
            <tbody>
              {value.materials.map((m) => (
                <tr key={m.material}>
                  <td>{label(m.material)}</td>
                  <td>{m.kg.toLocaleString()}</td>
                  <td>{m.kes_per_kg === null ? "—" : `KES ${m.kes_per_kg}`}</td>
                  <td>{m.value_kes ? `KES ${Math.round(m.value_kes).toLocaleString()}` : "—"}</td>
                  <td>{m.partners}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="muted savings-note">{t("valueMethod")}</p>
      </section>

      <section className="cards">
        <PriceForm onSaved={reload} />
        <PartnerForm onSaved={reload} />
      </section>

      <section className="cards">
        <div className="card">
          <h2>{t("priceTable")}</h2>
          {prices.length === 0 ? (
            <p className="muted">{t("noPrices")}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t("material")}</th>
                  <th>{t("pricePerKg")}</th>
                  <th>{t("effectiveDate")}</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((p) => (
                  <tr key={p.id}>
                    <td>{label(p.material)}</td>
                    <td>KES {p.kes_per_kg}</td>
                    <td>{p.effective_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card">
          <h2>{t("partners")}</h2>
          {partners.length === 0 ? (
            <p className="muted">{t("noPartners")}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t("name")}</th>
                  <th>{t("accepts")}</th>
                  <th>{t("minKg")}</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.materials_accepted.map(label).join(", ")}</td>
                    <td>{p.min_kg_per_month}</td>
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

function PriceForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const { t } = useI18n();
  const [material, setMaterial] = useState<string>("plastic");
  const [price, setPrice] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await api("/api/v1/recycling/prices", {
      method: "POST",
      body: JSON.stringify({
        material,
        kes_per_kg: Number(price),
        effective_date: effectiveDate,
      }),
    });
    setPrice("");
    await onSaved();
  }

  return (
    <form className="card form" onSubmit={(e) => void onSubmit(e)}>
      <h2>{t("setPrice")}</h2>
      <label>
        {t("material")}
        <select value={material} onChange={(e) => setMaterial(e.target.value)}>
          {MATERIALS.map((m) => (
            <option key={m} value={m}>
              {t(m as StringKey)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("pricePerKg")}
        <input
          type="number"
          min="0"
          step="0.5"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
      </label>
      <label>
        {t("effectiveDate")}
        <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
      </label>
      <button className="primary" type="submit">
        {t("setPrice")}
      </button>
    </form>
  );
}

function PartnerForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [accepts, setAccepts] = useState<string[]>([]);
  const [minKg, setMinKg] = useState("0");
  const [contact, setContact] = useState("");

  function toggle(m: string) {
    setAccepts((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await api("/api/v1/recycling/partners", {
      method: "POST",
      body: JSON.stringify({
        name,
        materials_accepted: accepts,
        min_kg_per_month: Number(minKg),
        contact: contact || null,
      }),
    });
    setName("");
    setAccepts([]);
    setMinKg("0");
    setContact("");
    await onSaved();
  }

  return (
    <form className="card form" onSubmit={(e) => void onSubmit(e)}>
      <h2>{t("addPartner")}</h2>
      <label>
        {t("name")}
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <fieldset className="materials">
        <legend>{t("accepts")}</legend>
        {MATERIALS.map((m) => (
          <label key={m} className="material-input">
            <input type="checkbox" checked={accepts.includes(m)} onChange={() => toggle(m)} />
            {t(m as StringKey)}
          </label>
        ))}
      </fieldset>
      <label>
        {t("minKg")}
        <input type="number" min="0" value={minKg} onChange={(e) => setMinKg(e.target.value)} />
      </label>
      <label>
        {t("contact")}
        <input value={contact} onChange={(e) => setContact(e.target.value)} />
      </label>
      <button className="primary" type="submit">
        {t("addPartner")}
      </button>
    </form>
  );
}
