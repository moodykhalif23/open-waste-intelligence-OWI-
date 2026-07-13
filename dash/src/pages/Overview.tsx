import { useEffect, useMemo, useState } from "react";
import Grid from "@mui/material/Grid";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import PhotoCameraOutlined from "@mui/icons-material/PhotoCameraOutlined";
import WarningAmberOutlined from "@mui/icons-material/WarningAmberOutlined";
import { api, type Bin, type FillBand, type Observation } from "../api";
import EChart, { barOption, heatmapOption, lineOption } from "../components/EChart";
import { Muted, PageHeader, PageStack, SectionCard, StatCard } from "../components/ui";
import { useI18n, type StringKey } from "../i18n";

const BANDS: FillBand[] = ["empty", "low", "half", "high", "overflowing"];
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i));

export default function Overview() {
  const { t } = useI18n();
  const [observations, setObservations] = useState<Observation[] | null>(null);
  const [bins, setBins] = useState<Bin[] | null>(null);

  useEffect(() => {
    void api<Observation[]>("/api/v1/observations?limit=1000").then(setObservations);
    void api<Bin[]>("/api/v1/bins").then(setBins);
  }, []);

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

  if (observations === null || bins === null) return <Muted>{t("loading")}</Muted>;

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
          <StatCard label={t("overflowing7d")} value={overflowing} color="#b91c1c" icon={<WarningAmberOutlined />} />
        </Grid>
      </Grid>
      <Grid container spacing={{ xs: 2, md: 2.5 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <SectionCard title={t("activityHeatmap")}>
            {activity.data.length > 0 ? (
              <EChart height={260} option={heatmapOption(HOURS, WEEKDAYS, activity.data, activity.max)} />
            ) : (
              <Muted>{t("noData")}</Muted>
            )}
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SectionCard title={t("fillDistribution")}>
            {week.some((o) => o.fill_tap) ? (
              <EChart height={260} option={barOption(fillDist.categories, fillDist.values)} />
            ) : (
              <Muted>{t("noData")}</Muted>
            )}
          </SectionCard>
        </Grid>
      </Grid>

      <SectionCard title={t("reportsPerDay")}>
        <EChart height={240} option={lineOption(perDay.categories, perDay.values)} />
      </SectionCard>
    </PageStack>
  );
}
