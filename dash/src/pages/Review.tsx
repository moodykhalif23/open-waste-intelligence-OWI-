import { useCallback, useEffect, useState } from "react";
import { api, apiBlob } from "../api";
import { useI18n } from "../i18n";

const FILL_BANDS = ["empty", "low", "half", "high", "overflowing"] as const;

interface Prediction {
  id: string;
  observation_id: string;
  task: "detect" | "classify" | "fill" | "dumping";
  payload: Record<string, unknown>;
  review_status: string;
}

interface Queue {
  unreviewed: number;
  items: Prediction[];
}

export default function Review() {
  const { t } = useI18n();
  const [queue, setQueue] = useState<Queue | null>(null);

  const reload = useCallback(async () => {
    setQueue(await api<Queue>("/api/v1/predictions"));
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function confirm(p: Prediction) {
    await api(`/api/v1/predictions/${p.id}/review`, {
      method: "POST",
      body: JSON.stringify({ action: "confirm" }),
    });
    await reload();
  }

  async function correctFill(p: Prediction, band: string) {
    await api(`/api/v1/predictions/${p.id}/review`, {
      method: "POST",
      body: JSON.stringify({ action: "correct", corrected_payload: { fill_band: band } }),
    });
    await reload();
  }

  if (queue === null) return <p className="muted">{t("loading")}</p>;

  return (
    <div className="card">
      <div className="section-head">
        <h2>{t("reviewQueue")}</h2>
        <span className="muted">{t("pendingCount").replace("{n}", String(queue.unreviewed))}</span>
      </div>
      {queue.items.length === 0 ? (
        <p className="muted">{t("reviewEmpty")}</p>
      ) : (
        <ul className="review-list">
          {queue.items.map((p) => (
            <ReviewItem
              key={p.id}
              prediction={p}
              onConfirm={() => void confirm(p)}
              onCorrect={(band) => void correctFill(p, band)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewItem({
  prediction,
  onConfirm,
  onCorrect,
}: {
  prediction: Prediction;
  onConfirm: () => void;
  onCorrect: (band: string) => void;
}) {
  const { t } = useI18n();
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked = false;
    let url: string | null = null;
    void apiBlob(`/api/v1/observations/${prediction.observation_id}/image`).then((blob) => {
      if (revoked) return;
      url = URL.createObjectURL(blob);
      setImageUrl(url);
    });
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [prediction.observation_id]);

  const predicted = String(prediction.payload.fill_band ?? "");

  return (
    <li className="review-item">
      {imageUrl && <img src={imageUrl} alt="" className="review-thumb" />}
      <div className="review-body">
        <p className="review-meta">
          {prediction.task} · {t("predicted")}: <strong>{predicted || "—"}</strong>
        </p>
        {prediction.task === "fill" ? (
          <div className="bands">
            {FILL_BANDS.map((band) => (
              <button
                key={band}
                className="band-pick"
                onClick={() => (band === predicted ? onConfirm() : onCorrect(band))}
              >
                {t(band)}
              </button>
            ))}
          </div>
        ) : (
          <button className="primary" onClick={onConfirm}>
            {t("confirm")}
          </button>
        )}
      </div>
    </li>
  );
}
