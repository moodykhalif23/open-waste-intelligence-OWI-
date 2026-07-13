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

const border = "#e7ebf0";

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
    background: { default: "#f7f9f8", paper: "#ffffff" },
    text: { primary: "#0f172a", secondary: "#64748b" },
    divider: border,
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    h1: { fontWeight: 680, letterSpacing: "-0.02em" },
    h2: { fontWeight: 660, letterSpacing: "-0.02em" },
    h4: { fontWeight: 670, letterSpacing: "-0.02em", fontSize: "1.4rem" },
    h5: { fontWeight: 650, letterSpacing: "-0.015em", fontSize: "1.15rem" },
    h6: { fontWeight: 640, letterSpacing: "-0.01em", fontSize: "0.98rem" },
    subtitle2: { fontWeight: 600 },
    body2: { lineHeight: 1.55 },
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
          border: `1px solid ${border}`,
          borderRadius: 4,
          boxShadow: "none",
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          padding: 18,
          "&:last-child": { paddingBottom: 18 },
          [t.breakpoints.up("md")]: {
            padding: 22,
            "&:last-child": { paddingBottom: 22 },
          },
        }),
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: "inherit" },
      styleOverrides: {
        root: {
          backgroundColor: "rgba(255,255,255,0.82)",
          backdropFilter: "saturate(1.1) blur(8px)",
          borderBottom: `1px solid ${border}`,
          color: "#0f172a",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { borderRight: `1px solid ${border}`, backgroundColor: "#ffffff" },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 4, paddingInline: 15 } },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          marginInline: 8,
          paddingBlock: 7,
          "&.Mui-selected": {
            backgroundColor: emerald[50],
            color: emerald[700],
            "&:hover": { backgroundColor: emerald[100] },
            "& .MuiListItemIcon-root": { color: emerald[700] },
          },
        },
      },
    },
    MuiListItemIcon: { styleOverrides: { root: { minWidth: 34, color: "#64748b" } } },
    MuiTable: { defaultProps: { size: "small" } },
    MuiTableCell: {
      styleOverrides: {
        head: {
          color: "#475569",
          fontWeight: 600,
          fontSize: "0.7rem",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          backgroundColor: "#f8fafc",
          whiteSpace: "nowrap",
        },
        root: { borderColor: border, padding: "9px 12px" },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: { "&:hover": { backgroundColor: "#f8fafc" }, "&:last-child td": { borderBottom: 0 } },
      },
    },
    MuiTextField: { defaultProps: { size: "small" } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 4 } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 4, fontWeight: 600 } } },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 40 },
        indicator: { display: "none" },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 34,
          minWidth: 0,
          padding: "6px 14px",
          borderRadius: 4,
          textTransform: "none",
          fontWeight: 600,
          fontSize: "0.86rem",
          color: "#64748b",
          "&.Mui-selected": { color: emerald[700], backgroundColor: emerald[50] },
        },
      },
    },
  },
});

export default theme;
