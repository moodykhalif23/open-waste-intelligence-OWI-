import { createTheme } from "@mui/material/styles";

// Mimosa: ink primary + mimosa gold accent + warm neutrals. Flat, no gradients.
// Tuned for one-handed field use - large touch targets, calm surfaces.
const ink = { 50: "#eceef1", 100: "#dfe2e8", 500: "#3a4256", 600: "#101828", 700: "#05070c" };

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: ink[600], light: ink[500], dark: ink[700], contrastText: "#fff" },
    secondary: { main: "#f2b949", dark: "#835a09", light: "#f7ce77", contrastText: "#3a2a05" },
    success: { main: "#0e7a55" },
    warning: { main: "#b4791a" },
    error: { main: "#c0392b" },
    background: { default: "#f8f6f0", paper: "#ffffff" },
    text: { primary: "#201a10", secondary: "#6b6456" },
    divider: "#eae6dd",
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontSize: 15,
    fontWeightRegular: 460,
    fontWeightMedium: 600,
    h6: { fontWeight: 720, letterSpacing: "-0.01em", fontSize: "1.2rem" },
    body1: { fontWeight: 470 },
    body2: { fontWeight: 470, lineHeight: 1.6 },
    button: { textTransform: "none", fontWeight: 680 },
  },
  components: {
    MuiCssBaseline: { styleOverrides: { body: { WebkitFontSmoothing: "antialiased" } } },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { border: "1px solid #eae6dd", borderRadius: 4 } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 4, minHeight: 48, paddingInline: 18 } },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: "inherit" },
      styleOverrides: {
        root: { backgroundColor: "#ffffff", borderBottom: "1px solid #eae6dd", color: "#201a10" },
      },
    },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 4 } } },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          textTransform: "none",
          fontWeight: 550,
          "&.Mui-selected": {
            backgroundColor: ink[600],
            color: "#fff",
            "&:hover": { backgroundColor: ink[700] },
          },
        },
      },
    },
  },
});

export default theme;
