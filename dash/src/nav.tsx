import type { ReactElement, ReactNode } from "react";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import PlaylistAddCheckOutlined from "@mui/icons-material/PlaylistAddCheckOutlined";
import AltRouteOutlined from "@mui/icons-material/AltRouteOutlined";
import InsightsOutlined from "@mui/icons-material/InsightsOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import AdminPanelSettingsOutlined from "@mui/icons-material/AdminPanelSettingsOutlined";
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
import type { StringKey } from "./i18n";

// A leaf destination. `end` marks index-style matching (exact path only).
export interface NavLeaf {
  path: string;
  key: StringKey;
  icon?: ReactElement;
  end?: boolean;
}

// A top-level sidebar entry. When `children` is set, the entry is a grouped
// section: the sidebar shows one item and the sub-pages become an in-content
// tab bar (see SectionNav) instead of crowding the rail.
export interface NavEntry {
  path: string;
  key: StringKey;
  icon: ReactNode;
  children?: NavLeaf[];
}

export const NAV: NavEntry[] = [
  { path: "/", key: "overview", icon: <DashboardOutlined />, },
  { path: "/collect", key: "collectToday", icon: <PlaylistAddCheckOutlined /> },
  { path: "/routes", key: "routes", icon: <AltRouteOutlined /> },
  {
    path: "/intelligence",
    key: "navIntelligence",
    icon: <InsightsOutlined />,
    children: [
      { path: "/intelligence/composition", key: "composition", icon: <PieChartOutlineOutlined fontSize="small" /> },
      { path: "/intelligence/recycling", key: "recycling", icon: <RecyclingOutlined fontSize="small" /> },
      { path: "/intelligence/carbon", key: "carbon", icon: <EnergySavingsLeafOutlined fontSize="small" /> },
      { path: "/intelligence/cleanliness", key: "cleanliness", icon: <CleaningServicesOutlined fontSize="small" /> },
      { path: "/intelligence/dumping", key: "dumping", icon: <WarningAmberOutlined fontSize="small" /> },
    ],
  },
  {
    path: "/records",
    key: "navRecords",
    icon: <Inventory2Outlined />,
    children: [
      { path: "/records/bins", key: "bins", icon: <DeleteOutlineOutlined fontSize="small" /> },
      { path: "/records/reports", key: "reports", icon: <ArticleOutlined fontSize="small" /> },
      { path: "/records/review", key: "review", icon: <FactCheckOutlined fontSize="small" /> },
      { path: "/records/volunteers", key: "volunteers", icon: <VolunteerActivismOutlined fontSize="small" /> },
    ],
  },
  {
    path: "/admin",
    key: "navAdmin",
    icon: <AdminPanelSettingsOutlined />,
    children: [
      { path: "/admin/users", key: "users", icon: <ManageAccountsOutlined fontSize="small" /> },
      { path: "/admin/open-data", key: "openData", icon: <PublicOutlined fontSize="small" /> },
    ],
  },
];

// Old flat URLs kept working so bookmarks and in-app links don't 404.
export const LEGACY_REDIRECTS: Record<string, string> = {
  "/composition": "/intelligence/composition",
  "/recycling": "/intelligence/recycling",
  "/carbon": "/intelligence/carbon",
  "/cleanliness": "/intelligence/cleanliness",
  "/dumping": "/intelligence/dumping",
  "/bins": "/records/bins",
  "/reports": "/records/reports",
  "/review": "/records/review",
  "/volunteers": "/records/volunteers",
  "/users": "/admin/users",
  "/open-data": "/admin/open-data",
};

// Resolve the current pathname to { section, leaf } for headers and titles.
export function locate(pathname: string): { entry: NavEntry; leaf?: NavLeaf } | null {
  for (const entry of NAV) {
    if (entry.children) {
      const leaf = entry.children.find((c) => pathname.startsWith(c.path));
      if (leaf || pathname === entry.path) return { entry, leaf };
    } else if (entry.path === "/" ? pathname === "/" : pathname.startsWith(entry.path)) {
      return { entry };
    }
  }
  return null;
}
