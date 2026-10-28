import { useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { ApiError } from "../lib/api";
import { fieldLogin, type CrewIdentity } from "../lib/auth";
import SweepArt from "./SweepArt";
import { t, type Lang, type StringKey } from "../i18n";

const PIN_PATTERN = /^\d{6,12}$/;

function failureKey(error: unknown): StringKey {
  if (!(error instanceof ApiError)) return "signInOffline";
  if (error.status === 429) return "signInLocked";
  if (error.status === 403) return "signInNotCrew";
  if (error.status === 401 || error.status === 422) return "signInWrong";
  return "loadFailed";
}

export default function SignIn({
  lang,
  expired,
  onLang,
  onSignedIn,
}: {
  lang: Lang;
  expired: boolean;
  onLang: (lang: Lang) => void;
  onSignedIn: (token: string, crew: CrewIdentity | null) => void;
}) {
  const tr = (key: StringKey, vars?: Record<string, string | number>) => t(lang, key, vars);
  const [mode, setMode] = useState<"pin" | "token">("pin");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<StringKey | null>(null);

  const ready = mode === "pin" ? phone.trim().length > 0 && PIN_PATTERN.test(pin) : token.trim().length > 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    if (mode === "token") {
      onSignedIn(token.trim(), null);
      return;
    }
    if (!navigator.onLine) {
      setError("signInOffline");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await fieldLogin(phone, pin);
      onSignedIn(result.token, result.crew);
    } catch (err) {
      setError(failureKey(err));
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 480,
        mx: "auto",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        px: 3,
        pt: "max(24px, env(safe-area-inset-top))",
        pb: "max(24px, env(safe-area-inset-bottom))",
        bgcolor: "background.default",
      }}
    >
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Box component="img" src="/icon.svg" alt="" sx={{ width: 34, height: 34 }} />
          <Typography sx={{ fontWeight: 740, fontSize: "1.1rem", letterSpacing: "-0.02em" }}>OpenWaste</Typography>
        </Stack>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={lang}
          onChange={(_, value: Lang | null) => value && onLang(value)}
          sx={{ "& .MuiToggleButton-root": { px: 1.5, py: 0.5, fontWeight: 650 } }}
        >
          <ToggleButton value="en">EN</ToggleButton>
          <ToggleButton value="sw">SW</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", py: 3 }}>
        <Box sx={{ display: "flex", justifyContent: "center", mb: 2.5 }}>
          <SweepArt />
        </Box>
        <Typography
          component="h1"
          sx={{ fontSize: "2rem", fontWeight: 760, letterSpacing: "-0.025em", lineHeight: 1.1, textAlign: "center" }}
        >
          {tr("signInTitle")}
        </Typography>
        <Typography
          color="text.secondary"
          sx={{ mt: 1, mb: 3, lineHeight: 1.55, textAlign: "center", maxWidth: 340, mx: "auto" }}
        >
          {mode === "pin" ? tr("signInLede") : tr("deviceToken")}
        </Typography>

        {expired && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {tr("signInExpired")}
          </Alert>
        )}

        <Stack component="form" spacing={2} onSubmit={(e) => void submit(e)} noValidate>
          {mode === "pin" ? (
            <>
              <TextField
                fullWidth
                autoFocus
                label={tr("phoneLabel")}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                slotProps={{ htmlInput: { inputMode: "tel", autoComplete: "tel" } }}
              />
              <TextField
                fullWidth
                label={tr("pinLabel")}
                type="password"
                value={pin}
                helperText={tr("pinHint")}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 12))}
                slotProps={{
                  htmlInput: { inputMode: "numeric", pattern: "[0-9]*", maxLength: 12, autoComplete: "current-password" },
                }}
              />
            </>
          ) : (
            <TextField
              fullWidth
              autoFocus
              multiline
              minRows={3}
              label={tr("deviceToken")}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              slotProps={{ htmlInput: { autoCapitalize: "none", autoCorrect: "off", spellCheck: false } }}
            />
          )}

          {error && <Alert severity="error">{tr(error)}</Alert>}

          <Button type="submit" variant="contained" size="large" disabled={!ready || busy} sx={{ minHeight: 54 }}>
            {mode === "token" ? tr("continueLabel") : busy ? tr("signingIn") : tr("signIn")}
          </Button>
          <Button
            variant="text"
            onClick={() => {
              setMode((m) => (m === "pin" ? "token" : "pin"));
              setError(null);
            }}
          >
            {mode === "pin" ? tr("useDeviceToken") : tr("usePhonePin")}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
