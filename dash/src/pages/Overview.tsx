import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import PhotoCameraOutlined from "@mui/icons-material/PhotoCameraOutlined";
import WarningAmberOutlined from "@mui/icons-material/WarningAmberOutlined";
import AltRouteOutlined from "@mui/icons-material/AltRouteOutlined";
import BarChartOutlined from "@mui/icons-material/BarChartOutlined";
import GridOnOutlined from "@mui/icons-material/GridOnOutlined";
import ShowChartOutlined from "@mui/icons-material/ShowChartOutlined";
import { type Bin, type FillBand, type Observation } from "../api";
import EChart, { barOption, heatmapOption, lineOption } from "../components/EChart";
import {
  EmptyState,
  ErrorPanel,
  PageHeader,
  PageSkeleton,
  PageStack,
  SectionCard,
  StatCard,
} from "../components/ui";
import { useApi } from "../useApi";
import { useI18n, type StringKey } from "../i18n";

const BANDS: FillBand[] = ["empty", "low", "half", "high", "overflowing"];
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i));

export default function Overview() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const {
    data: observations,
    error: observationsError,
    retry: retryObservations,
  } = useApi<Observation[]>("/api/v1/observations?limit=1000");
  const { data: bins, error: binsError, retry: retryBins } = useApi<Bin[]>("/api/v1/bins");

  const week = useMemo(
    () =>
      (observations ?? []).filter((o) => Date.now() - new Date(o.captured_at).getTime() < 7 * DAY_MS),
    [observations],
  );

  const perDay = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const date = new Date(Date.now() - (13 - i) * DAY_MS);
      return date.toISOString().slice(0, 10);
    });
    const counts = new Map(days.map((d) => [d, 0]));
    for (const o of observations ?? []) {
      const day = o.captured_at.slice(0, 10);
      if (counts.has(day)) counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return {
      categories: days.map((d) => d.slice(5)),
      values: days.map((d) => counts.get(d) ?? 0),
    };
  }, [observations]);

  const activity = useMemo(() => {
    const grid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
    for (const o of observations ?? []) {
      const dt = new Date(o.captured_at);
      const row = grid[(dt.getDay() + 6) % 7]!;
      const h = dt.getHours();
      row[h] = (row[h] ?? 0) + 1;
    }
    const data: [number, number, number][] = [];
    let max = 0;
    for (let r = 0; r < 7; r++)
      for (let h = 0; h < 24; h++) {
        const v = grid[r]![h] ?? 0;
        if (v > 0) {
          data.push([h, r, v]);
          if (v > max) max = v;
        }
      }
    return { data, max };
  }, [observations]);

  const fillDist = useMemo(() => {
    const counts = new Map<FillBand, number>(BANDS.map((b) => [b, 0]));
    for (const o of week) {
      if (o.fill_tap) counts.set(o.fill_tap, (counts.get(o.fill_tap) ?? 0) + 1);
    }
    return {
      categories: BANDS.map((b) => t(b as StringKey)),
      values: BANDS.map((b) => counts.get(b) ?? 0),
    };
  }, [week, t]);

  if (observationsError || binsError) {
    return (
      <PageStack>
        <ErrorPanel
          message={t("errorLoad")}
          retryLabel={t("retry")}
          onRetry={() => {
            if (observationsError) retryObservations();
            if (binsError) retryBins();
          }}
        />
      </PageStack>
    );
  }

  if (observations === null || bins === null) return <PageSkeleton />;

  if (bins.length === 0) {
    const steps: { icon: ReactNode; text: string }[] = [
      { icon: <DeleteOutlineOutlined fontSize="small" />, text: t("gsStep1") },
      { icon: <PhotoCameraOutlined fontSize="small" />, text: t("gsStep2") },
      { icon: <PhotoCameraOutlined fontSize="small" />, text: t("gsStep3") },
      { icon: <AltRouteOutlined fontSize="small" />, text: t("gsStep4") },
    ];
    return (
      <PageStack>
        <PageHeader title={t("gsTitle")} description={t("gsIntro")} />
        <SectionCard>
          <Stack spacing={1.5} sx={{ mb: 3 }}>
            {steps.map((s, i) => (
              <Stack key={i} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    flexShrink: 0,
                    borderRadius: "4px",
                    bgcolor: "#fbeecf",
                    color: "#835a09",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 800,
                    fontSize: "0.85rem",
                  }}
                >
                  {i + 1}
                </Box>
                <Typography sx={{ fontWeight: 550 }}>{s.text}</Typography>
              </Stack>
            ))}
          </Stack>
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1.5 }}>
            <Button variant="contained" startIcon={<DeleteOutlineOutlined />} onClick={() => navigate("/records/bins")}>
              {t("newBin")}
            </Button>
            <Button variant="outlined" startIcon={<AltRouteOutlined />} onClick={() => navigate("/routes")}>
              {t("routes")}
            </Button>
          </Stack>
        </SectionCard>
      </PageStack>
    );
  }

  const overflowing = week.filter((o) => o.fill_tap === "overflowing").length;

  return (
    <PageStack>
      <PageHeader description={t("signInTagline")} />
      <Grid container spacing={{ xs: 2, md: 2.5 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard label={t("totalBins")} value={bins.length} icon={<DeleteOutlineOutlined />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard label={t("reports7d")} value={week.length} icon={<PhotoCameraOutlined />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard label={t("overflowing7d")} value={overflowing} color="#c0392b" icon={<WarningAmberOutlined />} />
        </Grid>
      </Grid>
      <Grid container spacing={{ xs: 2, md: 2.5 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <SectionCard title={t("activityHeatmap")}>
            {activity.data.length > 0 ? (
              <EChart height={260} option={heatmapOption(HOURS, WEEKDAYS, activity.data, activity.max)} />
            ) : (
              <Box sx={{ height: 260, display: "grid", placeItems: "center" }}>
                <EmptyState icon={<GridOnOutlined />} title={t("noData")} />
              </Box>
            )}
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SectionCard title={t("fillDistribution")}>
            {week.some((o) => o.fill_tap) ? (
              <EChart height={260} option={barOption(fillDist.categories, fillDist.values)} />
            ) : (
              <Box sx={{ height: 260, display: "grid", placeItems: "center" }}>
                <EmptyState icon={<BarChartOutlined />} title={t("noData")} />
              </Box>
            )}
          </SectionCard>
        </Grid>
      </Grid>

      <SectionCard title={t("reportsPerDay")}>
        {perDay.values.some((v) => v > 0) ? (
          <EChart height={240} option={lineOption(perDay.categories, perDay.values)} />
        ) : (
          <Box sx={{ height: 240, display: "grid", placeItems: "center" }}>
            <EmptyState icon={<ShowChartOutlined />} title={t("noData")} />
          </Box>
        )}
      </SectionCard>
    </PageStack>
  );
}
