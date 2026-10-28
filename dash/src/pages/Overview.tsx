import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AltRouteOutlined from "@mui/icons-material/AltRouteOutlined";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import GridOnOutlined from "@mui/icons-material/GridOnOutlined";
import PhotoCameraOutlined from "@mui/icons-material/PhotoCameraOutlined";
import ShowChartOutlined from "@mui/icons-material/ShowChartOutlined";
import StackedBarChartOutlined from "@mui/icons-material/StackedBarChartOutlined";
import { type FillBand } from "../api";
import EChart, { areaOption, heatmapOption, intlLocale } from "../components/EChart";
import {
  ChartSkeleton,
  CodeLabel,
  EmptyState,
  ErrorPanel,
  GAP,
  PageHeader,
  PageStack,
  SectionCard,
  StackBar,
  StatCard,
  StatRow,
  StatRowSkeleton,
  Tag,
  type Tone,
} from "../components/ui";
import { useApi } from "../useApi";
import { useI18n, type StringKey } from "../i18n";
import { owi } from "../theme";

interface OverviewData {
  window_days: number;
  bins_registered: number;
  bins_reported: number;
  reports: number;
  reports_prev: number;
  overflowing: number;
  per_day: { date: string; reports: number; overflowing: number }[];
  fill_mix: Record<FillBand, number>;
  heatmap: number[][];
  latest: {
    id: string;
    captured_at: string;
    qr_code: string | null;
    site_name: string | null;
    fill_tap: FillBand | null;
  }[];
}

const BANDS: FillBand[] = ["empty", "low", "half", "high", "overflowing"];
const BAND_COLOR: Record<FillBand, string> = {
  empty: "#e6e1d5",
  low: "#c9c3b5",
  half: owi.faint,
  high: owi.inkSoft,
  overflowing: owi.bad,
};
const BAND_TONE: Record<FillBand, Tone> = {
  empty: "ok",
  low: "ok",
  half: "neutral",
  high: "warn",
  overflowing: "bad",
};
const WEEK = 7;
const TREND_DAYS = 14;
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

