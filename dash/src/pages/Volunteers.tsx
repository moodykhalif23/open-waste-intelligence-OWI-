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
import Typography from "@mui/material/Typography";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import { api, getToken } from "../api";
import EChart, { lineOption } from "../components/EChart";
import { Muted, PageStack, SectionCard, StatCard } from "../components/ui";
import { useI18n } from "../i18n";

const EVENT_TYPES = ["cleanup", "education", "sorting"] as const;
const MATERIALS = ["plastic", "glass", "metal", "paper", "organic"] as const;

interface MonthPoint {
  month: string;
  events: number;
  hours: number;
  kg: number;
}

interface Summary {
  events: number;
  participants: number;
  hours: number;
  kg_total: number;
  kg_by_material: Record<string, number>;
  monthly: MonthPoint[];
}

interface Event {
  id: string;
  occurred_on: string;
  event_type: string;
  area: string;
  organizer: string;
  participant_count: number;
  hours_total: number;
}

export default function Volunteers() {
  const { t } = useI18n();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [events, setEvents] = useState<Event[]>([]);

  const reload = useCallback(async () => {
    const [s, e] = await Promise.all([
      api<Summary>("/api/v1/volunteers/summary"),
      api<Event[]>("/api/v1/volunteers"),
    ]);
    setSummary(s);
    setEvents(e);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function openReport() {
    const end = new Date().toISOString().slice(0, 10);
    const url = `/api/v1/volunteers/report?start=2000-01-01&end=${end}`;
    // Authenticated GET: fetch with the token, then open the HTML blob in a new tab to print.
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${getToken() ?? ""}` },
    });
    const blob = await response.blob();
    window.open(URL.createObjectURL(blob), "_blank", "noopener");
  }

  if (summary === null) return <Muted>{t("loading")}</Muted>;

  const trend = {
    categories: summary.monthly.map((m) => m.month),
    values: summary.monthly.map((m) => m.hours),
  };

  return (
    <PageStack>
      <Grid container spacing={3}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label={t("eventsHeld")} value={summary.events} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label={t("participants")} value={summary.participants} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label={t("volunteerHours")} value={summary.hours} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label={t("kgCollected")} value={summary.kg_total} />
        </Grid>
      </Grid>

      <SectionCard
        title={t("hoursByMonth")}
        action={
          <Button
            variant="outlined"
            size="small"
            startIcon={<DescriptionOutlinedIcon />}
            onClick={() => void openReport()}
          >
            {t("grantReport")}
          </Button>
        }
      >
        {summary.monthly.length > 0 ? (
          <EChart option={lineOption(trend.categories, trend.values)} />
        ) : (
          <Muted>{t("noData")}</Muted>
        )}
      </SectionCard>

      <EventForm onCreated={reload} />

      <SectionCard title={t("events")}>
        {events.length === 0 ? (
          <Muted>{t("noData")}</Muted>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("date")}</TableCell>
                  <TableCell>{t("type")}</TableCell>
                  <TableCell>{t("area")}</TableCell>
                  <TableCell>{t("organizer")}</TableCell>
                  <TableCell align="right">{t("participants")}</TableCell>
                  <TableCell align="right">{t("hours")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.occurred_on}</TableCell>
                    <TableCell>{t(e.event_type as "cleanup")}</TableCell>
                    <TableCell>{e.area}</TableCell>
                    <TableCell>{e.organizer}</TableCell>
                    <TableCell align="right">{e.participant_count}</TableCell>
                    <TableCell align="right">{e.hours_total}</TableCell>
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

function EventForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const { t } = useI18n();
  const [occurredOn, setOccurredOn] = useState(new Date().toISOString().slice(0, 10));
  const [eventType, setEventType] = useState<string>("cleanup");
  const [area, setArea] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [participants, setParticipants] = useState("");
  const [hours, setHours] = useState("");
  const [materials, setMaterials] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const materials_kg: Record<string, number> = {};
    for (const [m, v] of Object.entries(materials)) {
      const n = Number(v);
      if (v && n > 0) materials_kg[m] = n;
    }
    await api("/api/v1/volunteers", {
      method: "POST",
      body: JSON.stringify({
        occurred_on: occurredOn,
        event_type: eventType,
        area,
        organizer,
        participant_count: Number(participants),
        hours_total: Number(hours),
        materials_kg,
      }),
    });
    setArea("");
    setOrganizer("");
    setParticipants("");
    setHours("");
    setMaterials({});
    await onCreated();
  }

  return (
    <SectionCard title={t("logEvent")}>
      <Stack component="form" spacing={2.5} onSubmit={(e) => void onSubmit(e)}>
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label={t("date")}
              value={occurredOn}
              onChange={(e) => setOccurredOn(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField
              select
              fullWidth
              size="small"
              label={t("type")}
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
            >
              {EVENT_TYPES.map((v) => (
                <MenuItem key={v} value={v}>
                  {t(v)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField
              fullWidth
              size="small"
              label={t("area")}
              value={area}
              onChange={(e) => setArea(e.target.value)}
              required
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField
              fullWidth
              size="small"
              label={t("organizer")}
              value={organizer}
              onChange={(e) => setOrganizer(e.target.value)}
              required
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField
              fullWidth
              size="small"
              type="number"
              label={t("participants")}
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              slotProps={{ htmlInput: { min: 0 } }}
              required
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField
              fullWidth
              size="small"
              type="number"
              label={t("volunteerHours")}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
              required
            />
          </Grid>
        </Grid>

        <Typography variant="subtitle2" color="text.secondary">
          {t("materialsKg")}
        </Typography>
        <Grid container spacing={2}>
          {MATERIALS.map((m) => (
            <Grid key={m} size={{ xs: 6, sm: 4, md: 2.4 }}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label={t(m)}
                value={materials[m] ?? ""}
                onChange={(e) => setMaterials((prev) => ({ ...prev, [m]: e.target.value }))}
                slotProps={{ htmlInput: { min: 0, step: 0.1 } }}
              />
            </Grid>
          ))}
        </Grid>

        <Stack direction="row">
          <Button variant="contained" type="submit">
            {t("logEvent")}
          </Button>
        </Stack>
      </Stack>
    </SectionCard>
  );
}
