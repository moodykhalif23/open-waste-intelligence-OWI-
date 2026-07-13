import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckCircle from "@mui/icons-material/CheckCircle";
import EChart, { ringOption } from "./EChart";
import { t, type Lang, type StringKey } from "../i18n";
import {
  collectStop,
  fetchCollectList,
  fetchRoutes,
  markCollected,
  type BinHealth,
  type Route,
} from "../lib/collect";

type Load =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "routes"; routes: Route[] }
  | { kind: "list"; bins: BinHealth[] };

const RISK_COLOR: Record<string, string> = {
  high: "#c0392b",
  medium: "#b4791a",
  low: "#0e7a55",
};

export default function CollectList({ lang, token }: { lang: Lang; token: string }) {
  const tr = (key: StringKey, vars?: Record<string, string | number>) => t(lang, key, vars);
  const [state, setState] = useState<Load>({ kind: "loading" });

  const reload = useCallback(async () => {
    if (!token) return setState({ kind: "error" });
    try {
      const routes = (await fetchRoutes(token)).filter((r) => r.stops.length > 0);
      if (routes.length > 0) return setState({ kind: "routes", routes });
      // No route planned yet — fall back to the raw collect-today list.
      setState({ kind: "list", bins: await fetchCollectList(token) });
    } catch {
      setState({ kind: "error" });
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function doStop(stopId: string) {
    await collectStop(token, stopId);
    await reload();
  }

  async function doBin(binId: string) {
    await markCollected(token, binId);
    await reload();
  }

  if (state.kind === "loading")
    return <Typography variant="body2" color="text.secondary">{tr("loading")}</Typography>;
  if (state.kind === "error") return <Alert severity="warning">{tr("collectOffline")}</Alert>;

  if (state.kind === "list") {
    if (state.bins.length === 0)
      return <Typography variant="body2" color="text.secondary">{tr("collectNone")}</Typography>;
    return (
      <Stack divider={<Divider />}>
        {state.bins.map((bin) => (
          <Stack
            key={bin.bin_id}
            direction="row"
            spacing={1.5}
            sx={{ alignItems: "center", py: 1.5 }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Box
                  sx={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, bgcolor: RISK_COLOR[bin.overflow_risk] }}
                  aria-hidden
                />
                <Typography sx={{ fontWeight: 600, fontSize: "0.92rem" }} noWrap>
                  {bin.site_name} · {bin.qr_code}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {Math.round(bin.fill_pct)}% ·{" "}
                {bin.recommendation === "collect_today" ? tr("collectNow") : tr("collectSoon")}
              </Typography>
            </Box>
            <Button variant="contained" size="small" onClick={() => void doBin(bin.bin_id)}>
              {tr("done")}
            </Button>
          </Stack>
        ))}
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5}>
      {state.routes.map((route) => {
        const done = route.stops.filter((s) => s.collected).length;
        return (
          <Box key={route.id}>
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ alignItems: "center", justifyContent: "space-between", pb: 1.25, mb: 1.25, borderBottom: "1px solid", borderColor: "divider" }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 660 }} noWrap>
                  {route.truck_name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {route.planned_km} km · {route.stops.length} {tr("stopsShort")}
                </Typography>
              </Box>
              <Box sx={{ width: 54, height: 54, flexShrink: 0 }}>
                <EChart height={54} option={ringOption(done, route.stops.length)} />
              </Box>
            </Stack>
            <Stack spacing={1}>
              {route.stops.map((stop) => (
                <Stack key={stop.id} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                  <Box
                    sx={{
                      width: 26,
                      height: 26,
                      flexShrink: 0,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.82rem",
                      fontWeight: 650,
                      bgcolor: stop.collected ? "primary.main" : "primary.light",
                      color: stop.collected ? "#fff" : "primary.dark",
                      ...(stop.collected ? {} : { bgcolor: "#eceef1", color: "primary.dark" }),
                    }}
                  >
                    {stop.seq + 1}
                  </Box>
                  <Typography
                    sx={{
                      flex: 1,
                      fontFamily: "ui-monospace, Consolas, monospace",
                      fontSize: "0.9rem",
                      color: stop.collected ? "text.secondary" : "text.primary",
                      textDecoration: stop.collected ? "line-through" : "none",
                    }}
                  >
                    {stop.qr_code}
                  </Typography>
                  {stop.collected ? (
                    <CheckCircle color="primary" aria-label={tr("done")} />
                  ) : (
                    <Button variant="contained" size="small" onClick={() => void doStop(stop.id)}>
                      {tr("done")}
                    </Button>
                  )}
                </Stack>
              ))}
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}
