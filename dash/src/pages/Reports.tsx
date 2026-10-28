import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Button from "@mui/material/Button";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import CloseIcon from "@mui/icons-material/Close";
import PhotoOutlinedIcon from "@mui/icons-material/PhotoOutlined";
import { apiBlob, type Bin, type FillBand, type Observation, type Site } from "../api";
import { DataTable, type GridColDef } from "../components/DataTable";
import {
  CodeLabel,
  EmptyState,
  ErrorPanel,
  FilterChips,
  PageHeader,
  PageStack,
  SectionCard,
  TableSkeleton,
  Tag,
  type Tone,
} from "../components/ui";
import { useApi } from "../useApi";
import { useI18n, type StringKey } from "../i18n";

const LIMIT = 1000;
const BANDS: FillBand[] = ["overflowing", "high", "half", "low", "empty"];
const BAND_TONE: Record<FillBand, Tone> = {
  empty: "ok",
  low: "ok",
  half: "neutral",
  high: "warn",
  overflowing: "bad",
};

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
  } = useApi<Observation[]>(`/api/v1/observations?limit=${LIMIT}${q}`);
  const { data: bins, error: binsError, retry: retryBins } = useApi<Bin[]>("/api/v1/bins");
  const { data: sites } = useApi<Site[]>("/api/v1/sites");
  const [band, setBand] = useState<"all" | FillBand>("all");

  const binById = useMemo(() => new Map((bins ?? []).map((b) => [b.id, b])), [bins]);
  const siteById = useMemo(() => new Map((sites ?? []).map((s) => [s.id, s])), [sites]);
  const shown = useMemo(
    () => (band === "all" ? (observations ?? []) : (observations ?? []).filter((o) => o.fill_tap === band)),
    [observations, band],
  );

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
        <PageHeader description={t("reportsHub")} />
        <TableSkeleton rows={10} />
      </PageStack>
    );
  }
  // Bins are a secondary lookup: fall back to the raw id while they load.
  const binCode = (id: string | null) =>
    id === null ? t("noBin") : (binById.get(id)?.qr_code ?? id.slice(0, 8));
  const siteOf = (id: string | null) => {
    const bin = id ? binById.get(id) : undefined;
    return (bin && siteById.get(bin.site_id)?.name) ?? "—";
  };

  const columns: GridColDef<Observation>[] = [
    {
      field: "captured_at",
      headerName: t("capturedAt"),
      width: 200,
      valueFormatter: (v) => new Date(v as string).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
      renderCell: (p) => <span style={{ whiteSpace: "nowrap" }}>{p.formattedValue as string}</span>,
    },
    {
      field: "bin_id",
      headerName: t("bin"),
      width: 130,
      valueGetter: (_v, row) => binCode(row.bin_id),
      renderCell: (p) => <CodeLabel>{p.value as string}</CodeLabel>,
    },
    { field: "site", headerName: t("site"), flex: 1, minWidth: 170, valueGetter: (_v, row) => siteOf(row.bin_id) },
    {
      field: "fill_tap",
      headerName: t("fillTap"),
      width: 130,
      valueGetter: (_v, row) => (row.fill_tap ? t(row.fill_tap as StringKey) : null),
      renderCell: (p) => (p.row.fill_tap ? <Tag tone={BAND_TONE[p.row.fill_tap]}>{p.value as string}</Tag> : "—"),
    },
    { field: "location_source", headerName: t("source"), width: 110 },
    {
      field: "privacy_status",
      headerName: t("privacy"),
      width: 120,
      renderCell: (p) => <Tag>{p.value as string}</Tag>,
    },
    {
      field: "photo",
      headerName: t("photo"),
      width: 110,
      sortable: false,
      filterable: false,
      disableExport: true,
      align: "right",
      headerAlign: "right",
      renderCell: (p) => (
        <Button variant="text" size="small" startIcon={<PhotoOutlinedIcon />} onClick={() => void viewPhoto(p.row.id)}>
          {t("view")}
        </Button>
      ),
    },
  ];

  const count = (b: FillBand) => observations.filter((o) => o.fill_tap === b).length;

  return (
    <PageStack>
      <PageHeader
        description={
          observations.length >= LIMIT
            ? `${t("reportsHub")} ${t("latestNShown").replace("{n}", LIMIT.toLocaleString())}.`
            : t("reportsHub")
        }
      />
      {observations.length === 0 ? (
        <SectionCard>
          <EmptyState icon={<ArticleOutlinedIcon />} title={t("noData")} />
        </SectionCard>
      ) : (
        <DataTable
          rows={shown}
          columns={columns}
          pageSize={25}
          filters={
            <FilterChips<"all" | FillBand>
              value={band}
              onChange={setBand}
              options={[
                { value: "all", label: t("all"), count: observations.length },
                ...BANDS.map((b) => ({ value: b, label: t(b as StringKey), count: count(b) })),
              ]}
            />
          }
          actions={
            material && (
              <Button
                variant="outlined"
                size="small"
                endIcon={<CloseIcon />}
                onClick={() => navigate("/records/reports")}
                sx={{ height: 36 }}
              >
                {t("filteredBy")}: {t(material as StringKey)}
              </Button>
            )
          }
        />
      )}
    </PageStack>
  );
}
