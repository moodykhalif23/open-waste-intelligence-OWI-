import { useState, type ReactNode } from "react";
import {
  Link as RouterLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import PlaylistAddCheckOutlined from "@mui/icons-material/PlaylistAddCheckOutlined";
import AltRouteOutlined from "@mui/icons-material/AltRouteOutlined";
import PieChartOutlineOutlined from "@mui/icons-material/PieChartOutlineOutlined";
import RecyclingOutlined from "@mui/icons-material/RecyclingOutlined";
import EnergySavingsLeafOutlined from "@mui/icons-material/EnergySavingsLeafOutlined";
import CleaningServicesOutlined from "@mui/icons-material/CleaningServicesOutlined";
import WarningAmberOutlined from "@mui/icons-material/WarningAmberOutlined";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import ArticleOutlined from "@mui/icons-material/ArticleOutlined";
import FactCheckOutlined from "@mui/icons-material/FactCheckOutlined";
import VolunteerActivismOutlined from "@mui/icons-material/VolunteerActivismOutlined";
import ManageAccountsOutlined from "@mui/icons-material/ManageAccountsOutlined";
import PublicOutlined from "@mui/icons-material/PublicOutlined";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import MenuOutlined from "@mui/icons-material/MenuOutlined";
import { clearToken } from "../api";
import { useI18n, type Lang, type StringKey } from "../i18n";

const DRAWER_WIDTH = 260;

interface NavItem {
  to: string;
  key: StringKey;
  icon: ReactNode;
}
interface NavGroup {
  label: StringKey;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    label: "navOperations",
    items: [
      { to: "/", key: "overview", icon: <DashboardOutlined fontSize="small" /> },
      { to: "/collect", key: "collectToday", icon: <PlaylistAddCheckOutlined fontSize="small" /> },
      { to: "/routes", key: "routes", icon: <AltRouteOutlined fontSize="small" /> },
    ],
  },
  {
    label: "navIntelligence",
    items: [
      { to: "/composition", key: "composition", icon: <PieChartOutlineOutlined fontSize="small" /> },
      { to: "/recycling", key: "recycling", icon: <RecyclingOutlined fontSize="small" /> },
      { to: "/carbon", key: "carbon", icon: <EnergySavingsLeafOutlined fontSize="small" /> },
      { to: "/cleanliness", key: "cleanliness", icon: <CleaningServicesOutlined fontSize="small" /> },
      { to: "/dumping", key: "dumping", icon: <WarningAmberOutlined fontSize="small" /> },
    ],
  },
  {
    label: "navRecords",
    items: [
      { to: "/bins", key: "bins", icon: <DeleteOutlineOutlined fontSize="small" /> },
      { to: "/reports", key: "reports", icon: <ArticleOutlined fontSize="small" /> },
      { to: "/review", key: "review", icon: <FactCheckOutlined fontSize="small" /> },
      { to: "/volunteers", key: "volunteers", icon: <VolunteerActivismOutlined fontSize="small" /> },
    ],
  },
  {
    label: "navAdmin",
    items: [
      { to: "/users", key: "users", icon: <ManageAccountsOutlined fontSize="small" /> },
      { to: "/open-data", key: "openData", icon: <PublicOutlined fontSize="small" /> },
    ],
  },
];

const TITLES: Record<string, StringKey> = {
  "/": "overview",
  "/collect": "collectToday",
  "/routes": "routes",
  "/composition": "composition",
  "/recycling": "recycling",
  "/carbon": "carbon",
  "/cleanliness": "cleanliness",
  "/dumping": "dumping",
  "/bins": "bins",
  "/reports": "reports",
  "/review": "review",
  "/volunteers": "volunteers",
  "/users": "users",
  "/open-data": "openData",
};

function BinMark() {
  return (
    <svg viewBox="0 0 64 64" width="26" height="26" aria-hidden>
      <path d="M22 26h20l-2 24a3 3 0 0 1-3 2.7H27a3 3 0 0 1-3-2.7z" fill="#059669" />
      <rect x="20" y="22" width="24" height="4" rx="2" fill="#059669" />
      <rect x="28" y="17" width="8" height="4" rx="2" fill="#059669" />
    </svg>
  );
}

export default function Layout() {
  const { lang, setLang, t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const title = TITLES[location.pathname] ?? "appName";

  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  const drawer = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Toolbar sx={{ gap: 1.25, px: 2.5 }}>
        <BinMark />
        <Typography sx={{ fontWeight: 680, letterSpacing: "-0.01em" }}>OpenWaste</Typography>
      </Toolbar>
      <Box sx={{ flex: 1, overflowY: "auto", pb: 2 }}>
        {NAV.map((group) => (
          <List
            key={group.label}
            dense
            subheader={
              <ListSubheader
                disableSticky
                sx={{
                  bgcolor: "transparent",
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  color: "text.secondary",
                  lineHeight: 2.6,
                }}
              >
                {t(group.label)}
              </ListSubheader>
            }
          >
            {group.items.map((item) => (
              <ListItemButton
                key={item.to}
                component={RouterLink}
                to={item.to}
                selected={isActive(item.to)}
                onClick={() => setMobileOpen(false)}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={t(item.key)}
                  slotProps={{ primary: { sx: { fontSize: "0.9rem", fontWeight: 550 } } }}
                />
              </ListItemButton>
            ))}
          </List>
        ))}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh", bgcolor: "background.default" }}>
      <AppBar position="fixed" sx={{ width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, ml: { md: `${DRAWER_WIDTH}px` } }}>
        <Toolbar sx={{ gap: 1 }}>
          <IconButton
            edge="start"
            onClick={() => setMobileOpen((v) => !v)}
            sx={{ display: { md: "none" } }}
            aria-label="menu"
          >
            <MenuOutlined />
          </IconButton>
          <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
            {t(title)}
          </Typography>
          <Select
            size="small"
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            aria-label={t("language")}
            sx={{ minWidth: 116 }}
          >
            <MenuItem value="en">English</MenuItem>
            <MenuItem value="sw">Kiswahili</MenuItem>
          </Select>
          <Button
            color="inherit"
            startIcon={<LogoutOutlined />}
            onClick={() => {
              clearToken();
              navigate("/login");
            }}
          >
            {t("logout")}
          </Button>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, minWidth: 0 }}>
        <Toolbar />
        <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4.5 } }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}
