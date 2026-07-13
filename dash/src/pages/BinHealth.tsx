import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import RefreshIcon from "@mui/icons-material/Refresh";
import { api } from "../api";
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
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("bin")}</TableCell>
                  <TableCell>{t("site")}</TableCell>
                  <TableCell>{t("fillLevel")}</TableCell>
                  <TableCell>{t("daysToFull")}</TableCell>
                  <TableCell>{t("sinceCollection")}</TableCell>
                  <TableCell>{t("risk")}</TableCell>
                  <TableCell>{t("recommendation")}</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.bin_id} hover>
                    <TableCell sx={{ fontFamily: "monospace" }}>{row.qr_code}</TableCell>
                    <TableCell>{row.site_name}</TableCell>
                    <TableCell>{Math.round(row.fill_pct)}%</TableCell>
                    <TableCell>
                      {row.days_to_full === null ? "—" : row.days_to_full.toFixed(1)}
                    </TableCell>
                    <TableCell>
                      {row.days_since_collection === null
                        ? "—"
                        : row.days_since_collection.toFixed(1)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={RISK_COLOR[row.overflow_risk]}
                        label={t(
                          row.overflow_risk === "high"
                            ? "riskHigh"
                            : row.overflow_risk === "medium"
                              ? "riskMedium"
                              : "riskLow",
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      {row.recommendation === "collect_today" && t("collectTodayRec")}
                      {row.recommendation === "schedule_soon" && t("scheduleSoonRec")}
                      {row.recommendation === "no_action" && "—"}
                    </TableCell>
                    <TableCell align="right">
                      <Button variant="contained" size="small" onClick={() => void markCollected(row)}>
                        {t("markCollected")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SectionCard>
    </PageStack>
  );
}
