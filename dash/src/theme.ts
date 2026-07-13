import { createTheme } from "@mui/material/styles";

// Emerald, kept flat: solid fills and soft tints, never gradients.
const emerald = {
  50: "#ecfdf5",
  100: "#d1fae5",
  200: "#a7f3d0",
  500: "#10b981",
  600: "#059669",
  700: "#047857",
  800: "#065f46",
};

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: emerald[600],
      light: emerald[500],
      dark: emerald[700],
      contrastText: "#ffffff",
    },
    success: { main: emerald[600] },
    background: { default: "#f6f8f7", paper: "#ffffff" },
    text: { primary: "#0f172a", secondary: "#64748b" },
    divider: "#e8ebf0",
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    h1: { fontWeight: 680, letterSpacing: "-0.02em" },
    h2: { fontWeight: 660, letterSpacing: "-0.02em" },
    h4: { fontWeight: 660, letterSpacing: "-0.02em", fontSize: "1.5rem" },
    h5: { fontWeight: 650, letterSpacing: "-0.015em", fontSize: "1.2rem" },
    h6: { fontWeight: 640, letterSpacing: "-0.01em", fontSize: "1rem" },
    subtitle2: { fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 620 },
    overline: { fontWeight: 600, letterSpacing: "0.08em" },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { WebkitFontSmoothing: "antialiased" },
      },
    },
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: "1px solid #e8ebf0",
          borderRadius: 16,
          boxShadow: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.03)",
        },
      },
    },
    MuiCardContent: {
      styleOverrides: { root: { padding: 24, "&:last-child": { paddingBottom: 24 } } },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: "inherit" },
      styleOverrides: {
        root: {
          backgroundColor: "rgba(255,255,255,0.85)",
          backdropFilter: "saturate(1.1) blur(8px)",
          borderBottom: "1px solid #e8ebf0",
          color: "#0f172a",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { borderRight: "1px solid #e8ebf0", backgroundColor: "#ffffff" },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 10, paddingInline: 16 } },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          marginInline: 8,
          "&.Mui-selected": {
            backgroundColor: emerald[50],
            color: emerald[700],
            "&:hover": { backgroundColor: emerald[100] },
            "& .MuiListItemIcon-root": { color: emerald[700] },
          },
        },
      },
    },
    MuiListItemIcon: { styleOverrides: { root: { minWidth: 36, color: "#64748b" } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiTableCell: {
      styleOverrides: {
        head: {
          color: "#64748b",
          fontWeight: 600,
          fontSize: "0.72rem",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        },
        root: { borderColor: "#e8ebf0" },
      },
    },
    MuiTextField: { defaultProps: { size: "small" } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 10 } } },
  },
});

export default theme;
