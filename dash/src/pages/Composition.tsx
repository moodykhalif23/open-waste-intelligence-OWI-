import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Grid from "@mui/material/Grid";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import DonutLargeOutlined from "@mui/icons-material/DonutLargeOutlined";
import { DataTable, type GridColDef } from "../components/DataTable";
import {
  ChartSkeleton,
  EmptyState,
  ErrorPanel,
  FilterChips,
  GAP,
  PageStack,
  RankBars,
  SectionCard,
  StatCard,
  TableSection,
  TableSkeleton,
  Tag,
  rankWithOther,
} from "../components/ui";
import { useApi } from "../useApi";
import { useI18n, type StringKey } from "../i18n";

interface MaterialShare {
  material: string;
  count: number;
  share_pct: number;
  delta_pct: number | null;
}

interface Composition {
  window_days: number;
  total: number;
  sufficient: boolean;
  materials: MaterialShare[];
}

const PERIODS = ["7", "30", "90"] as const;
type Period = (typeof PERIODS)[number];

export default function Composition() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [days, setDays] = useState<Period>("7");
  const { data, error, retry } = useApi<Composition>(`/api/v1/analytics/composition?days=${days}`);

  const label = (m: string) => t(m as StringKey);
  const pctFmt = (v: number) => `${Math.round(v)}%`;

  const columns: GridColDef<MaterialShare>[] = [
    { field: "material", headerName: t("material"), flex: 1, minWidth: 120, valueGetter: (_v, row) => label(row.material) },
    { field: "share_pct", headerName: t("share"), type: "number", width: 110, valueFormatter: (v) => `${v}%` },
    {
      field: "delta_pct",
      headerName: t("change"),
      type: "number",
      width: 120,
      renderCell: (p) =>
        p.value == null ? (
          "—"
        ) : (
          <Tag>{`${(p.value as number) >= 0 ? "▲" : "▼"} ${Math.abs(p.value as number)}`}</Tag>
        ),
    },
    { field: "count", headerName: t("observationsCol"), type: "number", width: 120, valueFormatter: (v) => Number(v).toLocaleString() },
    {
      field: "actions",
      headerName: "",
      width: 110,
      sortable: false,
      filterable: false,
      disableExport: true,
      align: "right",
      renderCell: (p) => (
        <Button size="small" variant="outlined" onClick={() => navigate(`/records/reports?material=${p.row.material}`)}>
          {t("view")}
        </Button>
      ),
    },
  ];

  const periodChips = (
    <FilterChips<Period>
      value={days}
      onChange={setDays}
      options={PERIODS.map((p) => ({ value: p, label: t("lastNDays").replace("{n}", p) }))}
    />
  );

  const ranked = data
    ? rankWithOther(
        data.materials.filter((m) => m.material !== "other_mixed").map((m) => ({ label: label(m.material), value: m.share_pct })),
        6,
        label("other_mixed"),
        data.materials.filter((m) => m.material === "other_mixed").map((m) => ({ label: label(m.material), value: m.share_pct })),
      )
    : [];
  const top = data ? [...data.materials].sort((a, b) => b.share_pct - a.share_pct)[0] : undefined;
  const shift = data
    ? [...data.materials]
        .filter((m) => m.delta_pct != null)
        .sort((a, b) => Math.abs(b.delta_pct ?? 0) - Math.abs(a.delta_pct ?? 0))[0]
    : undefined;

  return (
    <PageStack>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Typography variant="h5">{t("wasteComposition")}</Typography>
        {periodChips}
      </Box>

      {error !== null ? (
        <ErrorPanel message={t("errorLoad")} retryLabel={t("retry")} onRetry={retry} />
      ) : data === null ? (
        <>
          <Grid container spacing={GAP}>
            <Grid size={{ xs: 12, md: 7.5 }}>
              <ChartSkeleton height={260} />
            </Grid>
            <Grid size={{ xs: 12, md: 4.5 }}>
              <ChartSkeleton height={260} />
            </Grid>
          </Grid>
          <TableSkeleton />
        </>
      ) : data.total === 0 ? (
        <SectionCard>
          <EmptyState icon={<DonutLargeOutlined />} title={t("noComposition")} />
        </SectionCard>
      ) : (
        <>
          {!data.sufficient && (
            <Alert severity="warning">
              {t("insufficientData").replace("{n}", String(data.total))}
            </Alert>
          )}

          <Grid container spacing={GAP}>
            <Grid size={{ xs: 12, md: 7.5 }}>
              <SectionCard
                title={t("materialMix")}
                hint={`${t("lastDaysHint").replace("{n}", days)} · ${t("photosN").replace("{n}", data.total.toLocaleString())}`}
              >
                <RankBars items={ranked} format={pctFmt} />
              </SectionCard>
            </Grid>
            <Grid size={{ xs: 12, md: 4.5 }}>
              <Stack spacing={GAP} sx={{ height: "100%" }}>
                <StatCard
                  label={t("topMaterial")}
                  value={top ? label(top.material) : "—"}
                  caption={top ? `${Math.round(top.share_pct)}% · ${t("photosN").replace("{n}", top.count.toLocaleString())}` : undefined}
                />
                <StatCard
                  label={t("biggestShift")}
                  value={
                    shift && shift.delta_pct != null
                      ? `${shift.delta_pct >= 0 ? "▲" : "▼"} ${Math.abs(shift.delta_pct)}`
                      : "—"
                  }
                  caption={shift ? `${label(shift.material)} · ${t("vsPrevious")}` : undefined}
                />
                <StatCard label={t("classifiedPhotos")} value={data.total.toLocaleString()} />
              </Stack>
            </Grid>
          </Grid>

          <TableSection>
            <DataTable rows={data.materials} columns={columns} getRowId={(r) => r.material} />
          </TableSection>
        </>
      )}
    </PageStack>
  );
}