export default function Overview() {
  const { t, lang } = useI18n();
  const locale = intlLocale(lang);
  const navigate = useNavigate();
  const { data: week, error, retry } = useApi<OverviewData>(`/api/v1/analytics/overview?days=${WEEK}`);
  const { data: fortnight } = useApi<OverviewData>(`/api/v1/analytics/overview?days=${TREND_DAYS}`);

  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)));
  }, [locale]);

  const trend = useMemo(() => {
    const days = (fortnight ?? week)?.per_day ?? [];
    const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
    return {
      labels: days.map((d) => fmt.format(new Date(`${d.date}T00:00:00`))),
      values: days.map((d) => d.reports),
    };
  }, [fortnight, week, locale]);

  const activity = useMemo(() => {
    const data: [number, number, number][] = [];
    let max = 0;
    (week?.heatmap ?? []).forEach((row, r) =>
      row.forEach((v, h) => {
        data.push([h, r, v]);
        if (v > max) max = v;
      }),
    );
    return { data, max };
  }, [week]);

  if (error) {
    return (
      <PageStack>
        <ErrorPanel message={t("errorLoad")} retryLabel={t("retry")} onRetry={retry} />
      </PageStack>
    );
  }

  if (week === null) {
    return (
      <PageStack>
        <StatRowSkeleton />
        <Grid container spacing={GAP}>
          <Grid size={{ xs: 12, md: 7 }}>
            <ChartSkeleton />
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <ChartSkeleton />
          </Grid>
        </Grid>
      </PageStack>
    );
  }

  if (week.bins_registered === 0) {
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
          <Stack spacing={1.75} sx={{ mb: 3 }}>
            {steps.map((s, i) => (
              <Stack key={i} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                <Typography
                  sx={{ width: 20, color: owi.brown, fontWeight: 760, fontVariantNumeric: "tabular-nums" }}
                >
                  {i + 1}
                </Typography>
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

  const fillMix = BANDS.map((b) => ({ label: t(b as StringKey), value: week.fill_mix[b], color: BAND_COLOR[b] }));
  const change =
    week.reports_prev > 0
      ? t("changeVsPrevious")
          .replace("{d}", `${week.reports >= week.reports_prev ? "+" : "−"}${Math.round((Math.abs(week.reports - week.reports_prev) / week.reports_prev) * 100)}%`)
          .replace("{n}", String(WEEK))
      : undefined;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
  const ago = (iso: string) => {
    const s = (Date.now() - Date.parse(iso)) / 1000;
    if (s < 60) return t("justNow");
    if (s < 3600) return rtf.format(-Math.round(s / 60), "minute");
    if (s < 86400) return rtf.format(-Math.round(s / 3600), "hour");
    return rtf.format(-Math.round(s / 86400), "day");
  };

  return (
    <PageStack>
      <StatRow>
        <StatCard
          label={t("totalBins")}
          value={week.bins_registered.toLocaleString()}
          caption={t("binsReported").replace("{n}", week.bins_reported.toLocaleString())}
        />
        <StatCard
          label={t("reports7d")}
          value={week.reports.toLocaleString()}
          caption={change}
          spark={week.per_day.map((d) => d.reports)}
        />
        <StatCard
          label={t("overflowing7d")}
          value={week.overflowing.toLocaleString()}
          color={week.overflowing > 0 ? owi.bad : undefined}
          spark={week.per_day.map((d) => d.overflowing)}
        />
      </StatRow>

      <Grid container spacing={GAP}>
        <Grid size={{ xs: 12, md: 7 }}>
          <SectionCard title={t("reportsPerDayTitle")} hint={t("lastDaysHint").replace("{n}", String(trend.values.length))}>
            {trend.values.some((v) => v > 0) ? (
              <EChart height={236} option={areaOption(trend.labels, trend.values)} />
            ) : (
              <EmptyState icon={<ShowChartOutlined />} title={t("noData")} height={236} />
            )}
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <SectionCard title={t("fillMix")} hint={t("lastDaysHint").replace("{n}", String(WEEK))}>
            {fillMix.some((b) => b.value > 0) ? (
              <StackBar items={fillMix} />
            ) : (
              <EmptyState icon={<StackedBarChartOutlined />} title={t("noData")} height={236} />
            )}
          </SectionCard>
        </Grid>
      </Grid>

      <Grid container spacing={GAP}>
        <Grid size={{ xs: 12, md: 7 }}>
          <SectionCard
            title={t("latestReports")}
            hint={t("liveFromField")}
            action={
              <Button
                size="small"
                endIcon={<ArrowForwardOutlined sx={{ fontSize: 16 }} />}
                onClick={() => navigate("/records/reports")}
              >
                {t("viewAll")}
              </Button>
            }
          >
            {week.latest.length === 0 ? (
              <EmptyState icon={<PhotoCameraOutlined />} title={t("noData")} />
            ) : (
              <Box sx={{ mt: -0.5 }}>
                {week.latest.map((o) => (
                  <Box
                    key={o.id}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "8.5em minmax(0, 1fr) auto 7em",
                      alignItems: "center",
                      columnGap: 2,
                      py: 1.25,
                      borderTop: "1px solid",
                      borderColor: owi.rule,
                      fontSize: "0.92rem",
                      color: owi.inkSoft,
                      "&:first-of-type": { borderTop: 0 },
                    }}
                  >
                    <Typography noWrap sx={{ fontSize: "inherit" }}>
                      <CodeLabel>{o.qr_code ?? t("noBin")}</CodeLabel>
                    </Typography>
                    <Typography noWrap sx={{ fontSize: "inherit", color: "inherit" }}>
                      {o.site_name ?? "—"}
                    </Typography>
                    {o.fill_tap ? <Tag tone={BAND_TONE[o.fill_tap]}>{t(o.fill_tap as StringKey)}</Tag> : <span />}
                    <Typography
                      component="time"
                      dateTime={o.captured_at}
                      title={new Date(o.captured_at).toLocaleString()}
                      sx={{ fontSize: "0.84rem", color: "text.secondary", textAlign: "right", whiteSpace: "nowrap" }}
                    >
                      {ago(o.captured_at)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <SectionCard title={t("activityTitle")} hint={t("lastDaysHint").replace("{n}", String(WEEK))}>
            {week.reports > 0 ? (
              <EChart height={250} option={heatmapOption(HOURS, weekdays, activity.data, activity.max)} />
            ) : (
              <EmptyState icon={<GridOnOutlined />} title={t("noData")} height={250} />
            )}
          </SectionCard>
        </Grid>
      </Grid>
    </PageStack>
  );
}
