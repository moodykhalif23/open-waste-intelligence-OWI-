import { useEffect, useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { api } from "../api";
import { Muted, PageStack, SectionCard } from "../components/ui";
import { useI18n } from "../i18n";

interface OrgSettings {
  image_retention_months: number;
}

export default function Settings() {
  const { t } = useI18n();
  const [months, setMonths] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void api<OrgSettings>("/api/v1/admin/settings")
      .then((s) => setMonths(String(s.image_retention_months)))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const saved = await api<OrgSettings>("/api/v1/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ image_retention_months: Number(months) }),
      });
      setMonths(String(saved.image_retention_months));
      setToast(t("settingsSaved"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (months === null && !err) return <Muted>{t("loading")}</Muted>;

  return (
    <PageStack>
      <SectionCard title={t("settingsRetention")}>
        <Muted>{t("settingsRetentionHint")}</Muted>
        <Box component="form" onSubmit={(e) => void onSubmit(e)} sx={{ mt: 2, maxWidth: 420 }}>
          <Stack spacing={2}>
            {err && <Alert severity="error">{err}</Alert>}
            <TextField
              size="small"
              type="number"
              label={t("settingsRetentionMonths")}
              value={months ?? ""}
              onChange={(e) => setMonths(e.target.value)}
              required
              slotProps={{ htmlInput: { min: 1, max: 120 } }}
            />
            <Button variant="contained" type="submit" disabled={busy || months === null}>
              {t("save")}
            </Button>
          </Stack>
        </Box>
      </SectionCard>
      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </PageStack>
  );
}
