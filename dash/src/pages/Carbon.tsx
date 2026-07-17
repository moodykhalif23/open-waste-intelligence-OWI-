import Alert from "@mui/material/Alert";
import Grid from "@mui/material/Grid";
import EnergySavingsLeafOutlined from "@mui/icons-material/EnergySavingsLeafOutlined";
import { DataTable, type GridColDef } from "../components/DataTable";
import EChart, { hbarOption } from "../components/EChart";
import {
  EmptyState,
  ErrorPanel,
  PageStack,
  Panel,
  SectionCard,
  StatCard,
  StatRowSkeleton,
  TableSkeleton,
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
  const range = `${Math.round(data.co2e_low_kg)}–${Math.round(data.co2e_high_kg)}`;
  const ranked = [...data.materials].sort((a, b) => b.co2e_kg - a.co2e_kg);
  const columns: GridColDef<MaterialCarbon>[] = [
    { field: "material", headerName: t("material"), flex: 1, minWidth: 110, valueGetter: (_v, row) => label(row.material) },
    { field: "kg", headerName: t("kgEst"), type: "number", flex: 1, minWidth: 90, valueFormatter: (v) => Number(v).toLocaleString() },
    { field: "co2e_kg", headerName: t("co2eKg"), type: "number", flex: 1, minWidth: 90, valueFormatter: (v) => Number(v).toLocaleString() },
  ];

  return (
    <PageStack>
      <Grid container spacing={{ xs: 2, md: 2.5 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label={t("co2eAvoided")} value={range} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label={t("landfillSaved")} value={data.landfill_m3_saved} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label={t("plasticDiverted")} value={Math.round(data.plastic_diverted_kg)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label={t("treesEquiv")} value={`≈${data.trees_equivalent}`} />
        </Grid>
      </Grid>

      {data.co2e_avoided_kg === 0 ? (
        <EmptyState icon={<EnergySavingsLeafOutlined />} title={t("noCarbonYet")} />
      ) : (
        <SectionCard title={t("co2eByMaterial")}>
          <Grid container spacing={{ xs: 2, md: 2.5 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Panel>
                <EChart
                  height={Math.max(180, ranked.length * 34)}
                  option={hbarOption(
                    ranked.map((m) => label(m.material)),
                    ranked.map((m) => m.co2e_kg),
                  )}
                />
              </Panel>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <DataTable rows={ranked} columns={columns} getRowId={(r) => r.material} toolbar={false} pageSize={8} />
            </Grid>
          </Grid>
        </SectionCard>
      )}

      <Alert severity="info">
        {t("carbonNotOffsets")} ({t("methodology")}: {data.method_version}, ≈{t("carEquiv")}{" "}
        {data.car_km_equivalent.toLocaleString()} km)
      </Alert>
    </PageStack>
  );
}
