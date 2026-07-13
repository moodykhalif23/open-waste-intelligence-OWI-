import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { api, apiBlob } from "../api";
import { Muted, PageStack, SectionCard } from "../components/ui";
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

  if (queue === null) return <Muted>{t("loading")}</Muted>;

  return (
    <PageStack>
      <SectionCard
        title={t("reviewQueue")}
        action={
          <Chip size="small" label={t("pendingCount").replace("{n}", String(queue.unreviewed))} />
        }
      >
        {queue.items.length === 0 ? (
          <Muted>{t("reviewEmpty")}</Muted>
        ) : (
          <Stack spacing={2.5} divider={<Box sx={{ borderTop: "1px solid", borderColor: "divider" }} />}>
            {queue.items.map((p) => (
              <ReviewItem
                key={p.id}
                prediction={p}
                onConfirm={() => void confirm(p)}
                onCorrect={(band) => void correctFill(p, band)}
              />
            ))}
          </Stack>
        )}
      </SectionCard>
    </PageStack>
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
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5} sx={{ alignItems: { sm: "center" } }}>
      {imageUrl && (
        <Box
          component="img"
          src={imageUrl}
          alt=""
          sx={{ width: 96, height: 96, borderRadius: 2, objectFit: "cover", flexShrink: 0 }}
        />
      )}
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {prediction.task} · {t("predicted")}:{" "}
          <Box component="strong" sx={{ color: "text.primary" }}>
            {predicted || "—"}
          </Box>
        </Typography>
        {prediction.task === "fill" ? (
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            {FILL_BANDS.map((band) => (
              <Button
                key={band}
                size="small"
                variant={band === predicted ? "contained" : "outlined"}
                color="primary"
                onClick={() => (band === predicted ? onConfirm() : onCorrect(band))}
              >
                {t(band)}
              </Button>
            ))}
          </Stack>
        ) : (
          <Button variant="contained" color="primary" onClick={onConfirm}>
            {t("confirm")}
          </Button>
        )}
      </Box>
    </Stack>
  );
}
