import { useMemo, useState } from "react";
import PlaceOutlined from "@mui/icons-material/PlaceOutlined";
import { DataTable, type GridColDef } from "../components/DataTable";
import {
  EmptyState,
  ErrorPanel,
  FilterChips,
  PageHeader,
  PageSkeleton,
  PageStack,
  SectionCard,
  StatCard,
  StatRow,
  Tag,
  type Tone,
} from "../components/ui";
import { useApi } from "../useApi";
import { useI18n } from "../i18n";
import { owi } from "../theme";

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

const PRIORITY_TONE: Record<WardCoverage["priority"], Tone> = {
  assess: "warn",
  monitor: "ok",
  insufficient_data: "neutral",
};

export default function Coverage() {
  const { t } = useI18n();
  const { data: rows, error, retry } = useApi<WardCoverage[]>("/api/v1/bins/coverage");
  const [view, setView] = useState<"all" | WardCoverage["priority"]>("all");

  const shown = useMemo(
    () => (view === "all" ? (rows ?? []) : (rows ?? []).filter((r) => r.priority === view)),
    [rows, view],
  );

  if (error) {
    return (
      <PageStack>
        <ErrorPanel message={t("errorLoad")} retryLabel={t("retry")} onRetry={retry} />
      </PageStack>
    );
  }
  if (rows === null) return <PageSkeleton />;

  const priorityLabel = (p: WardCoverage["priority"]) =>
    t(p === "assess" ? "coverageAssess" : p === "monitor" ? "coverageMonitor" : "coverageInsufficient");
  const count = (p: WardCoverage["priority"]) => rows.filter((row) => row.priority === p).length;
  const assessedBins = rows.reduce((sum, row) => sum + row.assessed_bin_count, 0);
  const highRisk = rows.reduce((sum, row) => sum + row.high_risk_bin_count, 0);
  const num = (v: unknown) => Number(v).toLocaleString();
  const dates = new Set(rows.map((row) => row.health_data_date));
  const asOf = dates.size === 1 ? [...dates][0] : null;
  const columns: GridColDef<WardCoverage>[] = [
    { field: "ward", headerName: t("ward"), flex: 1, minWidth: 160, renderCell: (p) => <strong>{p.value as string}</strong> },
    { field: "site_count", headerName: t("sites"), type: "number", width: 84, valueFormatter: num },
    {
      field: "sites_without_bins",
      headerName: t("withoutBins"),
      description: t("sitesWithoutBins"),
      type: "number",
      width: 120,
      valueFormatter: num,
    },
    { field: "bin_count", headerName: t("bins"), type: "number", width: 80, valueFormatter: num },
    {
      field: "assessed_bin_count",
      headerName: t("assessed"),
      description: t("assessedBins"),
      type: "number",
      width: 120,
      valueFormatter: num,
    },
    {
      field: "high_risk_bin_count",
      headerName: t("riskHigh"),
      description: t("highRiskBins"),
      type: "number",
      width: 72,
      valueFormatter: num,
    },
    {
      field: "medium_risk_bin_count",
      headerName: t("riskMedium"),
      description: t("mediumRiskBins"),
      type: "number",
      width: 92,
      valueFormatter: num,
    },
    {
      field: "health_data_date",
      headerName: t("updated"),
      description: t("latestHealthDate"),
      width: 120,
      valueFormatter: (value) => (value ? String(value) : "—"),
      renderCell: (p) => <span style={{ whiteSpace: "nowrap" }}>{p.formattedValue as string}</span>,
    },
    {
      field: "priority",
      headerName: t("coveragePriority"),
      width: 168,
      valueGetter: (_value, row) => priorityLabel(row.priority),
      renderCell: (params) => <Tag tone={PRIORITY_TONE[params.row.priority]}>{params.value as string}</Tag>,
    },
    {
      field: "reason",
      headerName: t("coverageReason"),
      flex: 1.6,
      minWidth: 150,
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
      renderCell: (p) => (
        <span
          title={p.value as string}
          style={{ color: owi.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {p.value as string}
        </span>
      ),
    },
  ];

  return (
    <PageStack>
      <StatRow>
        <StatCard label={t("coverageAssess")} value={count("assess").toLocaleString()} caption={`${rows.length.toLocaleString()} ${t("wards").toLowerCase()}`} />
        <StatCard
          label={t("assessedBins")}
          value={assessedBins.toLocaleString()}
          caption={asOf ? t("asOfDate").replace("{d}", asOf) : undefined}
        />
        <StatCard label={t("highRiskBins")} value={highRisk.toLocaleString()} color={highRisk > 0 ? owi.bad : undefined} />
      </StatRow>
      {rows.length === 0 ? (
        <SectionCard>
          <EmptyState icon={<PlaceOutlined />} title={t("coverageNoWards")} />
        </SectionCard>
      ) : (
        <DataTable
          rows={shown}
          columns={columns}
          getRowId={(row) => row.ward}
          columnVisibilityModel={{ health_data_date: dates.size > 1 }}
          pageSize={25}
          filters={
            <FilterChips<"all" | WardCoverage["priority"]>
              value={view}
              onChange={setView}
              options={[
                { value: "all", label: t("all"), count: rows.length },
                { value: "assess", label: t("coverageAssess"), count: count("assess") },
                { value: "monitor", label: t("coverageMonitor"), count: count("monitor") },
                { value: "insufficient_data", label: t("coverageInsufficient"), count: count("insufficient_data") },
              ]}
            />
          }
        />
      )}
    </PageStack>
  );
}
