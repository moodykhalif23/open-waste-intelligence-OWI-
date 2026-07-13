import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { login } from "../api";
import { useI18n } from "../i18n";

function BinMark({ size = 30, color = "#34d399" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <path d="M22 26h20l-2 24a3 3 0 0 1-3 2.7H27a3 3 0 0 1-3-2.7z" fill={color} />
      <rect x="20" y="22" width="24" height="4" rx="2" fill={color} />
      <rect x="28" y="17" width="8" height="4" rx="2" fill={color} />
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
          position: "relative",
          overflow: "hidden",
          display: { xs: "none", sm: "flex" },
          flexDirection: "column",
          justifyContent: "space-between",
          gap: 5,
          p: 6,
          bgcolor: "#04372b",
          color: "#ffffff",
        }}
      >
        {/* Oversized brand mark as a calm watermark - flat, no gradient. */}
        <Box sx={{ position: "absolute", right: -60, bottom: -50, opacity: 0.08, pointerEvents: "none" }}>
          <BinMark size={420} color="#34d399" />
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.75, zIndex: 1 }}>
          <Box
            sx={{
              display: "grid",
              placeItems: "center",
              width: 56,
              height: 56,
              borderRadius: 3,
              bgcolor: "rgba(52,211,153,0.14)",
            }}
          >
            <BinMark size={34} />
          </Box>
          <Typography sx={{ fontWeight: 720, fontSize: "1.4rem", letterSpacing: "-0.02em" }}>
            OpenWaste
          </Typography>
        </Box>
        <Box sx={{ maxWidth: 440, zIndex: 1 }}>
          <Typography sx={{ color: "#fff", fontWeight: 720, fontSize: "2.4rem", lineHeight: 1.15, letterSpacing: "-0.025em" }}>
            {t("signInSubtitle")}
          </Typography>
          <Typography sx={{ color: "#a7f3d0", mt: 2.5, fontSize: "1.05rem", lineHeight: 1.6 }}>
            {t("signInTagline")}
          </Typography>
        </Box>
        <Typography sx={{ color: "rgba(255,255,255,0.6)", fontSize: "0.85rem", zIndex: 1 }}>
          Safi Cleaners and Recyclers
        </Typography>
      </Box>

      <Box sx={{ display: "grid", placeItems: "center", p: 4, bgcolor: "background.default" }}>
        <Box component="form" onSubmit={(e) => void onSubmit(e)} sx={{ width: "100%", maxWidth: 360 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 4 }}>
            <Box
              sx={{
                display: "grid",
                placeItems: "center",
                width: 44,
                height: 44,
                borderRadius: 2.5,
                bgcolor: "#ecfdf5",
              }}
            >
              <BinMark size={28} color="#059669" />
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: "1.15rem", letterSpacing: "-0.01em" }}>
              OpenWaste Intelligence
            </Typography>
          </Box>
          <Typography variant="h4" sx={{ fontSize: "1.6rem" }}>
            {t("login")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3.5 }}>
            {t("signInSubtitle")}
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
          <Button type="submit" variant="contained" size="large" fullWidth sx={{ mt: 3, py: 1.35, fontSize: "1rem" }}>
            {t("login")}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
