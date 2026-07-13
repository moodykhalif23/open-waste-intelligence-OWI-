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
    background: { default: "#e6f2ea", paper: "#ffffff" },
    text: { primary: "#0f172a", secondary: "#64748b" },
    divider: border,
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontSize: 15,
    fontWeightRegular: 450,
    fontWeightMedium: 600,
    h1: { fontWeight: 720, letterSpacing: "-0.02em" },
    h2: { fontWeight: 700, letterSpacing: "-0.02em" },
    h4: { fontWeight: 720, letterSpacing: "-0.02em", fontSize: "1.6rem" },
    h5: { fontWeight: 700, letterSpacing: "-0.015em", fontSize: "1.28rem" },
    h6: { fontWeight: 690, letterSpacing: "-0.01em", fontSize: "1.08rem" },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 620 },
    body1: { fontWeight: 460 },
    body2: { fontWeight: 460, lineHeight: 1.6 },
    button: { textTransform: "none", fontWeight: 660 },
    overline: { fontWeight: 640, letterSpacing: "0.08em" },
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
          padding: 22,
          "&:last-child": { paddingBottom: 22 },
          [t.breakpoints.up("md")]: {
            padding: 28,
            "&:last-child": { paddingBottom: 28 },
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
          paddingBlock: 9,
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
          fontWeight: 680,
          fontSize: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          backgroundColor: "#f8fafc",
          whiteSpace: "nowrap",
        },
        root: { borderColor: border, padding: "13px 16px", fontSize: "0.95rem" },
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
