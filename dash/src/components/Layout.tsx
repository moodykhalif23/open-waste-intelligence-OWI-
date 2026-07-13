import { useState } from "react";
import {
  Link as RouterLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import LanguageOutlined from "@mui/icons-material/LanguageOutlined";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import MenuOutlined from "@mui/icons-material/MenuOutlined";
import { clearToken } from "../api";
import { useI18n, type Lang } from "../i18n";
import { NAV, locate } from "../nav";

const DRAWER_WIDTH = 232;

function BinMark() {
  return (
    <svg viewBox="0 0 64 64" width="24" height="24" aria-hidden>
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

  const here = locate(location.pathname);
  const barTitle = here ? t(here.entry.key) : t("appName");

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const drawer = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Toolbar sx={{ gap: 1.25, px: 2.5 }} disableGutters>
        <BinMark />
        <Typography sx={{ fontWeight: 700, letterSpacing: "-0.01em" }}>OpenWaste</Typography>
      </Toolbar>
      <List sx={{ flex: 1, py: 1 }}>
        {NAV.map((entry) => (
          <ListItemButton
            key={entry.path}
            component={RouterLink}
            to={entry.path}
            selected={isActive(entry.path)}
            onClick={() => setMobileOpen(false)}
            sx={{ mb: 0.25 }}
          >
            <ListItemIcon sx={{ "& svg": { fontSize: 21 } }}>{entry.icon}</ListItemIcon>
            <ListItemText
              primary={t(entry.key)}
              slotProps={{ primary: { sx: { fontSize: "0.92rem", fontWeight: 570 } } }}
            />
          </ListItemButton>
        ))}
      </List>
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
          <Typography sx={{ flexGrow: 1, fontWeight: 620, fontSize: "0.98rem" }} noWrap>
            {barTitle}
          </Typography>
          <Select
            size="small"
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            aria-label={t("language")}
            startAdornment={<LanguageOutlined sx={{ fontSize: 18, mr: 0.75, color: "text.secondary" }} />}
            sx={{ "& .MuiSelect-select": { py: 0.75 } }}
          >
            <MenuItem value="en">English</MenuItem>
            <MenuItem value="sw">Kiswahili</MenuItem>
          </Select>
          <Tooltip title={t("logout")}>
            <IconButton
              onClick={() => {
                clearToken();
                navigate("/login");
              }}
              aria-label={t("logout")}
            >
              <LogoutOutlined />
            </IconButton>
          </Tooltip>
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
