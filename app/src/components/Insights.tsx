import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import InputAdornment from "@mui/material/InputAdornment";
import { RISK_HUE } from "./EChart";
import { fetchBinHealth, type BinHealth } from "../lib/collect";
import { ApiError } from "../lib/api";
import { FILL_BANDS } from "../lib/queue";
import { t, type Lang, type StringKey } from "../i18n";

type Risk = "high" | "medium" | "low";
type Filter = "all" | Risk;
type Load =
  | { kind: "loading" }
  | { kind: "error"; message: StringKey }
  | { kind: "data"; bins: BinHealth[] };

const RISK_ORDER: Risk[] = ["high", "medium", "low"];
const MAX_SITES = 6;
const PAGE = 20;
const BAND_HUE = ["#e6e1d5", "#c9c3b5", "#8a8f9b", "#3a4256", "#c0392b"];

const riskKey = (r: Risk) => `risk${r[0]!.toUpperCase()}${r.slice(1)}` as StringKey;

function bandIndex(pct: number): number {
  if (pct < 10) return 0;
  if (pct < 35) return 1;
  if (pct < 60) return 2;
  if (pct < 85) return 3;
  return 4;
}

function Panel({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardContent sx={{ "&:last-child": { pb: 2 } }}>
        <Stack direction="row" sx={{ alignItems: "baseline", justifyContent: "space-between", mb: 1.5, gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 680 }}>
            {title}
          </Typography>
          {aside}
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

function Meter({ pct, color }: { pct: number; color: string }) {
  return (
    <Box sx={{ height: 6, borderRadius: 3, bgcolor: "#efece4", overflow: "hidden" }}>
      <Box sx={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: "100%", borderRadius: 3, bgcolor: color }} />
    </Box>
  );
}

export default function Insights({ lang, token }: { lang: Lang; token: string }) {
  const tr = (key: StringKey, vars?: Record<string, string | number>) => t(lang, key, vars);
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);

  const reload = useCallback(async () => {
    if (!token) {
      setState({ kind: "error", message: "tokenMissing" });
      return;
    }
    try {
      setState({ kind: "data", bins: await fetchBinHealth(token) });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.status === 401
            ? "tokenInvalid"
            : error.status === 403
              ? "accessDenied"
              : "loadFailed"
          : "insightsOffline";
      setState({ kind: "error", message });
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const retryWhenOnline = () => void reload();
    window.addEventListener("online", retryWhenOnline);
    return () => window.removeEventListener("online", retryWhenOnline);
  }, [reload]);

  useEffect(() => setShown(PAGE), [filter, query]);

  const bins = state.kind === "data" ? state.bins : [];

  const riskCounts = useMemo(() => {
    const counts: Record<Risk, number> = { high: 0, medium: 0, low: 0 };
    for (const b of bins) counts[b.overflow_risk] += 1;
    return counts;
  }, [bins]);

  const bandCounts = useMemo(() => {
    const counts = new Array<number>(FILL_BANDS.length).fill(0);
    for (const b of bins) {
      const i = bandIndex(b.fill_pct);
      counts[i] = (counts[i] ?? 0) + 1;
    }
    return counts;
  }, [bins]);

  const sites = useMemo(() => {
    const bySite = new Map<string, { total: number; high: number; medium: number }>();
    for (const b of bins) {
      const s = bySite.get(b.site_name) ?? { total: 0, high: 0, medium: 0 };
      s.total += 1;
      if (b.overflow_risk === "high") s.high += 1;
      if (b.overflow_risk === "medium") s.medium += 1;
      bySite.set(b.site_name, s);
    }
    return [...bySite.entries()]
      .filter(([, s]) => s.high + s.medium > 0)
      .sort((a, b) => b[1].high - a[1].high || b[1].medium - a[1].medium)
      .slice(0, MAX_SITES);
  }, [bins]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bins
      .filter((b) => filter === "all" || b.overflow_risk === filter)
      .filter((b) => !q || b.site_name.toLowerCase().includes(q) || b.qr_code.toLowerCase().includes(q))
      .sort((a, b) => b.fill_pct - a.fill_pct);
  }, [bins, filter, query]);

  if (state.kind === "loading")
    return <Typography variant="body2" color="text.secondary">{tr("loading")}</Typography>;
  if (state.kind === "error")
    return (
      <Alert
        severity="warning"
        action={<Button color="inherit" size="small" onClick={() => void reload()}>{tr("retry")}</Button>}
      >
        {tr(state.message)}
      </Alert>
    );
  if (bins.length === 0)
    return <Typography variant="body2" color="text.secondary">{tr("insightsEmpty")}</Typography>;

  const recLabel = (r: BinHealth["recommendation"]) =>
    r === "collect_today" ? tr("collectNow") : r === "schedule_soon" ? tr("collectSoon") : tr("recNone");
  const filters: [Filter, string, number][] = [
    ["all", tr("filterAll"), bins.length],
    ...RISK_ORDER.map((r) => [r, tr(riskKey(r)), riskCounts[r]] as [Filter, string, number]),
  ];

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent sx={{ "&:last-child": { pb: 2 } }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {tr("insightsBinsTracked")}
          </Typography>
          <Typography sx={{ fontSize: "2.1rem", fontWeight: 760, lineHeight: 1.1, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
            {bins.length.toLocaleString()}
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, mt: 1.5 }}>
            {RISK_ORDER.map((r) => (
              <Box key={r} sx={{ p: 1.25, borderRadius: "4px", bgcolor: "background.default" }}>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: RISK_HUE[r] }} />
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    {tr(riskKey(r))}
                  </Typography>
                </Stack>
                <Typography sx={{ fontSize: "1.25rem", fontWeight: 720, fontVariantNumeric: "tabular-nums" }}>
                  {riskCounts[r].toLocaleString()}
                </Typography>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      <Panel title={tr("insightsFillMix")}>
        <Box sx={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", mb: 1.5 }}>
          {bandCounts.map((n, i) => (
            <Box key={FILL_BANDS[i]} sx={{ width: `${(n / bins.length) * 100}%`, bgcolor: BAND_HUE[i] }} />
          ))}
        </Box>
        <Stack spacing={0.75}>
          {FILL_BANDS.map((band, i) => (
            <Stack key={band} direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: BAND_HUE[i], flexShrink: 0 }} />
              <Typography variant="body2" sx={{ flex: 1 }}>
                {tr(band)}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 640, fontVariantNumeric: "tabular-nums" }}>
                {(bandCounts[i] ?? 0).toLocaleString()}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Panel>

      {sites.length > 0 && (
        <Panel title={tr("insightsSites")}>
          <Stack spacing={1.5}>
            {sites.map(([name, s]) => (
              <Box key={name}>
                <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1, mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                    {tr("insightsHighOf", { n: s.high, m: s.total })}
                  </Typography>
                </Stack>
                <Meter pct={((s.high + s.medium * 0.5) / s.total) * 100} color={s.high > 0 ? RISK_HUE.high! : RISK_HUE.medium!} />
              </Box>
            ))}
          </Stack>
        </Panel>
      )}

      <Panel
        title={tr("insightsTable")}
        aside={
          <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
            {tr("insightsShowing", { n: Math.min(shown, rows.length).toLocaleString(), m: rows.length.toLocaleString() })}
          </Typography>
        }
      >
        <Stack spacing={1.5}>
          <Stack direction="row" sx={{ gap: 0.75, flexWrap: "wrap" }}>
            {filters.map(([value, label, count]) => (
              <Chip
                key={value}
                label={`${label} · ${count.toLocaleString()}`}
                onClick={() => setFilter(value)}
                color={filter === value ? "primary" : "default"}
                variant={filter === value ? "filled" : "outlined"}
                sx={{ fontWeight: 600 }}
              />
            ))}
          </Stack>
          <TextField
            size="small"
            fullWidth
            placeholder={tr("searchBins")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />

          {rows.length === 0 ? (
            <Typography variant="body2" color="text.secondary">{tr("noMatches")}</Typography>
          ) : (
            <Box>
              {rows.slice(0, shown).map((b) => (
                <Box
                  key={b.bin_id}
                  sx={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 0.5, py: 1.25, borderTop: "1px solid", borderColor: "divider" }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 620 }} noWrap>
                      {b.site_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {b.qr_code}
                      {b.days_since_collection !== null && ` · ${tr("daysSince", { n: Math.round(b.days_since_collection) })}`}
                    </Typography>
                  </Box>
                  <Stack sx={{ alignItems: "flex-end" }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {Math.round(b.fill_pct)}%
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                      <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: RISK_HUE[b.overflow_risk] }} />
                      <Typography variant="caption" color="text.secondary">
                        {recLabel(b.recommendation)}
                      </Typography>
                    </Stack>
                  </Stack>
                  <Box sx={{ gridColumn: "1 / -1" }}>
                    <Meter pct={b.fill_pct} color={RISK_HUE[b.overflow_risk] ?? "#3a4256"} />
                  </Box>
                </Box>
              ))}
              {rows.length > shown && (
                <Button fullWidth variant="outlined" onClick={() => setShown((n) => n + PAGE)} sx={{ mt: 1 }}>
                  {tr("insightsShowMore", { n: Math.min(PAGE, rows.length - shown) })}
                </Button>
              )}
            </Box>
          )}
        </Stack>
      </Panel>
    </Stack>
  );
}
