import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Drawer from "@mui/material/Drawer";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import ScheduleIcon from "@mui/icons-material/Schedule";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import { api, apiBlob } from "../api";
import { DataTable, type GridColDef } from "../components/DataTable";
import MapView from "../components/MapView";
import {
  EmptyState,
  ErrorPanel,
  FilterChips,
  GAP,
  MapFrame,
  Muted,
  PageSkeleton,
  PageStack,
  Pager,
  SectionCard,
  TableSection,
  Tag,
  type Tone,
} from "../components/ui";
import { owi } from "../theme";
import { useI18n, type StringKey } from "../i18n";

const INTERVENTIONS = ["bin_added", "signage", "cleanup", "engagement"] as const;

interface Candidate {
  observation_id: string;
  captured_at: string;
  lat: number;
  lng: number;
}

interface Site {
  id: string;
  lat: number;
  lng: number;
  area: string | null;
  first_seen: string;
  last_seen: string;
  event_count: number;
  status: "active" | "cleaned" | "recurring";
  hotspot_score: number;
}

interface Event {
  occurred_at: string;
  observation_id: string;
}

interface Intervention {
  id: string;
  kind: string;
  performed_on: string;
  notes: string | null;
}

interface SiteDetail extends Site {
  events: Event[];
  interventions: Intervention[];
}

const STATUS_TONE: Record<Site["status"], Tone> = {
  active: "bad",
  recurring: "warn",
  cleaned: "ok",
};
const CANDIDATES_PER_PAGE = 6;

const STATUS_HEX: Record<Site["status"], string> = {
  active: "#c0392b",
  recurring: "#b4791a",
  cleaned: "#0e7a55",
};

