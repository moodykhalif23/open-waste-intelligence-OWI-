import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import { api, apiBlob } from "../api";
import { EmptyState, ErrorPanel, GAP, PageHeader, PageSkeleton, PageStack, Pager, SectionCard, Tag } from "../components/ui";
import { useI18n, type StringKey } from "../i18n";
import { owi } from "../theme";

const PER_PAGE = 9;

const FILL_BANDS = ["empty", "low", "half", "high", "overflowing"] as const;

const labelKey = (p: Prediction) => (p.task === "fill" ? "fill_band" : "material");

function labelOptions(p: Prediction): string[] {
  if (p.task === "fill") return [...FILL_BANDS];
  const scores = p.payload.scores;
  if (p.task !== "classify" || !scores || typeof scores !== "object") return [];
  return Object.entries(scores as Record<string, number>)
    .sort((a, b) => b[1] - a[1])
    .map(([label]) => label);
}

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
  const [page, setPage] = useState(0);

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

  async function correct(p: Prediction, value: string) {
    await api(`/api/v1/predictions/${p.id}/review`, {
      method: "POST",
      body: JSON.stringify({ action: "correct", corrected_payload: { [labelKey(p)]: value } }),
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

  const pages = Math.max(1, Math.ceil(queue.items.length / PER_PAGE));
  const current = Math.min(page, pages - 1);
  const items = queue.items.slice(current * PER_PAGE, (current + 1) * PER_PAGE);

  return (
    <PageStack>
      <PageHeader
        title={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Typography variant="h5">{t("reviewQueue")}</Typography>
            <Tag tone="warn">{t("pendingCount").replace("{n}", queue.unreviewed.toLocaleString())}</Tag>
          </Box>
        }
        description={queue.items.length > 0 ? `${t("reviewLede")} ${t("reviewPickHint")}` : undefined}
      />
      {queue.items.length === 0 ? (
        <SectionCard>
          <EmptyState icon={<FactCheckOutlinedIcon />} title={t("reviewEmpty")} />
        </SectionCard>
      ) : (
        <Box>
          <Grid container spacing={GAP}>
            {items.map((p) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={p.id}>
                <ReviewItem
                  prediction={p}
                  onConfirm={() => void confirm(p)}
                  onCorrect={(value) => void correct(p, value)}
                />
              </Grid>
            ))}
          </Grid>
          {queue.items.length > PER_PAGE && (
            <Pager page={current} pageSize={PER_PAGE} total={queue.items.length} onPage={setPage} ofLabel={t("of")} />
          )}
        </Box>
      )}
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
  onCorrect: (value: string) => void;
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

  const predicted = String(prediction.payload[labelKey(prediction)] ?? "");
  const confidence = typeof prediction.payload.confidence === "number" ? prediction.payload.confidence : null;
  const options = labelOptions(prediction);
  const name = (v: string) => (t(v as StringKey) as string | undefined) ?? v;

  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <CardMedia
        component="img"
        image={imageUrl ?? undefined}
        alt=""
        sx={{ height: 150, objectFit: "cover", bgcolor: "#f0ede5" }}
      />
      <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 1.25, pt: 1.75 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1 }}>
          <Typography variant="body2" sx={{ color: owi.inkSoft }}>
            {t("model")}:{" "}
            <Box component="strong" sx={{ color: "text.primary" }}>
              {predicted ? name(predicted) : "—"}
            </Box>
            {confidence !== null && (
              <Box component="span" sx={{ color: "text.secondary" }}>{` · ${Math.round(confidence * 100)}%`}</Box>
            )}
          </Typography>
          <Tag>{prediction.task}</Tag>
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: "auto" }}>
          {options.length > 0 ? (
            options.map((value) => {
              const guess = value === predicted;
              return (
                <Button
                  key={value}
                  size="small"
                  variant={guess ? "contained" : "outlined"}
                  color={guess ? "secondary" : "primary"}
                  onClick={() => (guess ? onConfirm() : onCorrect(value))}
                  sx={{ borderRadius: 999, px: 1.5, minWidth: 0, height: 30 }}
                >
                  {prediction.task === "fill" ? t(value as (typeof FILL_BANDS)[number]) : name(value)}
                </Button>
              );
            })
          ) : (
            <Button variant="contained" size="small" onClick={onConfirm}>
              {t("confirm")}
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
