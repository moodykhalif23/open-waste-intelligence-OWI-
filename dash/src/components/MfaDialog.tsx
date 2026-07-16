import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { api, apiBlob } from "../api";
import { Muted } from "./ui";
import { useI18n } from "../i18n";

type Step =
  | { kind: "loading" }
  | { kind: "off" }
  | { kind: "enrolling"; qrUrl: string }
  | { kind: "recovery"; codes: string[] }
  | { kind: "on" };

export default function MfaDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode("");
    setErr(false);
    setStep({ kind: "loading" });
    void api<{ mfa_enabled: boolean }>("/api/v1/auth/me")
      .then((me) => setStep(me.mfa_enabled ? { kind: "on" } : { kind: "off" }))
      .catch(() => setStep({ kind: "off" }));
  }, [open]);

  async function startEnroll() {
    setBusy(true);
    setErr(false);
    try {
      await api("/api/v1/auth/mfa/enroll", { method: "POST", body: "{}" });
      const qr = await apiBlob("/api/v1/auth/mfa/qr.svg");
      setStep({ kind: "enrolling", qrUrl: URL.createObjectURL(qr) });
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    setBusy(true);
    setErr(false);
    try {
      const res = await api<{ recovery_codes: string[] }>("/api/v1/auth/mfa/activate", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      setStep({ kind: "recovery", codes: res.recovery_codes });
      setCode("");
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setErr(false);
    try {
      await api("/api/v1/auth/mfa/disable", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      onClose();
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("mfa")}</DialogTitle>
      <DialogContent dividers>
        {step.kind === "loading" && <Muted>{t("loading")}</Muted>}

        {step.kind === "off" && (
          <Stack spacing={2}>
            <Muted>{t("mfaIntro")}</Muted>
            {err && <Alert severity="error">{t("mfaInvalidCode")}</Alert>}
            <Button variant="contained" disabled={busy} onClick={() => void startEnroll()}>
              {t("mfaStart")}
            </Button>
          </Stack>
        )}

        {step.kind === "enrolling" && (
          <Stack spacing={2} sx={{ alignItems: "center" }}>
            <Box component="img" src={step.qrUrl} alt="" sx={{ width: 200, height: 200 }} />
            <Muted>{t("mfaScan")}</Muted>
            {err && <Alert severity="error">{t("mfaInvalidCode")}</Alert>}
            <TextField
              size="small"
              fullWidth
              label={t("otpCode")}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 6 } }}
            />
            <Button variant="contained" fullWidth disabled={busy || code.length < 6} onClick={() => void activate()}>
              {t("mfaActivate")}
            </Button>
          </Stack>
        )}

        {step.kind === "recovery" && (
          <Stack spacing={2}>
            <Alert severity="warning">{t("mfaRecoveryTitle")}</Alert>
            <Box
              sx={{
                p: 1.5,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "4px",
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.9rem",
                columnCount: 2,
              }}
            >
              {step.codes.map((c) => (
                <Typography key={c} sx={{ fontFamily: "inherit", fontSize: "inherit" }}>
                  {c}
                </Typography>
              ))}
            </Box>
            <Button
              variant="outlined"
              onClick={() => void navigator.clipboard.writeText(step.codes.join("\n"))}
            >
              {t("copyCodes")}
            </Button>
          </Stack>
        )}

        {step.kind === "on" && (
          <Stack spacing={2}>
            <Alert severity="success">{t("mfaEnabled")}</Alert>
            {err && <Alert severity="error">{t("mfaInvalidCode")}</Alert>}
            <TextField
              size="small"
              fullWidth
              label={t("otpCode")}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 10 } }}
            />
            <Button
              variant="outlined"
              color="error"
              disabled={busy || code.length < 6}
              onClick={() => void disable()}
            >
              {t("mfaDisable")}
            </Button>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("close")}</Button>
      </DialogActions>
    </Dialog>
  );
}
