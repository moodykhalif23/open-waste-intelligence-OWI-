import { createTheme } from "@mui/material/styles";

// Emerald, kept flat: solid fills and soft tints, never gradients.
// Tuned for one-handed field use - large touch targets, calm surfaces.
const emerald = { 50: "#ecfdf5", 100: "#d1fae5", 500: "#10b981", 600: "#059669", 700: "#047857" };

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: emerald[600], light: emerald[500], dark: emerald[700], contrastText: "#fff" },
    success: { main: emerald[600] },
    background: { default: "#e6f2ea", paper: "#ffffff" },
    text: { primary: "#0f172a", secondary: "#64748b" },
    divider: "#e8ebf0",
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    h6: { fontWeight: 660, letterSpacing: "-0.01em" },
    button: { textTransform: "none", fontWeight: 640 },
  },
  components: {
    MuiCssBaseline: { styleOverrides: { body: { WebkitFontSmoothing: "antialiased" } } },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { border: "1px solid #e8ebf0", borderRadius: 4 } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 4, minHeight: 48, paddingInline: 18 } },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: "inherit" },
      styleOverrides: {
        root: { backgroundColor: "#ffffff", borderBottom: "1px solid #e8ebf0", color: "#0f172a" },
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
            backgroundColor: emerald[600],
            color: "#fff",
            "&:hover": { backgroundColor: emerald[700] },
          },
        },
      },
    },
  },
});

export default theme;
