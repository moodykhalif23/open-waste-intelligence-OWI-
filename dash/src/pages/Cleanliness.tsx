import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Grid from "@mui/material/Grid";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { api } from "../api";
import { Muted, PageStack, SectionCard } from "../components/ui";
import { useI18n, type StringKey } from "../i18n";

interface Component {
  name: string;
  value: number;
  weight: number;
}

interface AreaScore {
  site_id: string;
  site_name: string;
  score: number | null;
  sufficient: boolean;
  method_version: string;
  components: Component[];
}

interface Methodology {
  version: string;
  weights: Record<string, number>;
  note: string;
}

// Higher score = cleaner area; map to the theme palette bands.
function scoreColor(score: number): "primary" | "warning" | "error" {
  if (score >= 75) return "primary";
  if (score >= 50) return "warning";
  return "error";
}

export default function Cleanliness() {
  const { t } = useI18n();
  const [areas, setAreas] = useState<AreaScore[] | null>(null);
  const [method, setMethod] = useState<Methodology | null>(null);

  useEffect(() => {
    void api<AreaScore[]>("/api/v1/cleanliness").then(setAreas);
    void api<Methodology>("/api/v1/cleanliness/methodology").then(setMethod);
  }, []);

  if (areas === null) return <Muted>{t("loading")}</Muted>;

  return (
    <PageStack>
      <Typography variant="h5">{t("cleanlinessIndex")}</Typography>

      {areas.length === 0 ? (
        <Muted>{t("noAreas")}</Muted>
      ) : (
        <Grid container spacing={3}>
          {areas.map((a) => {
            const color = a.score !== null ? scoreColor(a.score) : "primary";
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={a.site_id}>
                <SectionCard
                  title={a.site_name}
                  action={
                    a.sufficient && a.score !== null ? (
                      <Typography
                        color={color}
                        sx={{ fontWeight: 720, letterSpacing: "-0.02em", fontSize: "2.1rem", lineHeight: 1 }}
                      >
                        {Math.round(a.score)}
                      </Typography>
                    ) : undefined
                  }
                >
                  {!(a.sufficient && a.score !== null) && (
                    <Alert severity="warning" sx={{ mb: 2.5 }}>
                      {t("insufficient")}
                    </Alert>
                  )}
                  <Stack spacing={2.5}>
                    {a.components.map((c) => (
                      <Stack key={c.name} spacing={0.75}>
                        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline" }}>
                          <Typography variant="body2" color="text.secondary">
                            {t(`comp_${c.name}` as StringKey)}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {Math.round(c.value)}
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={c.value}
                          sx={{ height: 8, borderRadius: 999 }}
                        />
                      </Stack>
                    ))}
                  </Stack>
                </SectionCard>
              </Grid>
            );
          })}
        </Grid>
      )}

      {method && (
        <Muted>
          {t("methodology")} {method.version}: {method.note}
        </Muted>
      )}
    </PageStack>
  );
}
