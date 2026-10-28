import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ShowChartOutlined from "@mui/icons-material/ShowChartOutlined";
import VolunteerActivismOutlined from "@mui/icons-material/VolunteerActivismOutlined";
import { api, apiUrl, getToken } from "../api";
import { DataTable, type GridColDef } from "../components/DataTable";
import EChart, { areaOption, intlLocale } from "../components/EChart";
import {
  EmptyState,
  ErrorPanel,
  FilterChips,
  PageSkeleton,
  PageStack,
  SectionCard,
  StatCard,
  StatRow,
  TableSection,
  Tag,
} from "../components/ui";
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

type TypeFilter = "all" | (typeof EVENT_TYPES)[number];

export default function Volunteers() {
  const { t, lang } = useI18n();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<TypeFilter>("all");

  const shown = useMemo(() => (kind === "all" ? events : events.filter((e) => e.event_type === kind)), [events, kind]);

  const reload = useCallback(async () => {
    try {
      const [s, e] = await Promise.all([
        api<Summary>("/api/v1/volunteers/summary"),
        api<Event[]>("/api/v1/volunteers"),
      ]);
      setSummary(s);
      setEvents(e);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const reportFrame = useRef<HTMLIFrameElement>(null);

  async function openReport() {
    const end = new Date().toISOString().slice(0, 10);
    const url = `/api/v1/volunteers/report?start=2000-01-01&end=${end}`;
    // Authenticated GET: fetch with the token, then open the HTML blob in a new tab to print.
    const response = await fetch(apiUrl(url), {
      headers: { Authorization: `Bearer ${getToken() ?? ""}` },
    });
    const blob = await response.blob();
    setReportUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(blob);
    });
  }

  function closeReport() {
    setReportUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  }

  if (error !== null) {
    return (
      <PageStack>
        <ErrorPanel message={t("errorLoad")} retryLabel={t("retry")} onRetry={() => void reload()} />
        <Dialog open={reportUrl !== null} onClose={closeReport} maxWidth="lg" fullWidth>
        <DialogTitle>{t("grantReport")}</DialogTitle>
        <DialogContent sx={{ p: 0, height: "75vh" }}>
          {reportUrl && (
            <Box
              component="iframe"
              ref={reportFrame}
              src={reportUrl}
              title={t("grantReport")}
              sx={{ display: "block", width: "100%", height: "100%", border: 0 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeReport}>{t("close")}</Button>
          <Button variant="contained" onClick={() => reportFrame.current?.contentWindow?.print()}>
            {t("printReport")}
          </Button>
        </DialogActions>
      </Dialog>
    </PageStack>
    );
  }
  if (summary === null) return <PageSkeleton />;

  const monthFmt = new Intl.DateTimeFormat(intlLocale(lang), { month: "short", year: "numeric" });
  const monthLabel = (m: string) => {
    const d = new Date(`${m}-01T00:00:00`);
    return Number.isNaN(d.getTime()) ? m : monthFmt.format(d);
  };
  const trend = {
    categories: summary.monthly.map((m) => monthLabel(m.month)),
    values: summary.monthly.map((m) => m.hours),
  };

  const eventCols: GridColDef<Event>[] = [
    { field: "occurred_on", headerName: t("date"), width: 130 },
    {
      field: "event_type",
      headerName: t("type"),
      width: 130,
      valueGetter: (_v, row) => t(row.event_type as "cleanup"),
      renderCell: (p) => <Tag>{p.value as string}</Tag>,
    },
    { field: "area", headerName: t("area"), flex: 1, minWidth: 120 },
    { field: "organizer", headerName: t("organizer"), flex: 1, minWidth: 120 },
    { field: "participant_count", headerName: t("participants"), type: "number", width: 130, valueFormatter: (v) => Number(v).toLocaleString() },
    { field: "hours_total", headerName: t("hours"), type: "number", width: 110, valueFormatter: (v) => Number(v).toLocaleString() },
  ];

  return (
    <PageStack>
      <StatRow>
        <StatCard label={t("eventsHeld")} value={summary.events.toLocaleString()} spark={summary.monthly.map((m) => m.events)} />
        <StatCard label={t("participants")} value={summary.participants.toLocaleString()} />
        <StatCard label={t("volunteerHours")} value={summary.hours.toLocaleString()} spark={summary.monthly.map((m) => m.hours)} />
        <StatCard label={t("kgCollected")} value={summary.kg_total.toLocaleString()} spark={summary.monthly.map((m) => m.kg)} />
      </StatRow>

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
          <EChart height={240} option={areaOption(trend.categories, trend.values)} />
        ) : (
          <EmptyState icon={<ShowChartOutlined />} title={t("noData")} height={240} />
        )}
      </SectionCard>

      <EventForm onCreated={reload} />

      <TableSection title={t("events")}>
        {events.length === 0 ? (
          <SectionCard>
            <EmptyState icon={<VolunteerActivismOutlined />} title={t("noData")} />
          </SectionCard>
        ) : (
          <DataTable
            rows={shown}
            columns={eventCols}
            pageSize={10}
            filters={
              <FilterChips<TypeFilter>
                value={kind}
                onChange={setKind}
                options={[
                  { value: "all", label: t("all"), count: events.length },
                  ...EVENT_TYPES.map((v) => ({ value: v, label: t(v), count: events.filter((e) => e.event_type === v).length })),
                ]}
              />
            }
          />
        )}
      </TableSection>
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
    <SectionCard collapsible title={t("logEvent")}>
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
