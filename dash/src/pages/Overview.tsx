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
import { type Bin, type FillBand, type Observation, type Site } from "../api";
import EChart, { areaOption, bucketHours, bucketSeries, heatmapOption, intlLocale } from "../components/EChart";
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
const DAY_MS = 24 * 60 * 60 * 1000;
const OBS_LIMIT = 1000;
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

export default function Overview() {
  const { t, lang } = useI18n();
  const locale = intlLocale(lang);
  const navigate = useNavigate();
  const {
    data: observations,
    error: observationsError,
    retry: retryObservations,
  } = useApi<Observation[]>(`/api/v1/observations?limit=${OBS_LIMIT}`);
  const { data: bins, error: binsError, retry: retryBins } = useApi<Bin[]>("/api/v1/bins");
  const { data: sites } = useApi<Site[]>("/api/v1/sites");

  const week = useMemo(
    () =>
      (observations ?? []).filter((o) => Date.now() - new Date(o.captured_at).getTime() < 7 * DAY_MS),
    [observations],
  );

  const sample = useMemo(() => {
    const list = observations ?? [];
    const truncated = list.length >= OBS_LIMIT;
    const oldest = list.length > 0 ? Date.parse(list[list.length - 1]!.captured_at) : Date.now();
    const spanDays = (Date.now() - oldest) / DAY_MS;
    return { truncated, spanDays, partialWeek: truncated && spanDays < 7 };
  }, [observations]);

  const trend = useMemo(() => {
    const stamps = (observations ?? []).map((o) => o.captured_at);
    const overflow = (observations ?? []).filter((o) => o.fill_tap === "overflowing").map((o) => o.captured_at);
    if (sample.truncated && sample.spanDays < 3) {
      const hours = Math.max(6, Math.ceil(sample.spanDays * 24));
      const main = bucketHours(stamps, hours, locale);
      return {
        unit: "hour" as const,
        main,
        reports: main.values,
        overflow: bucketHours(overflow, hours, locale).values,
      };
    }
    const days = sample.truncated ? Math.max(3, Math.min(14, Math.floor(sample.spanDays))) : 14;
    return {
      unit: "day" as const,
      main: bucketSeries(stamps, days, locale),
      reports: bucketSeries(stamps, 7, locale).values,
      overflow: bucketSeries(overflow, 7, locale).values,
    };
  }, [observations, sample, locale]);

  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)));
  }, [locale]);

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
        data.push([h, r, v]);
        if (v > max) max = v;
      }
    return { data, max };
  }, [observations]);

  const fillMix = useMemo(() => {
    const counts = new Map<FillBand, number>(BANDS.map((b) => [b, 0]));
    for (const o of week) {
      if (o.fill_tap) counts.set(o.fill_tap, (counts.get(o.fill_tap) ?? 0) + 1);
    }
    return BANDS.map((b) => ({ label: t(b as StringKey), value: counts.get(b) ?? 0, color: BAND_COLOR[b] }));
  }, [week, t]);

  const binById = useMemo(() => new Map((bins ?? []).map((b) => [b.id, b])), [bins]);
  const siteById = useMemo(() => new Map((sites ?? []).map((s) => [s.id, s])), [sites]);

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

  if (observations === null || bins === null) {
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

  const overflowing = week.filter((o) => o.fill_tap === "overflowing").length;
  const reportingBins = new Set(week.map((o) => o.bin_id).filter(Boolean)).size;
  const sampleHint = sample.truncated ? t("basedOnLatest").replace("{n}", OBS_LIMIT.toLocaleString()) : undefined;
  const atLeast = (n: number) => `${n.toLocaleString()}${sample.partialWeek ? "+" : ""}`;
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
          value={bins.length.toLocaleString()}
          caption={t("binsReported").replace("{n}", atLeast(reportingBins))}
        />
        <StatCard label={t("reports7d")} value={atLeast(week.length)} spark={trend.reports} />
        <StatCard
          label={t("overflowing7d")}
          value={atLeast(overflowing)}
          color={overflowing > 0 ? owi.bad : undefined}
          spark={trend.overflow}
        />
      </StatRow>

      <Grid container spacing={GAP}>
        <Grid size={{ xs: 12, md: 7 }}>
          <SectionCard
            title={t(trend.unit === "hour" ? "reportsPerHourTitle" : "reportsPerDayTitle")}
            hint={sampleHint ?? t("lastDaysHint").replace("{n}", String(trend.main.values.length))}
          >
            {trend.main.values.some((v) => v > 0) ? (
              <EChart height={236} option={areaOption(trend.main.labels, trend.main.values)} />
            ) : (
              <EmptyState icon={<ShowChartOutlined />} title={t("noData")} height={236} />
            )}
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <SectionCard title={t("fillMix")} hint={t("lastDaysHint").replace("{n}", "7")}>
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
            {observations.length === 0 ? (
              <EmptyState icon={<PhotoCameraOutlined />} title={t("noData")} />
            ) : (
              <Box sx={{ mt: -0.5 }}>
                {observations.slice(0, 6).map((o) => {
                  const bin = o.bin_id ? binById.get(o.bin_id) : undefined;
                  const site = bin ? siteById.get(bin.site_id) : undefined;
                  return (
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
                        <CodeLabel>{bin?.qr_code ?? t("noBin")}</CodeLabel>
                      </Typography>
                      <Typography noWrap sx={{ fontSize: "inherit", color: "inherit" }}>
                        {site?.name ?? "—"}
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
                  );
                })}
              </Box>
            )}
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <SectionCard title={t("activityTitle")} hint={sampleHint ?? t("byDayHour")}>
            {observations.length > 0 ? (
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
