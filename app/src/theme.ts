import { createTheme } from "@mui/material/styles";

// Mimosa: ink primary + mimosa gold accent + warm neutrals. Flat, no gradients.
// Tuned for one-handed field use - large touch targets, calm surfaces.
// Inter Variable is self-hosted so weights render identically on every phone.
const ink = { 500: "#3a4256", 600: "#101828", 700: "#05070c" };
const EASE = "cubic-bezier(0.2, 0, 0, 1)";
const SPRING = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const HOVER = `background-color 120ms ${EASE}, border-color 120ms ${EASE}, color 120ms ${EASE}`;

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
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: '"Inter Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontSize: 15,
    fontWeightRegular: 460,
    fontWeightMedium: 600,
    h6: { fontWeight: 720, letterSpacing: "-0.01em", fontSize: "1.2rem" },
    body1: { fontWeight: 470 },
    body2: { fontWeight: 470, lineHeight: 1.6 },
    button: { textTransform: "none", fontWeight: 680 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { WebkitFontSmoothing: "antialiased", textRendering: "optimizeLegibility" },
        "::selection": { backgroundColor: "#fbeecf", color: "#3a2a05" },
        ":focus-visible": {
          outline: "2px solid #f2b949",
          outlineOffset: "2px",
          borderRadius: "6px",
        },
        "@keyframes owi-rise": {
          from: { opacity: 0, transform: "translateY(12px) scale(0.985)" },
          to: { opacity: 1, transform: "none" },
        },
        ".rise-stack > *": { animation: `owi-rise 460ms ${SPRING} both` },
        ".rise-stack > *:nth-child(2)": { animationDelay: "50ms" },
        ".rise-stack > *:nth-child(3)": { animationDelay: "100ms" },
        ".rise-stack > *:nth-child(4)": { animationDelay: "150ms" },
        ".rise-stack > *:nth-child(n + 5)": { animationDelay: "200ms" },
        "@media (prefers-reduced-motion: reduce)": {
          "*, *::before, *::after": {
            animationDuration: "0.01ms !important",
            transitionDuration: "0.01ms !important",
          },
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { border: "1px solid #eae6dd", borderRadius: 18 } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 14,
          minHeight: 50,
          paddingInline: 18,
          transition: `${HOVER}, transform 180ms ${SPRING}`,
          "&:active": { transform: "scale(0.97)" },
        },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: "inherit" },
      styleOverrides: {
        root: { backgroundColor: "#ffffff", borderBottom: "1px solid #eae6dd", color: "#201a10" },
      },
    },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 12 } } },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: "none",
          fontWeight: 550,
          transition: `${HOVER}, transform 180ms ${SPRING}`,
          "&:active": { transform: "scale(0.97)" },
          "&.Mui-selected": {
            backgroundColor: ink[600],
            color: "#fff",
            "&:hover": { backgroundColor: ink[700] },
          },
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { rounded: { borderRadius: 18 } },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiIconButton: {
      styleOverrides: {
        root: { transition: `transform 180ms ${SPRING}`, "&:active": { transform: "scale(0.9)" } },
      },
    },
    MuiBottomNavigation: { styleOverrides: { root: { height: 64 } } },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          transition: HOVER,
          "& .MuiSvgIcon-root": { transition: `transform 240ms ${SPRING}` },
          "&.Mui-selected": { fontWeight: 700 },
          "&.Mui-selected .MuiSvgIcon-root": { transform: "translateY(-2px) scale(1.1)" },
        },
      },
    },
  },
});

export default theme;
