import type { ReactNode } from "react";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import PlaylistAddCheckOutlined from "@mui/icons-material/PlaylistAddCheckOutlined";
import AltRouteOutlined from "@mui/icons-material/AltRouteOutlined";
import InsightsOutlined from "@mui/icons-material/InsightsOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import AdminPanelSettingsOutlined from "@mui/icons-material/AdminPanelSettingsOutlined";
import type { StringKey } from "./i18n";

// A leaf destination. `end` marks index-style matching (exact path only).
export interface NavLeaf {
  path: string;
  key: StringKey;
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
      { path: "/intelligence/composition", key: "composition" },
      { path: "/intelligence/recycling", key: "recycling" },
      { path: "/intelligence/carbon", key: "carbon" },
      { path: "/intelligence/cleanliness", key: "cleanliness" },
      { path: "/intelligence/dumping", key: "dumping" },
    ],
  },
  {
    path: "/records",
    key: "navRecords",
    icon: <Inventory2Outlined />,
    children: [
      { path: "/records/bins", key: "bins" },
      { path: "/records/reports", key: "reports" },
      { path: "/records/review", key: "review" },
      { path: "/records/volunteers", key: "volunteers" },
    ],
  },
  {
    path: "/admin",
    key: "navAdmin",
    icon: <AdminPanelSettingsOutlined />,
    children: [
      { path: "/admin/users", key: "users" },
      { path: "/admin/open-data", key: "openData" },
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
