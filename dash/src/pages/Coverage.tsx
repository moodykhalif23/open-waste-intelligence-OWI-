import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import { DataTable, type GridColDef } from "../components/DataTable";
import {
  EmptyState,
  ErrorPanel,
  PageHeader,
  PageSkeleton,
  PageStack,
  StatCard,
} from "../components/ui";
import { useApi } from "../useApi";
import { useI18n } from "../i18n";

interface WardCoverage {
  ward: string;
  site_count: number;
  bin_count: number;
  assessed_bin_count: number;
  high_risk_bin_count: number;
  medium_risk_bin_count: number;
  sites_without_bins: number;
  health_data_date: string | null;
  priority: "assess" | "monitor" | "insufficient_data";
  reason:
    | "registered_sites_without_bins"
    | "repeated_capacity_pressure"
    | "too_few_assessed_bins"
    | "no_priority_signal";
}

const PRIORITY_COLOR = {
  assess: "warning",
  monitor: "success",
  insufficient_data: "default",
} as const;

export default function Coverage() {
  const { t } = useI18n();
  const { data: rows, error, retry } = useApi<WardCoverage[]>("/api/v1/bins/coverage");

  if (error) {
    return (
      <PageStack>
        <ErrorPanel message={t("errorLoad")} retryLabel={t("retry")} onRetry={retry} />
      </PageStack>
    );
  }
  if (rows === null) return <PageSkeleton />;

  const assessCount = rows.filter((row) => row.priority === "assess").length;
  const assessedBins = rows.reduce((sum, row) => sum + row.assessed_bin_count, 0);
  const columns: GridColDef<WardCoverage>[] = [
    { field: "ward", headerName: t("ward"), flex: 1, minWidth: 140 },
    { field: "site_count", headerName: t("sites"), type: "number", width: 100 },
    { field: "bin_count", headerName: t("bins"), type: "number", width: 100 },
    { field: "assessed_bin_count", headerName: t("assessedBins"), type: "number", width: 130 },
    { field: "high_risk_bin_count", headerName: t("riskHigh"), type: "number", width: 100 },
    { field: "medium_risk_bin_count", headerName: t("riskMedium"), type: "number", width: 120 },
    { field: "sites_without_bins", headerName: t("sitesWithoutBins"), type: "number", width: 150 },
    {
      field: "health_data_date",
      headerName: t("latestHealthDate"),
      width: 140,
      valueFormatter: (value) => (value ? String(value) : "—"),
    },
    {
      field: "priority",
      headerName: t("coveragePriority"),
      width: 180,
      renderCell: (params) => (
        <Chip
          size="small"
          color={PRIORITY_COLOR[params.row.priority]}
          label={t(
            params.row.priority === "assess"
              ? "coverageAssess"
              : params.row.priority === "monitor"
                ? "coverageMonitor"
                : "coverageInsufficient",
          )}
        />
      ),
    },
    {
      field: "reason",
      headerName: t("coverageReason"),
      flex: 1,
      minWidth: 190,
      valueGetter: (_value, row) =>
        t(
          row.reason === "registered_sites_without_bins"
            ? "coverageReasonNoBins"
            : row.reason === "repeated_capacity_pressure"
              ? "coverageReasonPressure"
              : row.reason === "too_few_assessed_bins"
                ? "coverageReasonTooFew"
                : "coverageReasonMonitor",
        ),
    },
  ];

  return (
    <PageStack>
      <PageHeader title={t("coverageTitle")} description={t("coverageDescription")} />
      <Alert severity="info">{t("coverageLimit")}</Alert>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <StatCard label={t("coverageAssess")} value={assessCount} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <StatCard label={t("assessedBins")} value={assessedBins} />
        </Grid>
      </Grid>
      {rows.length === 0 ? (
        <EmptyState title={t("coverageNoWards")} />
      ) : (
        <DataTable rows={rows} columns={columns} getRowId={(row) => row.ward} />
      )}
    </PageStack>
  );
}
