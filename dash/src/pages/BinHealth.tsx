import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import RefreshIcon from "@mui/icons-material/Refresh";
import PlaylistAddCheckOutlinedIcon from "@mui/icons-material/PlaylistAddCheckOutlined";
import { api } from "../api";
import { DataTable, type GridColDef } from "../components/DataTable";
import {
  CodeLabel,
  EmptyState,
  ErrorPanel,
  FilterChips,
  Meter,
  PageStack,
  TableSkeleton,
  Tag,
  type Tone,
} from "../components/ui";
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
  collected: boolean;
}

type View = "all" | "collect_today" | "schedule_soon" | "high";

const RISK_TONE: Record<HealthRow["overflow_risk"], Tone> = {
  high: "bad",
  medium: "warn",
  low: "ok",
};
const RISK_RANK = { high: 0, medium: 1, low: 2 } as const;

export default function BinHealth() {
  const { t } = useI18n();
  const [rows, setRows] = useState<HealthRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyBinId, setBusyBinId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [view, setView] = useState<View>("all");

  const reload = useCallback(async () => {
    try {
      setRows(await api<HealthRow[]>("/api/v1/bins/health"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function refresh() {
    setActionError(null);
    setActionNotice(null);
    setBusy(true);
    try {
      await api("/api/v1/admin/analytics/refresh", { method: "POST" });
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function markCollected(row: HealthRow) {
    setActionError(null);
    setActionNotice(null);
    setBusyBinId(row.bin_id);
    try {
      await api("/api/v1/collections", {
        method: "POST",
        body: JSON.stringify({ bin_id: row.bin_id }),
      });
      setActionNotice(t("collectionMarked"));
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyBinId(null);
    }
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

  const visible = useMemo(() => {
    const list = rows ?? [];
    if (view === "all") return list;
    if (view === "high") return list.filter((r) => r.overflow_risk === "high");
    return list.filter((r) => r.recommendation === view);
  }, [rows, view]);

  if (error) {
    return (
      <PageStack>
        <ErrorPanel
          message={t("errorLoad")}
          retryLabel={t("retry")}
          onRetry={() => {
            setError(null);
            setRows(null);
            void reload();
          }}
        />
      </PageStack>
    );
  }
  if (rows === null) {
    return (
      <PageStack>
        <TableSkeleton rows={10} />
      </PageStack>
    );
  }

  const refreshAction = (
    <Button
      variant="outlined"
      size="small"
      startIcon={<RefreshIcon />}
      onClick={() => void refresh()}
      disabled={busy}
      sx={{ height: 36 }}
    >
      {busy ? t("refreshing") : t("refresh")}
    </Button>
  );

  const riskLabel = (r: HealthRow["overflow_risk"]) =>
    t(r === "high" ? "riskHigh" : r === "medium" ? "riskMedium" : "riskLow");
  const days = (v: unknown) => (v == null ? "—" : t("nDays").replace("{n}", Number(v).toFixed(1)));

  const columns: GridColDef<HealthRow>[] = [
    { field: "qr_code", headerName: t("bin"), width: 112, renderCell: (p) => <CodeLabel>{p.value as string}</CodeLabel> },
    { field: "site_name", headerName: t("site"), flex: 1, minWidth: 150 },
    {
      field: "fill_pct",
      headerName: t("fillLevel"),
      type: "number",
      width: 140,
      renderCell: (p) => <Meter value={Number(p.value)} bad={p.row.overflow_risk === "high"} />,
    },
    { field: "days_to_full", headerName: t("daysToFull"), type: "number", width: 96, valueFormatter: days },
    { field: "days_since_collection", headerName: t("sinceCollection"), type: "number", width: 110, valueFormatter: days },
    {
      field: "overflow_risk",
      headerName: t("risk"),
      width: 108,
      sortComparator: (a, b) => RISK_RANK[a as HealthRow["overflow_risk"]] - RISK_RANK[b as HealthRow["overflow_risk"]],
      renderCell: (p) =>
        p.row.collected ? (
          <Tag tone="ok">{t("collected")}</Tag>
        ) : (
          <Tag tone={RISK_TONE[p.row.overflow_risk]}>{riskLabel(p.row.overflow_risk)}</Tag>
        ),
    },
    {
      field: "recommendation",
      headerName: t("recommendation"),
      width: 136,
      valueGetter: (_v, row) =>
        row.recommendation === "collect_today" ? t("collectTodayRec") : row.recommendation === "schedule_soon" ? t("scheduleSoonRec") : "—",
    },
    {
      field: "actions",
      headerName: "",
      width: 136,
      sortable: false,
      filterable: false,
      disableExport: true,
      align: "right",
      renderCell: (p) => (
        <Button
          variant="text"
          size="small"
          disabled={busy || busyBinId !== null || p.row.collected}
          onClick={() => void markCollected(p.row)}
        >
          {busyBinId === p.row.bin_id
            ? t("markingCollected")
            : p.row.collected
              ? t("collected")
              : t("markCollected")}
        </Button>
      ),
    },
  ];

  return (
    <PageStack>
      {actionError && <Alert severity="error">{actionError}</Alert>}
      {actionNotice && <Alert severity="success">{actionNotice}</Alert>}
      {rows.length === 0 ? (
        <>
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>{refreshAction}</Box>
          <EmptyState icon={<PlaylistAddCheckOutlinedIcon />} title={t("noHealthData")} />
        </>
      ) : (
        <DataTable
          rows={visible}
          columns={columns}
          getRowId={(r) => r.bin_id}
          pageSize={25}
          searchPlaceholder={t("searchBins")}
          actions={refreshAction}
          filters={
            <FilterChips<View>
              value={view}
              onChange={setView}
              options={[
                { value: "all", label: t("all"), count: stats.total },
                { value: "collect_today", label: t("collectTodayRec"), count: stats.collectToday },
                { value: "schedule_soon", label: t("scheduleSoonRec"), count: stats.scheduleSoon },
                { value: "high", label: t("highRisk"), count: stats.high },
              ]}
            />
          }
        />
      )}
    </PageStack>
  );
}
