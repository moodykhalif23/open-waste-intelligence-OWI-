import { useNavigate, useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import CloseIcon from "@mui/icons-material/Close";
import PhotoOutlinedIcon from "@mui/icons-material/PhotoOutlined";
import { apiBlob, type Bin, type Observation } from "../api";
import { DataTable, type GridColDef } from "../components/DataTable";
import { EmptyState, ErrorPanel, PageHeader, PageStack, TableSection, TableSkeleton } from "../components/ui";
import { useApi } from "../useApi";
import { useI18n, type StringKey } from "../i18n";

export default function Reports() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const material = params.get("material");
  const q = material ? `&material=${encodeURIComponent(material)}` : "";
  const {
    data: observations,
    error: obsError,
    retry: retryObservations,
  } = useApi<Observation[]>(`/api/v1/observations?limit=1000${q}`);
  const { data: bins, error: binsError, retry: retryBins } = useApi<Bin[]>("/api/v1/bins");

  async function viewPhoto(id: string) {
    const blob = await apiBlob(`/api/v1/observations/${id}/image`);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  if (obsError || binsError) {
    return (
      <PageStack>
        <ErrorPanel
          message={t("errorLoad")}
          retryLabel={t("retry")}
          onRetry={() => {
            if (obsError) retryObservations();
            if (binsError) retryBins();
          }}
        />
      </PageStack>
    );
  }
  if (observations === null) {
    return (
      <PageStack>
        <PageHeader title={t("reports")} description={t("reportsHub")} />
        <TableSkeleton rows={10} />
      </PageStack>
    );
  }
  // Bins are a secondary lookup: fall back to the raw id while they load.
  const binCode = (id: string | null) =>
    id === null ? t("noBin") : ((bins ?? []).find((b) => b.id === id)?.qr_code ?? id.slice(0, 8));

  const columns: GridColDef<Observation>[] = [
    { field: "captured_at", headerName: t("capturedAt"), flex: 1, minWidth: 170, valueFormatter: (v) => new Date(v as string).toLocaleString() },
    {
      field: "bin_id",
      headerName: t("bin"),
      flex: 1,
      minWidth: 120,
      valueGetter: (_v, row) => binCode(row.bin_id),
      renderCell: (p) => <Box sx={{ fontFamily: "ui-monospace, monospace" }}>{p.value as string}</Box>,
    },
    {
      field: "fill_tap",
      headerName: t("fillTap"),
      width: 120,
      renderCell: (p) => (p.value ? <Chip size="small" label={t(p.value as StringKey)} /> : "—"),
    },
    { field: "location_source", headerName: t("source"), width: 120 },
    {
      field: "privacy_status",
      headerName: t("privacy"),
      width: 120,
      renderCell: (p) => <Chip size="small" variant="outlined" label={p.value as string} />,
    },
    {
      field: "photo",
      headerName: t("photo"),
      width: 110,
      sortable: false,
      filterable: false,
      renderCell: (p) => (
        <Button variant="text" size="small" startIcon={<PhotoOutlinedIcon />} onClick={() => void viewPhoto(p.row.id)}>
          {t("view")}
        </Button>
      ),
    },
  ];

  return (
    <PageStack>
      <PageHeader title={t("reports")} description={t("reportsHub")} />
      <TableSection
        action={
          material && (
            <Button
              variant="outlined"
              size="small"
              endIcon={<CloseIcon />}
              onClick={() => navigate("/records/reports")}
            >
              {t("filteredBy")}: {t(material as StringKey)}
            </Button>
          )
        }
      >
        {observations.length === 0 ? (
          <EmptyState icon={<ArticleOutlinedIcon />} title={t("noData")} />
        ) : (
          <DataTable rows={observations} columns={columns} pageSize={25} />
        )}
      </TableSection>
    </PageStack>
  );
}
