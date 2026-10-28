import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import DownloadIcon from "@mui/icons-material/Download";
import AddLocationAltOutlinedIcon from "@mui/icons-material/AddLocationAltOutlined";
import AddBoxOutlinedIcon from "@mui/icons-material/AddBoxOutlined";
import { api, apiBlob, type Bin, type Site } from "../api";
import { DataTable, type GridColDef } from "../components/DataTable";
import MapView from "../components/MapView";
import { CodeLabel, EmptyState, ErrorPanel, MapFrame, PageSkeleton, PageStack, SectionCard } from "../components/ui";
import { useI18n } from "../i18n";

export default function Bins() {
  const { t } = useI18n();
  const [sites, setSites] = useState<Site[]>([]);
  const [bins, setBins] = useState<Bin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [siteDialogOpen, setSiteDialogOpen] = useState(false);
  const [binDialogOpen, setBinDialogOpen] = useState(false);
  const [ward, setWard] = useState("");

  const siteById = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);
  const wards = useMemo(
    () => Array.from(new Set(sites.map((s) => s.ward).filter((w): w is string => !!w))).sort(),
    [sites],
  );
  const shown = useMemo(
    () => (ward ? (bins ?? []).filter((b) => siteById.get(b.site_id)?.ward === ward) : (bins ?? [])),
    [bins, ward, siteById],
  );

  const reload = useCallback(async () => {
    try {
      const [siteList, binList] = await Promise.all([
        api<Site[]>("/api/v1/sites"),
        api<Bin[]>("/api/v1/bins"),
      ]);
      setSites(siteList);
      setBins(binList);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function downloadQr(bin: Bin) {
    const blob = await apiBlob(`/api/v1/bins/${bin.id}/qr.svg`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bin-${bin.qr_code}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return (
      <PageStack>
        <ErrorPanel
          message={t("errorLoad")}
          retryLabel={t("retry")}
          onRetry={() => {
            setError(null);
            setBins(null);
            void reload();
          }}
        />
      </PageStack>
    );
  }
  if (bins === null) return <PageSkeleton />;
  const siteName = (id: string) => siteById.get(id)?.name ?? id.slice(0, 8);

  const columns: GridColDef<Bin>[] = [
    {
      field: "qr_code",
      headerName: t("qrCode"),
      width: 150,
      renderCell: (p) => <CodeLabel>{p.value as string}</CodeLabel>,
    },
    {
      field: "site_id",
      headerName: t("site"),
      flex: 1,
      minWidth: 170,
      valueGetter: (_v, row) => siteName(row.site_id),
    },
    {
      field: "ward",
      headerName: t("ward"),
      flex: 0.6,
      minWidth: 120,
      valueGetter: (_v, row) => siteById.get(row.site_id)?.ward ?? "—",
    },
    { field: "bin_type", headerName: t("binType"), width: 120 },
    { field: "volume_liters", headerName: t("volume"), type: "number", width: 110, valueFormatter: (v) => Number(v).toLocaleString() },
    { field: "lat", headerName: t("lat"), type: "number", width: 110, valueFormatter: (v) => Number(v).toFixed(5) },
    { field: "lng", headerName: t("lng"), type: "number", width: 110, valueFormatter: (v) => Number(v).toFixed(5) },
    {
      field: "actions",
      headerName: "",
      width: 100,
      sortable: false,
      filterable: false,
      disableExport: true,
      align: "right",
      renderCell: (p) => (
        <Button
          variant="text"
          size="small"
          startIcon={<DownloadIcon />}
          onClick={() => void downloadQr(p.row)}
        >
          {t("downloadQr")}
        </Button>
      ),
    },
  ];

  const wardSelect = wards.length > 1 && (
    <TextField
      select
      value={ward}
      onChange={(e) => setWard(e.target.value)}
      sx={{ minWidth: 190, "& .MuiSelect-select": { py: "7px", fontSize: "0.9rem" } }}
      slotProps={{ select: { displayEmpty: true }, htmlInput: { "aria-label": t("ward") } }}
    >
      <MenuItem value="">{t("allWards")}</MenuItem>
      {wards.map((w) => (
        <MenuItem key={w} value={w}>
          {w}
        </MenuItem>
      ))}
    </TextField>
  );

  const addActions = (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<AddLocationAltOutlinedIcon />}
        onClick={() => setSiteDialogOpen(true)}
      >
        {t("newSite")}
      </Button>
      <Button
        variant="contained"
        size="small"
        startIcon={<AddBoxOutlinedIcon />}
        disabled={sites.length === 0}
        onClick={() => setBinDialogOpen(true)}
      >
        {t("newBin")}
      </Button>
    </>
  );

  return (
    <PageStack>
      <SectionCard
        title={t("map")}
        hint={bins.length > 0 ? `${shown.length.toLocaleString()} ${t("bins").toLowerCase()}` : undefined}
        action={addActions}
      >
        {bins.length > 0 ? (
          <MapFrame radius={4}>
            <MapView
              height={360}
              points={shown.map((b) => ({ lat: b.lat, lng: b.lng, label: `${b.qr_code} · ${siteName(b.site_id)}` }))}
            />
          </MapFrame>
        ) : (
          <EmptyState icon={<DeleteOutlineOutlinedIcon />} title={t("noData")} hint={t("newSite")} />
        )}
      </SectionCard>

      {bins.length > 0 && (
        <DataTable
          rows={shown}
          columns={columns}
          pageSize={25}
          searchPlaceholder={t("searchBinsLong")}
          filters={wardSelect || undefined}
        />
      )}

      <Dialog open={siteDialogOpen} onClose={() => setSiteDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("newSite")}</DialogTitle>
        <DialogContent dividers>
          <SiteForm onCreated={reload} onClose={() => setSiteDialogOpen(false)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSiteDialogOpen(false)}>{t("close")}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={binDialogOpen} onClose={() => setBinDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("newBin")}</DialogTitle>
        <DialogContent dividers>
          <BinForm sites={sites} onCreated={reload} onClose={() => setBinDialogOpen(false)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBinDialogOpen(false)}>{t("close")}</Button>
        </DialogActions>
      </Dialog>
    </PageStack>
  );
}

function SiteForm({ onCreated, onClose }: { onCreated: () => Promise<void>; onClose: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [siteType, setSiteType] = useState("estate");
  const [ward, setWard] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/sites", {
        method: "POST",
        body: JSON.stringify({ name, site_type: siteType, ward: ward || null }),
      });
      setName("");
      setWard("");
      await onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
      <Stack component="form" spacing={2.5} onSubmit={(e) => void onSubmit(e)}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          size="small"
          fullWidth
          label={t("name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <TextField
          select
          size="small"
          fullWidth
          label={t("siteType")}
          value={siteType}
          onChange={(e) => setSiteType(e.target.value)}
        >
          {["estate", "school", "market", "business", "public"].map((v) => (
            <MenuItem key={v} value={v}>
              {v}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          fullWidth
          label={t("ward")}
          value={ward}
          onChange={(e) => setWard(e.target.value)}
        />
        <Button variant="contained" type="submit" disabled={busy}>
          {busy ? t("creating") : t("create")}
        </Button>
      </Stack>
  );
}

function BinForm({
  sites,
  onCreated,
  onClose,
}: {
  sites: Site[];
  onCreated: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [siteId, setSiteId] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [volume, setVolume] = useState("240");
  const [binType, setBinType] = useState("standard");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/bins", {
        method: "POST",
        body: JSON.stringify({
          site_id: siteId,
          lat: Number(lat),
          lng: Number(lng),
          volume_liters: Number(volume),
          bin_type: binType,
        }),
      });
      setLat("");
      setLng("");
      await onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
      <Stack component="form" spacing={2.5} onSubmit={(e) => void onSubmit(e)}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          select
          size="small"
          fullWidth
          label={t("site")}
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          required
        >
          {sites.map((site) => (
            <MenuItem key={site.id} value={site.id}>
              {site.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          type="number"
          size="small"
          fullWidth
          label={t("lat")}
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          required
        />
        <TextField
          type="number"
          size="small"
          fullWidth
          label={t("lng")}
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          required
        />
        <TextField
          type="number"
          size="small"
          fullWidth
          label={t("volume")}
          value={volume}
          onChange={(e) => setVolume(e.target.value)}
          required
        />
        <TextField
          size="small"
          fullWidth
          label={t("binType")}
          value={binType}
          onChange={(e) => setBinType(e.target.value)}
          required
        />
        <Button variant="contained" type="submit" disabled={busy}>
          {busy ? t("creating") : t("create")}
        </Button>
      </Stack>
  );
}