export default function Dumping() {
  const { t } = useI18n();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [sites, setSites] = useState<Site[] | null>(null);
  const [selected, setSelected] = useState<SiteDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<"all" | Site["status"]>("all");

  const shownSites = useMemo(
    () => (status === "all" ? (sites ?? []) : (sites ?? []).filter((x) => x.status === status)),
    [sites, status],
  );

  const reload = useCallback(async () => {
    // Swallow into error state: reload is shared with mutation flows and must not reject.
    try {
      const [c, s] = await Promise.all([
        api<Candidate[]>("/api/v1/dumping/candidates"),
        api<Site[]>("/api/v1/dumping/sites"),
      ]);
      setCandidates(c);
      setSites(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function review(obsId: string, decision: string) {
    await api(`/api/v1/dumping/candidates/${obsId}/review`, {
      method: "POST",
      body: JSON.stringify({ review: decision }),
    });
    await reload();
  }

  async function openSite(id: string) {
    setSelected(await api<SiteDetail>(`/api/v1/dumping/sites/${id}`));
  }

  if (error) {
    return (
      <PageStack>
        <ErrorPanel message={t("errorLoad")} retryLabel={t("retry")} onRetry={() => void reload()} />
      </PageStack>
    );
  }
  if (sites === null) return <PageSkeleton />;

  const where = (x: Site) => x.area ?? `${x.lat.toFixed(4)}, ${x.lng.toFixed(4)}`;
  const siteCols: GridColDef<Site>[] = [
    {
      field: "location",
      headerName: t("location"),
      flex: 1,
      minWidth: 180,
      valueGetter: (_v, row) => where(row),
      renderCell: (p) => (
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ color: "text.primary", fontWeight: 600 }}>{p.value as string}</Box>
          {p.row.area && (
            <Box sx={{ color: "text.secondary", fontSize: "0.8rem" }}>{`${p.row.lat.toFixed(4)}, ${p.row.lng.toFixed(4)}`}</Box>
          )}
        </Box>
      ),
    },
    { field: "event_count", headerName: t("events"), type: "number", width: 100 },
    { field: "last_seen", headerName: t("lastSeen"), width: 130, valueFormatter: (v) => new Date(v as string).toLocaleDateString() },
    { field: "hotspot_score", headerName: t("risk"), type: "number", width: 90 },
    {
      field: "status",
      headerName: t("status"),
      width: 130,
      valueGetter: (_v, row) => t(`dump_${row.status}` as StringKey),
      renderCell: (p) => <Tag tone={STATUS_TONE[p.row.status]}>{p.value as string}</Tag>,
    },
    {
      field: "actions",
      headerName: "",
      width: 100,
      sortable: false,
      filterable: false,
      disableExport: true,
      align: "right",
      renderCell: (p) => (
        <Button variant="text" size="small" onClick={() => void openSite(p.row.id)}>
          {t("view")}
        </Button>
      ),
    },
  ];

  const pages = Math.max(1, Math.ceil(candidates.length / CANDIDATES_PER_PAGE));
  const current = Math.min(page, pages - 1);
  const pageItems = candidates.slice(current * CANDIDATES_PER_PAGE, (current + 1) * CANDIDATES_PER_PAGE);
  const hottest = [...sites].filter((x) => x.status !== "cleaned").sort((a, b) => b.hotspot_score - a.hotspot_score).slice(0, 7);
  const statusCount = (k: Site["status"]) => sites.filter((x) => x.status === k).length;

  return (
    <PageStack>
      <TableSection title={t("reviewQueue")} hint={candidates.length > 0 ? candidates.length.toLocaleString() : undefined}>
        {candidates.length === 0 ? (
          <SectionCard>
            <EmptyState icon={<FactCheckOutlinedIcon />} title={t("noCandidates")} />
          </SectionCard>
        ) : (
          <>
            <Grid container spacing={GAP}>
              {pageItems.map((c) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={c.observation_id}>
                  <CandidateItem candidate={c} onReview={(d) => void review(c.observation_id, d)} />
                </Grid>
              ))}
            </Grid>
            {candidates.length > CANDIDATES_PER_PAGE && (
              <Pager
                page={current}
                pageSize={CANDIDATES_PER_PAGE}
                total={candidates.length}
                onPage={setPage}
                ofLabel={t("of")}
              />
            )}
          </>
        )}
      </TableSection>

      <TableSection title={t("hotspots")} hint={sites.length > 0 ? sites.length.toLocaleString() : undefined}>
        {sites.length === 0 ? (
          <SectionCard>
            <EmptyState icon={<WarningAmberOutlinedIcon />} title={t("noSites")} />
          </SectionCard>
        ) : (
          <Stack spacing={GAP}>
            <Grid container spacing={GAP}>
              <Grid size={{ xs: 12, md: 7 }}>
                <MapFrame>
                  <MapView
                    height={400}
                    points={sites.map((x) => ({
                      lat: x.lat,
                      lng: x.lng,
                      color: STATUS_HEX[x.status],
                      label: `${t(`dump_${x.status}` as StringKey)} · ${x.hotspot_score}`,
                    }))}
                  />
                </MapFrame>
              </Grid>
              <Grid size={{ xs: 12, md: 5 }}>
                <SectionCard>
                  <Box sx={{ mx: -1 }}>
                    {hottest.map((x) => (
                      <ButtonBase
                        key={x.id}
                        onClick={() => void openSite(x.id)}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "auto 1fr auto",
                          alignItems: "center",
                          gap: 1.5,
                          width: "100%",
                          px: 1,
                          py: 1.1,
                          textAlign: "left",
                          borderTop: "1px solid",
                          borderColor: owi.rule,
                          borderRadius: "8px",
                          "&:first-of-type": { borderTop: 0 },
                          "&:hover": { bgcolor: owi.wash },
                        }}
                      >
                        <Tag tone={STATUS_TONE[x.status]}>{x.event_count}</Tag>
                        <Typography noWrap sx={{ fontSize: "0.92rem", color: owi.inkSoft, minWidth: 0 }}>
                          {where(x)}
                        </Typography>
                        <Typography sx={{ fontSize: "0.86rem", fontWeight: 660, fontVariantNumeric: "tabular-nums" }}>
                          {x.hotspot_score}
                        </Typography>
                      </ButtonBase>
                    ))}
                  </Box>
                </SectionCard>
              </Grid>
            </Grid>
            <DataTable
              rows={shownSites}
              columns={siteCols}
              pageSize={10}
              filters={
                <FilterChips<"all" | Site["status"]>
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: "all", label: t("all"), count: sites.length },
                    { value: "active", label: t("dump_active"), count: statusCount("active") },
                    { value: "recurring", label: t("dump_recurring"), count: statusCount("recurring") },
                    { value: "cleaned", label: t("dump_cleaned"), count: statusCount("cleaned") },
                  ]}
                />
              }
            />
          </Stack>
        )}
      </TableSection>

      {selected && (
        <SitePanel site={selected} onClose={() => setSelected(null)} onChanged={reload} />
      )}
    </PageStack>
  );
}

