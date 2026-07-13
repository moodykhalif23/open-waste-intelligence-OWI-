import { useCallback, useEffect, useState, type FormEvent } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { api, apiBlob } from "../api";
import { Muted, PageStack, SectionCard } from "../components/ui";
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

const STATUS_COLOR: Record<Site["status"], "error" | "warning" | "success"> = {
  active: "error",
  recurring: "warning",
  cleaned: "success",
};

export default function Dumping() {
  const { t } = useI18n();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [sites, setSites] = useState<Site[] | null>(null);
  const [selected, setSelected] = useState<SiteDetail | null>(null);

  const reload = useCallback(async () => {
    const [c, s] = await Promise.all([
      api<Candidate[]>("/api/v1/dumping/candidates"),
      api<Site[]>("/api/v1/dumping/sites"),
    ]);
    setCandidates(c);
    setSites(s);
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

  if (sites === null) return <Muted>{t("loading")}</Muted>;

  return (
    <PageStack>
      <SectionCard title={t("reviewQueue")}>
        {candidates.length === 0 ? (
          <Muted>{t("noCandidates")}</Muted>
        ) : (
          <Stack spacing={2.5}>
            {candidates.map((c) => (
              <CandidateItem
                key={c.observation_id}
                candidate={c}
                onReview={(d) => void review(c.observation_id, d)}
              />
            ))}
          </Stack>
        )}
      </SectionCard>

      <SectionCard title={t("hotspots")}>
        {sites.length === 0 ? (
          <Muted>{t("noSites")}</Muted>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("location")}</TableCell>
                  <TableCell>{t("events")}</TableCell>
                  <TableCell>{t("lastSeen")}</TableCell>
                  <TableCell>{t("risk")}</TableCell>
                  <TableCell>{t("status")}</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {sites.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell sx={{ fontFamily: "monospace" }}>
                      {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                    </TableCell>
                    <TableCell>{s.event_count}</TableCell>
                    <TableCell>{new Date(s.last_seen).toLocaleDateString()}</TableCell>
                    <TableCell>{s.hotspot_score}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={STATUS_COLOR[s.status]}
                        label={t(`dump_${s.status}` as StringKey)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button variant="outlined" size="small" onClick={() => void openSite(s.id)}>
                        {t("view")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SectionCard>

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
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2.5}
      sx={{ alignItems: { sm: "center" } }}
    >
      {imageUrl && (
        <Box
          component="img"
          src={imageUrl}
          alt=""
          sx={{ width: 96, height: 96, objectFit: "cover", borderRadius: 2, flexShrink: 0 }}
        />
      )}
      <Box sx={{ flexGrow: 1 }}>
        <Muted>
          {candidate.lat.toFixed(4)}, {candidate.lng.toFixed(4)} ·{" "}
          {new Date(candidate.captured_at).toLocaleDateString()}
        </Muted>
        <Stack direction="row" spacing={1.5} sx={{ mt: 1.5, flexWrap: "wrap" }}>
          <Button variant="contained" color="primary" onClick={() => onReview("confirmed")}>
            {t("confirmDumping")}
          </Button>
          <Button variant="outlined" color="error" onClick={() => onReview("rejected")}>
            {t("reject")}
          </Button>
          <Button variant="outlined" onClick={() => onReview("duplicate")}>
            {t("duplicate")}
          </Button>
        </Stack>
      </Box>
    </Stack>
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
    <SectionCard
      title={`${t("site")} ${site.lat.toFixed(4)}, ${site.lng.toFixed(4)}`}
      action={
        <IconButton size="small" onClick={onClose} aria-label="close">
          <CloseIcon fontSize="small" />
        </IconButton>
      }
    >
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
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
        <Grid size={{ xs: 12, md: 6 }}>
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
    </SectionCard>
  );
}
