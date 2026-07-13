import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CloseIcon from "@mui/icons-material/Close";
import PhotoOutlinedIcon from "@mui/icons-material/PhotoOutlined";
import { api, apiBlob, type Bin, type Observation } from "../api";
import { DataTable, type GridColDef } from "../components/DataTable";
import { Muted, PageStack, SectionCard } from "../components/ui";
import { useI18n, type StringKey } from "../i18n";

export default function Reports() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const material = params.get("material");
  const [observations, setObservations] = useState<Observation[] | null>(null);
  const [bins, setBins] = useState<Bin[]>([]);

  useEffect(() => {
    setObservations(null);
    const q = material ? `&material=${encodeURIComponent(material)}` : "";
    void api<Observation[]>(`/api/v1/observations?limit=200${q}`).then(setObservations);
    void api<Bin[]>("/api/v1/bins").then(setBins);
  }, [material]);

  async function viewPhoto(id: string) {
    const blob = await apiBlob(`/api/v1/observations/${id}/image`);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  if (observations === null) return <Muted>{t("loading")}</Muted>;
  const binCode = (id: string | null) =>
    id === null ? t("noBin") : (bins.find((b) => b.id === id)?.qr_code ?? id.slice(0, 8));

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
      <SectionCard
        title={t("reports")}
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
          <Muted>{t("noData")}</Muted>
        ) : (
          <DataTable rows={observations} columns={columns} pageSize={15} />
        )}
      </SectionCard>
    </PageStack>
  );
}
