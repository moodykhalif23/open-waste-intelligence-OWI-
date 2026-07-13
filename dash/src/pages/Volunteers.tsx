import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, getToken } from "../api";
import EChart, { barOption } from "../components/EChart";
import { useI18n } from "../i18n";

const EVENT_TYPES = ["cleanup", "education", "sorting"] as const;
const MATERIALS = ["plastic", "glass", "metal", "paper", "organic"] as const;

interface MonthPoint {
  month: string;
  events: number;
  hours: number;
  kg: number;
}

interface Summary {
  events: number;
  participants: number;
  hours: number;
  kg_total: number;
  kg_by_material: Record<string, number>;
  monthly: MonthPoint[];
}

interface Event {
  id: string;
  occurred_on: string;
  event_type: string;
  area: string;
  organizer: string;
  participant_count: number;
  hours_total: number;
}

export default function Volunteers() {
  const { t } = useI18n();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [events, setEvents] = useState<Event[]>([]);

  const reload = useCallback(async () => {
    const [s, e] = await Promise.all([
      api<Summary>("/api/v1/volunteers/summary"),
      api<Event[]>("/api/v1/volunteers"),
    ]);
    setSummary(s);
    setEvents(e);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function openReport() {
    const end = new Date().toISOString().slice(0, 10);
    const url = `/api/v1/volunteers/report?start=2000-01-01&end=${end}`;
    // Authenticated GET: fetch with the token, then open the HTML blob in a new tab to print.
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${getToken() ?? ""}` },
    });
    const blob = await response.blob();
    window.open(URL.createObjectURL(blob), "_blank", "noopener");
  }

  if (summary === null) return <p className="muted">{t("loading")}</p>;

  const trend = {
    categories: summary.monthly.map((m) => m.month),
    values: summary.monthly.map((m) => m.hours),
  };

  return (
    <>
      <section className="tiles">
        <Tile value={summary.events} label={t("eventsHeld")} />
        <Tile value={summary.participants} label={t("participants")} />
        <Tile value={summary.hours} label={t("volunteerHours")} />
        <Tile value={summary.kg_total} label={t("kgCollected")} />
      </section>

      <section>
        <div className="section-head">
          <h2>{t("hoursByMonth")}</h2>
          <button className="primary" onClick={() => void openReport()}>
            {t("grantReport")}
          </button>
        </div>
        {summary.monthly.length > 0 ? (
          <EChart option={barOption(trend.categories, trend.values)} />
        ) : (
          <p className="muted">{t("noData")}</p>
        )}
      </section>

      <section className="cards">
        <EventForm onCreated={reload} />
      </section>

      <section>
        <h2>{t("events")}</h2>
        {events.length === 0 ? (
          <p className="muted">{t("noData")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("date")}</th>
                <th>{t("type")}</th>
                <th>{t("area")}</th>
                <th>{t("organizer")}</th>
                <th>{t("participants")}</th>
                <th>{t("hours")}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>{e.occurred_on}</td>
                  <td>{t(e.event_type as "cleanup")}</td>
                  <td>{e.area}</td>
                  <td>{e.organizer}</td>
                  <td>{e.participant_count}</td>
                  <td>{e.hours_total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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

function EventForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const { t } = useI18n();
  const [occurredOn, setOccurredOn] = useState(new Date().toISOString().slice(0, 10));
  const [eventType, setEventType] = useState<string>("cleanup");
  const [area, setArea] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [participants, setParticipants] = useState("");
  const [hours, setHours] = useState("");
  const [materials, setMaterials] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const materials_kg: Record<string, number> = {};
    for (const [m, v] of Object.entries(materials)) {
      const n = Number(v);
      if (v && n > 0) materials_kg[m] = n;
    }
    await api("/api/v1/volunteers", {
      method: "POST",
      body: JSON.stringify({
        occurred_on: occurredOn,
        event_type: eventType,
        area,
        organizer,
        participant_count: Number(participants),
        hours_total: Number(hours),
        materials_kg,
      }),
    });
    setArea("");
    setOrganizer("");
    setParticipants("");
    setHours("");
    setMaterials({});
    await onCreated();
  }

  return (
    <form className="card form" onSubmit={(e) => void onSubmit(e)}>
      <h2>{t("logEvent")}</h2>
      <label>
        {t("date")}
        <input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
      </label>
      <label>
        {t("type")}
        <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
          {EVENT_TYPES.map((v) => (
            <option key={v} value={v}>
              {t(v)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("area")}
        <input value={area} onChange={(e) => setArea(e.target.value)} required />
      </label>
      <label>
        {t("organizer")}
        <input value={organizer} onChange={(e) => setOrganizer(e.target.value)} required />
      </label>
      <label>
        {t("participants")}
        <input
          type="number"
          min="0"
          value={participants}
          onChange={(e) => setParticipants(e.target.value)}
          required
        />
      </label>
      <label>
        {t("volunteerHours")}
        <input
          type="number"
          min="0"
          step="0.5"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          required
        />
      </label>
      <fieldset className="materials">
        <legend>{t("materialsKg")}</legend>
        {MATERIALS.map((m) => (
          <label key={m} className="material-input">
            {t(m)}
            <input
              type="number"
              min="0"
              step="0.1"
              value={materials[m] ?? ""}
              onChange={(e) => setMaterials((prev) => ({ ...prev, [m]: e.target.value }))}
            />
          </label>
        ))}
      </fieldset>
      <button className="primary" type="submit">
        {t("logEvent")}
      </button>
    </form>
  );
}
