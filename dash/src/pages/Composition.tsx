import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Grid from "@mui/material/Grid";
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { api } from "../api";
import EChart, { donutOption, MATERIAL_COLORS } from "../components/EChart";
import { Muted, PageStack, SectionCard, StatCard } from "../components/ui";
import { useI18n, type StringKey } from "../i18n";

interface MaterialShare {
  material: string;
  count: number;
  share_pct: number;
  delta_pct: number | null;
}

interface Composition {
  window_days: number;
  total: number;
  sufficient: boolean;
  materials: MaterialShare[];
}

const PERIODS = [7, 30, 90];

export default function Composition() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Composition | null>(null);

  const reload = useCallback(async () => {
    setData(await api<Composition>(`/api/v1/analytics/composition?days=${days}`));
  }, [days]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const label = (m: string) => t(m as StringKey);

  const periodSelect = (
    <TextField
      select
      size="small"
      value={days}
      onChange={(e) => setDays(Number(e.target.value))}
      sx={{ minWidth: 180 }}
    >
      {PERIODS.map((p) => (
        <MenuItem key={p} value={p}>
          {t("lastNDays").replace("{n}", String(p))}
        </MenuItem>
      ))}
    </TextField>
  );

  return (
    <PageStack>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Typography variant="h5">{t("wasteComposition")}</Typography>
        {periodSelect}
      </Box>

      {data === null ? (
        <Muted>{t("loading")}</Muted>
      ) : data.total === 0 ? (
        <Muted>{t("noComposition")}</Muted>
      ) : (
        <>
          {!data.sufficient && (
            <Alert severity="warning">
              {t("insufficientData").replace("{n}", String(data.total))}
            </Alert>
          )}

          <Grid container spacing={3}>
            {data.materials.slice(0, 5).map((m) => (
              <Grid key={m.material} size={{ xs: 6, sm: 4, md: 2.4 }}>
                <StatCard label={label(m.material)} value={`${Math.round(m.share_pct)}%`} />
              </Grid>
            ))}
          </Grid>

          <SectionCard title={t("share")}>
            <EChart
              height={300}
              option={donutOption(
                data.materials.map((m) => ({
                  name: label(m.material),
                  value: m.share_pct,
                  color: MATERIAL_COLORS[m.material],
                })),
              )}
            />
          </SectionCard>

          <SectionCard>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t("material")}</TableCell>
                    <TableCell>{t("share")}</TableCell>
                    <TableCell>{t("change")}</TableCell>
                    <TableCell>{t("observationsCol")}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.materials.map((m) => (
                    <TableRow key={m.material}>
                      <TableCell>{label(m.material)}</TableCell>
                      <TableCell>{m.share_pct}%</TableCell>
                      <TableCell>
                        {m.delta_pct === null ? (
                          "—"
                        ) : (
                          <Chip
                            size="small"
                            color={m.delta_pct >= 0 ? "success" : "error"}
                            label={`${m.delta_pct >= 0 ? "▲" : "▼"} ${Math.abs(m.delta_pct)}`}
                          />
                        )}
                      </TableCell>
                      <TableCell>{m.count}</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => navigate(`/records/reports?material=${m.material}`)}
                        >
                          {t("view")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </SectionCard>
        </>
      )}
    </PageStack>
  );
}
