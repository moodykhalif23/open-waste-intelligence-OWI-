import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, apiBlob } from "../api";
import { useI18n, type StringKey } from "../i18n";

const INTERVENTIONS = ["bin_added", "signage", "cleanup", "engagement"] as const;

interface Candidate {
  observation_id: string;
  captured_at: string;
  lat: number;
  lng: number;
}

interface Site {
  id: string;
  lat: number;
  lng: number;
  area: string | null;
  first_seen: string;
  last_seen: string;
  event_count: number;
  status: "active" | "cleaned" | "recurring";
  hotspot_score: number;
}

interface Event {
  occurred_at: string;
  observation_id: string;
}

interface Intervention {
  id: string;
  kind: string;
  performed_on: string;
  notes: string | null;
}

interface SiteDetail extends Site {
  events: Event[];
  interventions: Intervention[];
}

export default function Dumping() {
  const { t } = useI18n();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [sites, setSites] = useState<Site[] | null>(null);
  const [selected, setSelected] = useState<SiteDetail | null>(null);

  const reload = useCallback(async () => {
    const [c, s] = await Promise.all([
      api<Candidate[]>("/api/v1/dumping/candidates"),
      api<Site[]>("/api/v1/dumping/sites"),
    ]);
    setCandidates(c);
    setSites(s);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function review(obsId: string, decision: string) {
    await api(`/api/v1/dumping/candidates/${obsId}/review`, {
      method: "POST",
      body: JSON.stringify({ review: decision }),
    });
    await reload();
  }

  async function openSite(id: string) {
    setSelected(await api<SiteDetail>(`/api/v1/dumping/sites/${id}`));
  }

  if (sites === null) return <p className="muted">{t("loading")}</p>;

  return (
    <>
      <section>
        <h2>{t("reviewQueue")}</h2>
        {candidates.length === 0 ? (
          <p className="muted">{t("noCandidates")}</p>
        ) : (
          <ul className="review-list">
            {candidates.map((c) => (
              <CandidateItem
                key={c.observation_id}
                candidate={c}
                onReview={(d) => void review(c.observation_id, d)}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>{t("hotspots")}</h2>
        {sites.length === 0 ? (
          <p className="muted">{t("noSites")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("location")}</th>
                <th>{t("events")}</th>
                <th>{t("lastSeen")}</th>
                <th>{t("risk")}</th>
                <th>{t("status")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => (
                <tr key={s.id}>
                  <td className="mono">
                    {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                  </td>
                  <td>{s.event_count}</td>
                  <td>{new Date(s.last_seen).toLocaleDateString()}</td>
                  <td>{s.hotspot_score}</td>
                  <td>
                    <span className={`badge badge-${s.status === "recurring" ? "high" : s.status === "active" ? "medium" : "low"}`}>
                      {t(`dump_${s.status}` as StringKey)}
                    </span>
                  </td>
                  <td>
                    <button className="secondary" onClick={() => void openSite(s.id)}>
                      {t("view")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {selected && (
        <SitePanel site={selected} onClose={() => setSelected(null)} onChanged={reload} />
      )}
    </>
  );
}

function CandidateItem({
  candidate,
  onReview,
}: {
  candidate: Candidate;
  onReview: (decision: string) => void;
}) {
  const { t } = useI18n();
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    void apiBlob(`/api/v1/observations/${candidate.observation_id}/image`).then((b) => {
      if (cancelled) return;
      url = URL.createObjectURL(b);
      setImageUrl(url);
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [candidate.observation_id]);

  return (
    <li className="review-item">
      {imageUrl && <img src={imageUrl} alt="" className="review-thumb" />}
      <div className="review-body">
        <p className="review-meta">
          {candidate.lat.toFixed(4)}, {candidate.lng.toFixed(4)} ·{" "}
          {new Date(candidate.captured_at).toLocaleDateString()}
        </p>
        <div className="head-actions">
          <button className="primary" onClick={() => onReview("confirmed")}>
            {t("confirmDumping")}
          </button>
          <button className="secondary" onClick={() => onReview("rejected")}>
            {t("reject")}
          </button>
          <button className="secondary" onClick={() => onReview("duplicate")}>
            {t("duplicate")}
          </button>
        </div>
      </div>
    </li>
  );
}

function SitePanel({
  site,
  onClose,
  onChanged,
}: {
  site: SiteDetail;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [kind, setKind] = useState<string>("cleanup");
  const [performedOn, setPerformedOn] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  async function addIntervention(e: FormEvent) {
    e.preventDefault();
    await api(`/api/v1/dumping/sites/${site.id}/interventions`, {
      method: "POST",
      body: JSON.stringify({ kind, performed_on: performedOn, notes: notes || null }),
    });
    setNotes("");
    await onChanged();
    onClose();
  }

  return (
    <div className="card">
      <div className="section-head">
        <h2>
          {t("site")} {site.lat.toFixed(4)}, {site.lng.toFixed(4)}
        </h2>
        <button className="linklike" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="cards">
        <div>
          <h2>{t("timeline")}</h2>
          <ol className="stop-seq">
            {site.events.map((ev) => (
              <li key={ev.observation_id} className="stop">
                <span className="stop-code">{new Date(ev.occurred_at).toLocaleString()}</span>
              </li>
            ))}
            {site.interventions.map((iv) => (
              <li key={iv.id} className="stop">
                <span className="stop-num">✓</span>
                <span className="stop-code">
                  {t(`iv_${iv.kind}` as StringKey)} · {iv.performed_on}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <form className="form" onSubmit={(e) => void addIntervention(e)}>
          <h2>{t("recordIntervention")}</h2>
          <label>
            {t("interventionKind")}
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {INTERVENTIONS.map((k) => (
                <option key={k} value={k}>
                  {t(`iv_${k}` as StringKey)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("performedOn")}
            <input type="date" value={performedOn} onChange={(e) => setPerformedOn(e.target.value)} />
          </label>
          <label>
            {t("notes")}
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <button className="primary" type="submit">
            {t("recordIntervention")}
          </button>
        </form>
      </div>
    </div>
  );
}
