import Grid from "@mui/material/Grid";
import EnergySavingsLeafOutlined from "@mui/icons-material/EnergySavingsLeafOutlined";
import { DataTable, type GridColDef } from "../components/DataTable";
import {
  EmptyState,
  ErrorPanel,
  GAP,
  Note,
  PageStack,
  RankBars,
  SectionCard,
  StatCard,
  StatRow,
  StatRowSkeleton,
  TableSkeleton,
  rankWithOther,
} from "../components/ui";
import { useApi } from "../useApi";
import { useI18n, type StringKey } from "../i18n";

interface MaterialCarbon {
  material: string;
  kg: number;
  co2e_kg: number;
}

interface Carbon {
  window_days: number;
  method_version: string;
  co2e_avoided_kg: number;
  co2e_low_kg: number;
  co2e_high_kg: number;
  landfill_m3_saved: number;
  plastic_diverted_kg: number;
  trees_equivalent: number;
  car_km_equivalent: number;
  materials: MaterialCarbon[];
}

export default function Carbon() {
  const { t } = useI18n();
  const { data, error, retry } = useApi<Carbon>("/api/v1/carbon?days=30");

  if (error !== null) {
    return (
      <PageStack>
        <ErrorPanel message={t("errorLoad")} retryLabel={t("retry")} onRetry={retry} />
      </PageStack>
    );
  }
  if (data === null) {
    return (
      <PageStack>
        <StatRowSkeleton count={4} />
        <TableSkeleton />
      </PageStack>
    );
  }
  const label = (m: string) => t(m as StringKey);
  const range = `${Math.round(data.co2e_low_kg).toLocaleString()}–${Math.round(data.co2e_high_kg).toLocaleString()}`;
  const ranked = [...data.materials].sort((a, b) => b.co2e_kg - a.co2e_kg);
  const bars = rankWithOther(
    ranked.filter((m) => m.material !== "other_mixed").map((m) => ({ label: label(m.material), value: m.co2e_kg })),
    6,
    label("other_mixed"),
    ranked.filter((m) => m.material === "other_mixed").map((m) => ({ label: label(m.material), value: m.co2e_kg })),
  );
  const columns: GridColDef<MaterialCarbon>[] = [
    { field: "material", headerName: t("material"), flex: 1, minWidth: 110, valueGetter: (_v, row) => label(row.material) },
    { field: "kg", headerName: t("kgEst"), type: "number", flex: 1, minWidth: 90, valueFormatter: (v) => Number(v).toLocaleString() },
    { field: "co2e_kg", headerName: t("co2eKg"), type: "number", flex: 1, minWidth: 90, valueFormatter: (v) => Number(v).toLocaleString() },
  ];

  return (
    <PageStack>
      <StatRow>
        <StatCard label={t("co2eAvoided")} value={range} />
        <StatCard label={t("landfillSaved")} value={data.landfill_m3_saved.toLocaleString()} />
        <StatCard label={t("plasticDiverted")} value={Math.round(data.plastic_diverted_kg).toLocaleString()} />
        <StatCard label={t("treesEquiv")} value={`≈${data.trees_equivalent.toLocaleString()}`} />
      </StatRow>

      {data.co2e_avoided_kg === 0 ? (
        <SectionCard>
          <EmptyState icon={<EnergySavingsLeafOutlined />} title={t("noCarbonYet")} />
        </SectionCard>
      ) : (
        <Grid container spacing={GAP}>
          <Grid size={{ xs: 12, md: 6 }}>
            <SectionCard title={t("co2eByMaterial")} hint={t("lastDaysHint").replace("{n}", String(data.window_days))}>
              <RankBars items={bars} format={(v) => `${Math.round(v).toLocaleString()} kg`} />
            </SectionCard>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <DataTable rows={ranked} columns={columns} getRowId={(r) => r.material} toolbar={false} pageSize={8} />
          </Grid>
        </Grid>
      )}

      <Note>
        {t("carbonNotOffsets")} ({t("methodology")}: {data.method_version}, ≈{t("carEquiv")}{" "}
        {data.car_km_equivalent.toLocaleString()} km)
      </Note>
    </PageStack>
  );
}
