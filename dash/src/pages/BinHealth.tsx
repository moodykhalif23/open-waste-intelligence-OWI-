import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import RefreshIcon from "@mui/icons-material/Refresh";
import { api } from "../api";
import { DataTable, type GridColDef } from "../components/DataTable";
import { Muted, PageStack, SectionCard, StatCard } from "../components/ui";
import { useI18n } from "../i18n";

interface HealthRow {
  bin_id: string;
  qr_code: string;
  site_name: string;
  date: string;
  fill_pct: number;
  days_to_full: number | null;
  days_since_collection: number | null;
  overflow_risk: "low" | "medium" | "high";
  recommendation: "collect_today" | "schedule_soon" | "no_action";
}

const RISK_COLOR = {
  high: "error",
  medium: "warning",
  low: "success",
} as const;

export default function BinHealth() {
  const { t } = useI18n();
  const [rows, setRows] = useState<HealthRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setRows(await api<HealthRow[]>("/api/v1/bins/health"));
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function refresh() {
    setBusy(true);
    try {
      await api("/api/v1/admin/analytics/refresh", { method: "POST" });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function markCollected(row: HealthRow) {
    await api("/api/v1/collections", {
      method: "POST",
      body: JSON.stringify({ bin_id: row.bin_id }),
    });
    await reload();
  }

  const stats = useMemo(() => {
    const list = rows ?? [];
    return {
      total: list.length,
      high: list.filter((r) => r.overflow_risk === "high").length,
      collectToday: list.filter((r) => r.recommendation === "collect_today").length,
      scheduleSoon: list.filter((r) => r.recommendation === "schedule_soon").length,
    };
  }, [rows]);

  if (rows === null) return <Muted>{t("loading")}</Muted>;

  const refreshAction = (
    <Button
      variant="outlined"
      size="small"
      startIcon={<RefreshIcon />}
      onClick={() => void refresh()}
      disabled={busy}
    >
      {busy ? t("refreshing") : t("refresh")}
    </Button>
  );

  const riskLabel = (r: HealthRow["overflow_risk"]) =>
    t(r === "high" ? "riskHigh" : r === "medium" ? "riskMedium" : "riskLow");

  const columns: GridColDef<HealthRow>[] = [
    { field: "qr_code", headerName: t("bin"), flex: 1, minWidth: 140, renderCell: (p) => <Box sx={{ fontFamily: "ui-monospace, monospace" }}>{p.value as string}</Box> },
    { field: "site_name", headerName: t("site"), flex: 1, minWidth: 130 },
    { field: "fill_pct", headerName: t("fillLevel"), type: "number", width: 120, valueFormatter: (v) => `${Math.round(Number(v))}%` },
    { field: "days_to_full", headerName: t("daysToFull"), type: "number", width: 130, valueFormatter: (v) => (v == null ? "—" : Number(v).toFixed(1)) },
    { field: "days_since_collection", headerName: t("sinceCollection"), type: "number", width: 150, valueFormatter: (v) => (v == null ? "—" : Number(v).toFixed(1)) },
    { field: "overflow_risk", headerName: t("risk"), width: 120, renderCell: (p) => <Chip size="small" color={RISK_COLOR[p.row.overflow_risk]} label={riskLabel(p.row.overflow_risk)} /> },
    {
      field: "recommendation",
      headerName: t("recommendation"),
      flex: 1,
      minWidth: 150,
      valueGetter: (_v, row) =>
        row.recommendation === "collect_today" ? t("collectTodayRec") : row.recommendation === "schedule_soon" ? t("scheduleSoonRec") : "—",
    },
    {
      field: "actions",
      headerName: "",
      width: 170,
      sortable: false,
      filterable: false,
      renderCell: (p) => (
        <Button variant="contained" size="small" onClick={() => void markCollected(p.row)}>
          {t("markCollected")}
        </Button>
      ),
    },
  ];

  return (
    <PageStack>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label={t("totalBins")} value={stats.total} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label={t("collectToday")} value={stats.collectToday} color="#b91c1c" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label={t("riskHigh")} value={stats.high} color="#b91c1c" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label={t("scheduleSoonRec")} value={stats.scheduleSoon} />
        </Grid>
      </Grid>

      <SectionCard title={t("collectToday")} action={refreshAction}>
        {rows.length === 0 ? (
          <Muted>{t("noHealthData")}</Muted>
        ) : (
          <DataTable rows={rows} columns={columns} getRowId={(r) => r.bin_id} pageSize={15} />
        )}
      </SectionCard>
    </PageStack>
  );
}