function CandidateItem({
  candidate,
  onReview,
}: {
  candidate: Candidate;
  onReview: (decision: string) => void;
}) {
  const { t } = useI18n();
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    void apiBlob(`/api/v1/observations/${candidate.observation_id}/image`).then((b) => {
      if (cancelled) return;
      url = URL.createObjectURL(b);
      setImageUrl(url);
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [candidate.observation_id]);

  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <CardMedia
        component="img"
        image={imageUrl ?? undefined}
        alt=""
        sx={{ height: 160, objectFit: "cover", bgcolor: "#f0ede5" }}
      />
      <CardContent sx={{ flexGrow: 1, pb: "8px !important", pt: 1.75 }}>
        <Muted>
          {candidate.lat.toFixed(4)}, {candidate.lng.toFixed(4)} ·{" "}
          {new Date(candidate.captured_at).toLocaleDateString()}
        </Muted>
      </CardContent>
      <CardActions sx={{ px: 2, pb: 2, pt: 0.5, flexWrap: "wrap", gap: 0.75 }}>
        <Button size="small" variant="contained" color="primary" onClick={() => onReview("confirmed")}>
          {t("confirmDumping")}
        </Button>
        <Button size="small" variant="outlined" onClick={() => onReview("rejected")}>
          {t("reject")}
        </Button>
        <Button size="small" variant="text" onClick={() => onReview("duplicate")}>
          {t("duplicate")}
        </Button>
      </CardActions>
    </Card>
  );
}

function SitePanel({
  site,
  onClose,
  onChanged,
}: {
  site: SiteDetail;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [kind, setKind] = useState<string>("cleanup");
  const [performedOn, setPerformedOn] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  async function addIntervention(e: FormEvent) {
    e.preventDefault();
    await api(`/api/v1/dumping/sites/${site.id}/interventions`, {
      method: "POST",
      body: JSON.stringify({ kind, performed_on: performedOn, notes: notes || null }),
    });
    setNotes("");
    await onChanged();
    onClose();
  }

  return (
    <Drawer
      anchor="right"
      open
      onClose={onClose}
      sx={{ "& .MuiDrawer-paper": { width: { xs: "100%", sm: 440 }, p: { xs: 2, sm: 3 } } }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h6">{`${t("site")} ${site.lat.toFixed(4)}, ${site.lng.toFixed(4)}`}</Typography>
        <IconButton size="small" onClick={onClose} aria-label="close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Grid container spacing={3}>
        <Grid size={12}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            {t("timeline")}
          </Typography>
          <List dense disablePadding>
            {site.events.map((ev) => (
              <ListItem key={ev.observation_id} disableGutters>
                <ListItemIcon>
                  <ScheduleIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={new Date(ev.occurred_at).toLocaleString()} />
              </ListItem>
            ))}
            {site.interventions.map((iv) => (
              <ListItem key={iv.id} disableGutters>
                <ListItemIcon>
                  <CheckCircleIcon fontSize="small" color="primary" />
                </ListItemIcon>
                <ListItemText primary={`${t(`iv_${iv.kind}` as StringKey)} · ${iv.performed_on}`} />
              </ListItem>
            ))}
          </List>
        </Grid>
        <Grid size={12}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {t("recordIntervention")}
          </Typography>
          <Stack
            component="form"
            spacing={2.5}
            onSubmit={(e: FormEvent) => void addIntervention(e)}
          >
            <TextField
              select
              label={t("interventionKind")}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {INTERVENTIONS.map((k) => (
                <MenuItem key={k} value={k}>
                  {t(`iv_${k}` as StringKey)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              type="date"
              label={t("performedOn")}
              value={performedOn}
              onChange={(e) => setPerformedOn(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label={t("notes")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              minRows={2}
            />
            <Button variant="contained" type="submit">
              {t("recordIntervention")}
            </Button>
          </Stack>
        </Grid>
      </Grid>
    </Drawer>
  );
}
