import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { login } from "../api";
import { useI18n } from "../i18n";

function BinMark() {
  return (
    <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden>
      <path d="M22 26h20l-2 24a3 3 0 0 1-3 2.7H27a3 3 0 0 1-3-2.7z" fill="#10b981" />
      <rect x="20" y="22" width="24" height="4" rx="2" fill="#10b981" />
      <rect x="28" y="17" width="8" height="4" rx="2" fill="#10b981" />
    </svg>
  );
}

export default function Login() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(false);
    try {
      await login(phone, password);
      navigate("/");
    } catch {
      setError(true);
    }
  }

  return (
    <Box sx={{ minHeight: "100dvh", display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1.05fr 1fr" } }}>
      <Box
        sx={{
          display: { xs: "none", sm: "flex" },
          flexDirection: "column",
          justifyContent: "space-between",
          gap: 5,
          p: 6,
          bgcolor: "#0f172a",
          color: "#e2e8f0",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, color: "#fff" }}>
          <BinMark />
          <Typography sx={{ fontWeight: 680, fontSize: "1.05rem" }}>{t("appName")}</Typography>
        </Box>
        <Box sx={{ maxWidth: 420 }}>
          <Typography sx={{ color: "#fff", fontWeight: 680, fontSize: "1.95rem", lineHeight: 1.2, letterSpacing: "-0.02em" }}>
            {t("signInSubtitle")}
          </Typography>
          <Typography sx={{ color: "#8595ad", mt: 2, fontSize: "1rem", lineHeight: 1.6 }}>
            {t("signInTagline")}
          </Typography>
        </Box>
        <Typography sx={{ color: "#8595ad", fontSize: "0.82rem" }}>Safi Cleaners and Recyclers</Typography>
      </Box>

      <Box sx={{ display: "grid", placeItems: "center", p: 4, bgcolor: "background.default" }}>
        <Box component="form" onSubmit={(e) => void onSubmit(e)} sx={{ width: "100%", maxWidth: 340 }}>
          <Typography variant="h4" sx={{ fontSize: "1.5rem" }}>
            {t("login")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t("appName")}
          </Typography>
          <TextField
            label={t("phone")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            fullWidth
            margin="normal"
          />
          <TextField
            label={t("password")}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            fullWidth
            margin="normal"
          />
          {error && (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
              {t("loginFailed")}
            </Typography>
          )}
          <Button type="submit" variant="contained" size="large" fullWidth sx={{ mt: 3, py: 1.25 }}>
            {t("login")}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
