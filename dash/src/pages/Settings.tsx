import { useCallback, useEffect, useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { api } from "../api";
import { ErrorPanel, Muted, PageStack, SectionCard, TableSkeleton } from "../components/ui";
import { useI18n } from "../i18n";
import { useApi } from "../useApi";

interface OrgSettings {
  image_retention_months: number;
  fuel_price_kes_per_l: number | null;
  waste_density_kg_per_l: number | null;
  notify_phones: string[] | null;
}

export default function Settings() {
  const { t } = useI18n();
  const { data: initial, error: loadErr, retry } = useApi<OrgSettings>("/api/v1/admin/settings");
  const [loaded, setLoaded] = useState(false);
  const [months, setMonths] = useState("");
  const [fuelPrice, setFuelPrice] = useState("");
  const [density, setDensity] = useState("");
  const [phones, setPhones] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const apply = useCallback((s: OrgSettings) => {
    setMonths(String(s.image_retention_months));
    setFuelPrice(s.fuel_price_kes_per_l === null ? "" : String(s.fuel_price_kes_per_l));
    setDensity(s.waste_density_kg_per_l === null ? "" : String(s.waste_density_kg_per_l));
    setPhones((s.notify_phones ?? []).join(", "));
  }, []);

  useEffect(() => {
    if (initial !== null) {
      apply(initial);
      setLoaded(true);
    }
  }, [initial, apply]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const phoneList = phones
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      const saved = await api<OrgSettings>("/api/v1/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({
          image_retention_months: Number(months),
          fuel_price_kes_per_l: fuelPrice === "" ? null : Number(fuelPrice),
          waste_density_kg_per_l: density === "" ? null : Number(density),
          notify_phones: phoneList.length > 0 ? phoneList : null,
        }),
      });
      apply(saved);
      setToast(t("settingsSaved"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (loadErr) {
    return (
      <PageStack>
        <ErrorPanel message={t("errorLoad")} retryLabel={t("retry")} onRetry={retry} />
      </PageStack>
    );
  }
  if (!loaded) {
    return (
      <PageStack>
        <TableSkeleton rows={4} />
      </PageStack>
    );
  }

  return (
    <PageStack>
      <SectionCard title={t("settings")}>
        <Muted>{t("settingsHint")}</Muted>
        <Box component="form" onSubmit={(e) => void onSubmit(e)} sx={{ mt: 2, maxWidth: 420 }}>
          <Stack spacing={2}>
            {err && <Alert severity="error">{err}</Alert>}
            <TextField
              size="small"
              type="number"
              label={t("settingsRetentionMonths")}
              helperText={t("settingsRetentionHint")}
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              required
              slotProps={{ htmlInput: { min: 1, max: 120 } }}
            />
            <TextField
              size="small"
              type="number"
              label={t("settingsFuelPrice")}
              helperText={t("settingsDefaultHint")}
              value={fuelPrice}
              onChange={(e) => setFuelPrice(e.target.value)}
              slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
            />
            <TextField
              size="small"
              type="number"
              label={t("settingsWasteDensity")}
              helperText={t("settingsDefaultHint")}
              value={density}
              onChange={(e) => setDensity(e.target.value)}
              slotProps={{ htmlInput: { min: 0.01, max: 2, step: 0.01 } }}
            />
            <TextField
              size="small"
              label={t("settingsNotifyPhones")}
              helperText={t("settingsNotifyPhonesHint")}
              value={phones}
              onChange={(e) => setPhones(e.target.value)}
              slotProps={{ htmlInput: { inputMode: "tel" } }}
            />
            <Button variant="contained" type="submit" disabled={busy}>
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
