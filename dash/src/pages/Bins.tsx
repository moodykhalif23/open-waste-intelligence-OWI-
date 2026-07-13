import { useCallback, useEffect, useState, type FormEvent } from "react";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import DownloadIcon from "@mui/icons-material/Download";
import { api, apiBlob, type Bin, type Site } from "../api";
import { Muted, PageStack, SectionCard } from "../components/ui";
import { useI18n } from "../i18n";

export default function Bins() {
  const { t } = useI18n();
  const [sites, setSites] = useState<Site[]>([]);
  const [bins, setBins] = useState<Bin[] | null>(null);

  const reload = useCallback(async () => {
    const [siteList, binList] = await Promise.all([
      api<Site[]>("/api/v1/sites"),
      api<Bin[]>("/api/v1/bins"),
    ]);
    setSites(siteList);
    setBins(binList);
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

  if (bins === null) return <Muted>{t("loading")}</Muted>;
  const siteName = (id: string) => sites.find((s) => s.id === id)?.name ?? id.slice(0, 8);

  return (
    <PageStack>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <SiteForm onCreated={reload} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <BinForm sites={sites} onCreated={reload} />
        </Grid>
      </Grid>
      <SectionCard title={t("bins")}>
        {bins.length === 0 ? (
          <Muted>{t("noData")}</Muted>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("qrCode")}</TableCell>
                  <TableCell>{t("site")}</TableCell>
                  <TableCell>{t("binType")}</TableCell>
                  <TableCell>{t("volume")}</TableCell>
                  <TableCell>{t("lat")}</TableCell>
                  <TableCell>{t("lng")}</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {bins.map((bin) => (
                  <TableRow key={bin.id} hover>
                    <TableCell sx={{ fontFamily: "ui-monospace, monospace" }}>
                      {bin.qr_code}
                    </TableCell>
                    <TableCell>{siteName(bin.site_id)}</TableCell>
                    <TableCell>{bin.bin_type}</TableCell>
                    <TableCell>{bin.volume_liters}</TableCell>
                    <TableCell>{bin.lat.toFixed(5)}</TableCell>
                    <TableCell>{bin.lng.toFixed(5)}</TableCell>
                    <TableCell align="right">
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={() => void downloadQr(bin)}
                      >
                        {t("downloadQr")}
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

function SiteForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [siteType, setSiteType] = useState("estate");
  const [ward, setWard] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await api("/api/v1/sites", {
      method: "POST",
      body: JSON.stringify({ name, site_type: siteType, ward: ward || null }),
    });
    setName("");
    setWard("");
    await onCreated();
  }

  return (
    <SectionCard title={t("newSite")}>
      <Stack component="form" spacing={2.5} onSubmit={(e) => void onSubmit(e)}>
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
        <Button variant="contained" type="submit">
          {t("create")}
        </Button>
      </Stack>
    </SectionCard>
  );
}

function BinForm({ sites, onCreated }: { sites: Site[]; onCreated: () => Promise<void> }) {
  const { t } = useI18n();
  const [siteId, setSiteId] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [volume, setVolume] = useState("240");
  const [binType, setBinType] = useState("standard");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
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
  }

  return (
    <SectionCard title={t("newBin")}>
      <Stack component="form" spacing={2.5} onSubmit={(e) => void onSubmit(e)}>
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
        <Button variant="contained" type="submit">
          {t("create")}
        </Button>
      </Stack>
    </SectionCard>
  );
}
