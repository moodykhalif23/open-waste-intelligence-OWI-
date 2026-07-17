import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import { api, apiBlob } from "../api";
import { EmptyState, ErrorPanel, PageSkeleton, PageStack, SectionCard } from "../components/ui";
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
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setQueue(await api<Queue>("/api/v1/predictions"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
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

  if (error) {
    return (
      <PageStack>
        <ErrorPanel message={t("errorLoad")} retryLabel={t("retry")} onRetry={() => void reload()} />
      </PageStack>
    );
  }
  if (queue === null) return <PageSkeleton />;

  return (
    <PageStack>
      <SectionCard
        title={t("reviewQueue")}
        action={<Chip size="small" label={t("pendingCount").replace("{n}", String(queue.unreviewed))} />}
      >
        {queue.items.length === 0 ? (
          <EmptyState icon={<FactCheckOutlinedIcon />} title={t("reviewEmpty")} />
        ) : (
          <Grid container spacing={{ xs: 2, md: 2.5 }}>
            {queue.items.map((p) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={p.id}>
                <ReviewItem
                  prediction={p}
                  onConfirm={() => void confirm(p)}
                  onCorrect={(band) => void correctFill(p, band)}
                />
              </Grid>
            ))}
          </Grid>
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
    <Card variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardMedia
        component="img"
        image={imageUrl ?? undefined}
        alt=""
        sx={{ height: 168, objectFit: "cover", bgcolor: "#f0ede5" }}
      />
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Chip size="small" variant="outlined" label={prediction.task} />
          <Typography variant="body2" color="text.secondary">
            {t("predicted")}:{" "}
            <Box component="strong" sx={{ color: "text.primary" }}>
              {predicted || "—"}
            </Box>
          </Typography>
        </Stack>
      </CardContent>
      <CardActions sx={{ px: 2, pb: 2, pt: 0, flexWrap: "wrap", gap: 1 }}>
        {prediction.task === "fill" ? (
          FILL_BANDS.map((band) => (
            <Button
              key={band}
              size="small"
              variant={band === predicted ? "contained" : "outlined"}
              onClick={() => (band === predicted ? onConfirm() : onCorrect(band))}
            >
              {t(band)}
            </Button>
          ))
        ) : (
          <Button variant="contained" onClick={onConfirm}>
            {t("confirm")}
          </Button>
        )}
      </CardActions>
    </Card>
  );
}
