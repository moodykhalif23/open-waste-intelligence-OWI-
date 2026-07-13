import { createTheme } from "@mui/material/styles";

// Mimosa: ink primary (actions) + mimosa gold accent + warm neutrals. Flat,
// solid fills and soft tints, never gradients.
const ink = {
  50: "#eceef1",
  100: "#dfe2e8",
  200: "#c2c7d0",
  500: "#3a4256",
  600: "#101828",
  700: "#05070c",
  800: "#05070c",
};

const border = "#eae6dd";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: ink[600],
      light: ink[500],
      dark: ink[700],
      contrastText: "#ffffff",
    },
    secondary: { main: "#f2b949", dark: "#835a09", light: "#f7ce77", contrastText: "#3a2a05" },
    success: { main: "#0e7a55" },
    warning: { main: "#b4791a" },
    error: { main: "#c0392b" },
    background: { default: "#f8f6f0", paper: "#ffffff" },
    text: { primary: "#201a10", secondary: "#6b6456" },
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
          color: "#201a10",
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
            backgroundColor: "#fbeecf",
            color: "#835a09",
            "&:hover": { backgroundColor: "#f6e0a8" },
            "& .MuiListItemIcon-root": { color: "#835a09" },
          },
        },
      },
    },
    MuiListItemIcon: { styleOverrides: { root: { minWidth: 34, color: "#6b6456" } } },
    MuiTable: { defaultProps: { size: "small" } },
    MuiTableCell: {
      styleOverrides: {
        head: {
          color: "#475569",
          fontWeight: 680,
          fontSize: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          backgroundColor: "#f6f4ee",
          whiteSpace: "nowrap",
        },
        root: { borderColor: border, padding: "13px 16px", fontSize: "0.95rem" },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: { "&:hover": { backgroundColor: "#f6f4ee" }, "&:last-child td": { borderBottom: 0 } },
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
          color: "#6b6456",
          "&.Mui-selected": { color: "#835a09", backgroundColor: "#fbeecf" },
        },
      },
    },
  },
});

export default theme;
