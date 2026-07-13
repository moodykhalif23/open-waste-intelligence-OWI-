import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import EChart, { donutOption, heatmapOption, hbarOption, RISK_HUE } from "./EChart";
import { fetchBinHealth, type BinHealth } from "../lib/collect";
import { t, type Lang, type StringKey } from "../i18n";

type Risk = "high" | "medium" | "low";
type Filter = "all" | Risk;
type Load =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "data"; bins: BinHealth[] };

const BANDS = ["empty", "low", "half", "high", "overflowing"] as const;
const RISK_ORDER: Risk[] = ["high", "medium", "low"];
const MAX_SITES = 8;

function bandIndex(pct: number): number {
  if (pct < 10) return 0;
  if (pct < 35) return 1;
  if (pct < 60) return 2;
  if (pct < 85) return 3;
  return 4;
}

// A titled section — flat, 4px, matches the rest of the app. Collapsible ones
// use an accordion so a collector on a small phone can fold charts away and
// get to the table quickly.
function Panel({ title, collapsible, children }: { title: string; collapsible?: boolean; children: ReactNode }) {
  if (collapsible) {
    return (
      <Accordion
        defaultExpanded
        disableGutters
        elevation={0}
        sx={{ border: "1px solid", borderColor: "divider", borderRadius: "4px", "&:before": { display: "none" } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
          <Typography variant="body2" sx={{ fontWeight: 660 }}>
            {title}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>{children}</AccordionDetails>
      </Accordion>
    );
  }
  return (
    <Card>
      <CardContent sx={{ "&:last-child": { pb: 2 } }}>
        <Typography variant="body2" sx={{ fontWeight: 660, mb: 1.5 }}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}

export default function Insights({ lang, token }: { lang: Lang; token: string }) {
  const tr = (key: StringKey, vars?: Record<string, string | number>) => t(lang, key, vars);
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const reload = useCallback(async () => {
    if (!token) return setState({ kind: "error" });
    try {
      setState({ kind: "data", bins: await fetchBinHealth(token) });
    } catch {
      setState({ kind: "error" });
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const bins = state.kind === "data" ? state.bins : [];

  const riskMix = useMemo(
    () =>
      RISK_ORDER.map((r) => ({
        name: tr(`risk${r[0]!.toUpperCase()}${r.slice(1)}` as StringKey),
        value: bins.filter((b) => b.overflow_risk === r).length,
        color: RISK_HUE[r],
      })).filter((s) => s.value > 0),
    [bins, lang],
  );

  const heat = useMemo(() => {
    const bySite = new Map<string, number>();
    for (const b of bins) bySite.set(b.site_name, (bySite.get(b.site_name) ?? 0) + 1);
    const sites = [...bySite.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_SITES)
      .map(([name]) => name);
    const idx = new Map(sites.map((s, i) => [s, i]));
    const grid = sites.map(() => new Array<number>(BANDS.length).fill(0));
    for (const b of bins) {
      const row = idx.get(b.site_name);
      if (row === undefined) continue;
      const col = bandIndex(b.fill_pct);
      grid[row]![col] = (grid[row]![col] ?? 0) + 1;
    }
    const data: [number, number, number][] = [];
    let max = 0;
    for (let r = 0; r < sites.length; r++)
      for (let c = 0; c < BANDS.length; c++) {
        const v = grid[r]![c] ?? 0;
        if (v > 0) {
          data.push([c, r, v]);
          if (v > max) max = v;
        }
      }
    return { sites, labels: BANDS.map((b) => tr(b)), data, max };
  }, [bins, lang]);

  const top = useMemo(() => {
    const sorted = [...bins].sort((a, b) => b.fill_pct - a.fill_pct).slice(0, 8);
    return {
      labels: sorted.map((b) => b.qr_code),
      values: sorted.map((b) => Math.round(b.fill_pct)),
      colors: sorted.map((b) => RISK_HUE[b.overflow_risk] ?? "#059669"),
    };
  }, [bins]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bins
      .filter((b) => filter === "all" || b.overflow_risk === filter)
      .filter(
        (b) =>
          !q ||
          b.site_name.toLowerCase().includes(q) ||
          b.qr_code.toLowerCase().includes(q),
      )
      .sort((a, b) => b.fill_pct - a.fill_pct);
  }, [bins, filter, query]);

  if (state.kind === "loading")
    return <Typography variant="body2" color="text.secondary">{tr("loading")}</Typography>;
  if (state.kind === "error") return <Alert severity="warning">{tr("collectOffline")}</Alert>;
  if (bins.length === 0)
    return <Typography variant="body2" color="text.secondary">{tr("insightsEmpty")}</Typography>;

  const recLabel = (r: BinHealth["recommendation"]) =>
    r === "collect_today" ? tr("collectNow") : r === "schedule_soon" ? tr("collectSoon") : tr("recNone");

  return (
    <Stack spacing={2}>
      <Panel collapsible title={tr("insightsRiskMix")}>
        <EChart height={190} option={donutOption(riskMix)} />
      </Panel>

      <Panel collapsible title={tr("insightsFillBySite")}>
        <EChart
          height={Math.max(170, heat.sites.length * 26 + 70)}
          option={heatmapOption(heat.labels, heat.sites, heat.data, heat.max)}
        />
      </Panel>

      <Panel collapsible title={tr("insightsTopFill")}>
        <EChart height={Math.max(150, top.labels.length * 26)} option={hbarOption(top.labels, top.values, top.colors)} />
      </Panel>

      <Panel title={tr("insightsTable")}>
        <Stack spacing={1.5}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={filter}
            onChange={(_, v: Filter | null) => v && setFilter(v)}
            sx={{ flexWrap: "wrap", "& .MuiToggleButton-root": { px: 1.5, py: 0.5 } }}
          >
            <ToggleButton value="all">{tr("filterAll")}</ToggleButton>
            <ToggleButton value="high">{tr("riskHigh")}</ToggleButton>
            <ToggleButton value="medium">{tr("riskMedium")}</ToggleButton>
            <ToggleButton value="low">{tr("riskLow")}</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            size="small"
            fullWidth
            placeholder={tr("searchBins")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {rows.length === 0 ? (
            <Typography variant="body2" color="text.secondary">{tr("noMatches")}</Typography>
          ) : (
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ "& td, & th": { whiteSpace: "nowrap" } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>{tr("colBin")}</TableCell>
                    <TableCell align="right">{tr("colFill")}</TableCell>
                    <TableCell>{tr("colRisk")}</TableCell>
                    <TableCell align="right">{tr("colDays")}</TableCell>
                    <TableCell>{tr("colAction")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((b) => (
                    <TableRow key={b.bin_id}>
                      <TableCell>
                        <Typography sx={{ fontSize: "0.82rem", fontWeight: 600 }}>{b.site_name}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "ui-monospace, monospace" }}>
                          {b.qr_code}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                        {Math.round(b.fill_pct)}%
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: RISK_HUE[b.overflow_risk] }} />
                          <Typography variant="body2">{tr(`risk${b.overflow_risk[0]!.toUpperCase()}${b.overflow_risk.slice(1)}` as StringKey)}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                        {b.days_since_collection ?? "—"}
                      </TableCell>
                      <TableCell>{recLabel(b.recommendation)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      </Panel>
    </Stack>
  );
}
