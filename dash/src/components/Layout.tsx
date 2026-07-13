import { useEffect, useState } from "react";
import {
  Link as RouterLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AccountCircleOutlined from "@mui/icons-material/AccountCircleOutlined";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import LanguageOutlined from "@mui/icons-material/LanguageOutlined";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import MenuOutlined from "@mui/icons-material/MenuOutlined";
import NotificationsNoneOutlined from "@mui/icons-material/NotificationsNoneOutlined";
import { api, clearToken } from "../api";
import NavSearch from "./NavSearch";
import { useI18n, type Lang } from "../i18n";
import { NAV, locate } from "../nav";

const DRAWER_WIDTH = 232;

function BinMark() {
  // Same mark as the favicon (public/icon.svg) so the brand reads consistently.
  return <Box component="img" src="/icon.svg" alt="OpenWaste" sx={{ width: 36, height: 36, display: "block" }} />;
}

export default function Layout() {
  const { lang, setLang, t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [acct, setAcct] = useState<null | HTMLElement>(null);
  const [alerts, setAlerts] = useState(0);

  const here = locate(location.pathname);
  const barTitle = here ? t(here.entry.key) : t("appName");

  useEffect(() => {
    void api<{ unreviewed: number }>("/api/v1/predictions")
      .then((r) => setAlerts(r.unreviewed ?? 0))
      .catch(() => setAlerts(0));
  }, [location.pathname]);

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const chooseLang = (next: Lang) => {
    setLang(next);
    setAcct(null);
  };

  const drawer = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Toolbar sx={{ gap: 1.5, px: 2.5, minHeight: { xs: 72 } }} disableGutters>
        <BinMark />
        <Typography sx={{ fontWeight: 760, fontSize: "1.28rem", letterSpacing: "-0.02em" }}>
          OpenWaste
        </Typography>
      </Toolbar>
      <List sx={{ flex: 1, py: 1 }}>
        {NAV.map((entry) => (
          <ListItemButton
            key={entry.path}
            component={RouterLink}
            to={entry.path}
            selected={isActive(entry.path)}
            onClick={() => setMobileOpen(false)}
            sx={{ mb: 0.5 }}
          >
            <ListItemIcon sx={{ "& svg": { fontSize: 23 } }}>{entry.icon}</ListItemIcon>
            <ListItemText
              primary={t(entry.key)}
              slotProps={{ primary: { sx: { fontSize: "1rem", fontWeight: 600 } } }}
            />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh", bgcolor: "background.default" }}>
      <AppBar position="fixed" sx={{ width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, ml: { md: `${DRAWER_WIDTH}px` } }}>
        <Toolbar sx={{ gap: { xs: 1, sm: 2 } }}>
          <IconButton
            edge="start"
            onClick={() => setMobileOpen((v) => !v)}
            sx={{ display: { md: "none" } }}
            aria-label="menu"
          >
            <MenuOutlined />
          </IconButton>
          <Typography sx={{ fontWeight: 680, fontSize: "1.05rem", display: { xs: "none", sm: "block" } }} noWrap>
            {barTitle}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <NavSearch />
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title={t("notifications")}>
            <IconButton onClick={() => navigate("/records/review")} aria-label={t("notifications")}>
              <Badge badgeContent={alerts} color="error" max={99}>
                <NotificationsNoneOutlined />
              </Badge>
            </IconButton>
          </Tooltip>
          <Tooltip title={t("account")}>
            <IconButton edge="end" onClick={(e) => setAcct(e.currentTarget)} aria-label={t("account")}>
              <AccountCircleOutlined />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={acct}
            open={Boolean(acct)}
            onClose={() => setAcct(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <ListSubheader sx={{ bgcolor: "transparent", lineHeight: 2.4, fontSize: "0.72rem" }}>
              <LanguageOutlined sx={{ fontSize: 15, verticalAlign: "-2px", mr: 0.5 }} />
              {t("language")}
            </ListSubheader>
            {(["en", "sw"] as Lang[]).map((code) => (
              <MenuItem key={code} selected={lang === code} onClick={() => chooseLang(code)}>
                <ListItemIcon>{lang === code && <CheckOutlined fontSize="small" />}</ListItemIcon>
                {code === "en" ? "English" : "Kiswahili"}
              </MenuItem>
            ))}
            <Divider />
            <MenuItem
              onClick={() => {
                clearToken();
                navigate("/login");
              }}
            >
              <ListItemIcon>
                <LogoutOutlined fontSize="small" />
              </ListItemIcon>
              {t("logout")}
            </MenuItem>
          </Menu>
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
        <Container maxWidth="xl" sx={{ py: { xs: 2.5, md: 3.5 }, px: { xs: 2, md: 3.5 } }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}
