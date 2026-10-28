import { createTheme } from "@mui/material/styles";
import type {} from "@mui/x-data-grid/themeAugmentation";

// Mimosa: ink primary (actions) + mimosa gold accent + warm neutrals. Flat,
// solid fills and soft tints, never gradients. Inter Variable is self-hosted,
// so the fractional weights below render exactly as specified on every OS.
export const owi = {
  ink: "#101828",
  inkSoft: "#3a4256",
  inkDeep: "#05070c",
  muted: "#6b6456",
  faint: "#8a8f9b",
  line: "#eae6dd",
  rule: "#f1eee7",
  stroke: "#cfc9bc",
  paper: "#f8f6f0",
  wash: "#f6f4ee",
  well: "#efece4",
  gold: "#f2b949",
  goldTint: "#fbeecf",
  brown: "#835a09",
  bad: "#c0392b",
  badTint: "#fbe9e7",
  badLine: "#f0c4be",
  ok: "#0e7a55",
  okTint: "#e8f4ee",
  okLine: "#c4e2d4",
  warn: "#b4791a",
  goldLine: "#f0dcae",
} as const;

const FONT = '"Inter Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
// One easing + two durations everywhere: fast state changes read as responsiveness.
const EASE = "cubic-bezier(0.2, 0, 0, 1)";
const HOVER = `background-color 120ms ${EASE}, border-color 120ms ${EASE}, color 120ms ${EASE}, box-shadow 120ms ${EASE}`;
const CARD_RADIUS = 14;
const RADIUS = 10;

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: owi.ink,
      light: owi.inkSoft,
      dark: owi.inkDeep,
      contrastText: "#ffffff",
    },
    secondary: { main: owi.gold, dark: owi.brown, light: "#f7ce77", contrastText: "#3a2a05" },
    success: { main: owi.ok },
    warning: { main: owi.warn },
    error: { main: owi.bad },
    background: { default: owi.paper, paper: "#ffffff" },
    text: { primary: owi.ink, secondary: owi.muted },
    divider: owi.line,
  },
  shape: { borderRadius: RADIUS },
  typography: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeightRegular: 450,
    fontWeightMedium: 600,
    h4: { fontWeight: 740, letterSpacing: "-0.02em", fontSize: "1.6rem" },
    h5: { fontWeight: 720, letterSpacing: "-0.015em", fontSize: "1.3rem" },
    h6: { fontWeight: 700, letterSpacing: "-0.01em", fontSize: "1.04rem" },
    subtitle2: { fontWeight: 620 },
    body1: { fontWeight: 460 },
    body2: { fontWeight: 460, lineHeight: 1.6 },
    button: { textTransform: "none", fontWeight: 650 },
    overline: { fontWeight: 700, letterSpacing: "0.08em", fontSize: "0.7rem", lineHeight: 1.5 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { WebkitFontSmoothing: "antialiased", textRendering: "optimizeLegibility" },
        "::selection": { backgroundColor: owi.goldTint, color: "#3a2a05" },
        ":focus-visible": {
          outline: `2px solid ${owi.gold}`,
          outlineOffset: "2px",
          borderRadius: "4px",
        },
        "*::-webkit-scrollbar": { width: 10, height: 10 },
        "*::-webkit-scrollbar-thumb": {
          backgroundColor: "#d9d3c7",
          borderRadius: 5,
          border: "2px solid transparent",
          backgroundClip: "content-box",
        },
        "*": { scrollbarWidth: "thin", scrollbarColor: "#d9d3c7 transparent" },
        "@keyframes owiPageIn": {
          from: { opacity: 0, transform: "translateY(4px)" },
          to: { opacity: 1, transform: "none" },
        },
        "@media (prefers-reduced-motion: reduce)": {
          "*, *::before, *::after": {
            animationDuration: "0.01ms !important",
            transitionDuration: "0.01ms !important",
          },
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { rounded: { borderRadius: CARD_RADIUS } },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: `1px solid ${owi.line}`,
          borderRadius: CARD_RADIUS,
          boxShadow: "none",
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          padding: 20,
          "&:last-child": { paddingBottom: 20 },
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
          backgroundColor: "#ffffff",
          borderBottom: `1px solid ${owi.line}`,
          color: owi.ink,
          borderRadius: 0,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { borderRight: `1px solid ${owi.line}`, backgroundColor: "#ffffff", borderRadius: 0 },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          border: `1px solid ${owi.line}`,
          borderRadius: 12,
          boxShadow: "0 12px 32px rgba(16,24,40,0.10)",
        },
      },
    },
    MuiPopover: { styleOverrides: { paper: { borderRadius: 12 } } },
    MuiAutocomplete: {
      styleOverrides: {
        paper: {
          border: `1px solid ${owi.line}`,
          borderRadius: 12,
          boxShadow: "0 12px 32px rgba(16,24,40,0.10)",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 16, boxShadow: "0 24px 64px rgba(16,24,40,0.18)" },
      },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { fontWeight: 720, fontSize: "1.15rem", letterSpacing: "-0.01em" } },
    },
    MuiDialogContent: {
      styleOverrides: { dividers: { borderColor: owi.rule } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: RADIUS,
          paddingInline: 16,
          whiteSpace: "nowrap",
          transition: HOVER,
          "&:active": { transform: "scale(0.985)" },
        },
        outlined: {
          "&.MuiButton-colorPrimary": {
            borderColor: owi.stroke,
            color: owi.ink,
            backgroundColor: "#ffffff",
            "&:hover": { borderColor: owi.ink, backgroundColor: owi.wash },
          },
        },
        sizeSmall: { paddingInline: 12, fontSize: "0.84rem" },
      },
    },
    MuiIconButton: { styleOverrides: { root: { transition: HOVER } } },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: RADIUS,
          marginInline: 10,
          paddingBlock: 8,
          transition: HOVER,
          "&.Mui-selected": {
            backgroundColor: owi.goldTint,
            color: owi.brown,
            "&:hover": { backgroundColor: "#f6e0a8" },
            "& .MuiListItemIcon-root": { color: owi.brown },
          },
        },
      },
    },
    MuiListItemIcon: { styleOverrides: { root: { minWidth: 36, color: owi.faint } } },
    MuiTable: { defaultProps: { size: "small" } },
    MuiTableCell: {
      styleOverrides: {
        head: {
          color: owi.muted,
          fontWeight: 700,
          fontSize: "0.72rem",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          backgroundColor: "transparent",
          whiteSpace: "nowrap",
        },
        root: {
          borderColor: owi.rule,
          padding: "12px 16px",
          fontSize: "0.92rem",
          color: owi.inkSoft,
          fontVariantNumeric: "tabular-nums",
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: "background-color 100ms linear",
          "&:hover": { backgroundColor: "#faf8f3" },
          "&:last-child td": { borderBottom: 0 },
        },
      },
    },
    MuiTextField: { defaultProps: { size: "small" } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: RADIUS,
          backgroundColor: "#ffffff",
          "& .MuiOutlinedInput-notchedOutline": { borderColor: owi.line },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: owi.stroke },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: owi.ink, borderWidth: 1.5 },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 620,
          fontVariantNumeric: "tabular-nums",
        },
        outlined: { borderColor: owi.line, color: owi.inkSoft },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          alignItems: "center",
          "&.MuiAlert-standard.MuiAlert-colorInfo": {
            backgroundColor: owi.wash,
            color: owi.inkSoft,
            "& .MuiAlert-icon": { color: owi.muted },
          },
          "&.MuiAlert-standard.MuiAlert-colorWarning": {
            backgroundColor: owi.goldTint,
            color: "#5c3f06",
            "& .MuiAlert-icon": { color: owi.brown },
          },
          "&.MuiAlert-standard.MuiAlert-colorSuccess": {
            backgroundColor: owi.okTint,
            color: "#0a5a3f",
            "& .MuiAlert-icon": { color: owi.ok },
          },
          "&.MuiAlert-standard.MuiAlert-colorError": {
            backgroundColor: owi.badTint,
            color: "#8f2a1f",
            "& .MuiAlert-icon": { color: owi.bad },
          },
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: { borderRadius: CARD_RADIUS, "&.Mui-expanded": { margin: 0 } },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: owi.ink,
          borderRadius: 8,
          fontSize: "0.78rem",
          fontWeight: 560,
          padding: "6px 10px",
        },
      },
    },
    MuiSnackbarContent: {
      styleOverrides: {
        root: { backgroundColor: owi.ink, borderRadius: 12, fontWeight: 560 },
      },
    },
    MuiSkeleton: { styleOverrides: { root: { backgroundColor: "#f0ede5" } } },
    MuiBadge: {
      styleOverrides: { badge: { fontWeight: 700, fontVariantNumeric: "tabular-nums" } },
    },
    MuiLinearProgress: { styleOverrides: { root: { height: 2 } } },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 42 },
        indicator: { height: 2, borderRadius: 2, backgroundColor: owi.gold },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 42,
          minWidth: 0,
          padding: "8px 2px",
          marginRight: 26,
          textTransform: "none",
          fontWeight: 600,
          fontSize: "0.92rem",
          color: owi.muted,
          transition: HOVER,
          "&:hover": { color: owi.ink },
          "&.Mui-selected": { color: owi.ink },
        },
      },
    },
    MuiDataGrid: {
      styleOverrides: {
        root: { fontVariantNumeric: "tabular-nums" },
        cell: {
          "&:focus, &:focus-within": { outline: "none" },
          "&:focus-visible": { outline: `2px solid ${owi.gold}`, outlineOffset: "-2px" },
        },
        columnHeader: {
          "&:focus, &:focus-within": { outline: "none" },
          "&:focus-visible": { outline: `2px solid ${owi.gold}`, outlineOffset: "-2px" },
        },
      },
    },
  },
});

export default theme;
