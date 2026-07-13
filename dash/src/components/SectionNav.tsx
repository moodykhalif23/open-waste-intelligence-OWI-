import { Link as RouterLink, Outlet, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { PageHeader } from "./ui";
import { useI18n, type StringKey } from "../i18n";
import type { NavLeaf } from "../nav";

// In-content submenu for a grouped section (Intelligence / Records / Admin).
// The sidebar shows one entry; the sub-pages live here as a segmented tab bar
// so the rail stays light. Tabs are real router links (deep-linkable).
export default function SectionNav({
  description,
  items,
}: {
  description?: StringKey;
  items: NavLeaf[];
}) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const active = items.find((i) => pathname.startsWith(i.path))?.path ?? items[0]?.path;

  return (
    <Box>
      {description && <PageHeader description={t(description)} />}
      <Box
        sx={{
          mt: 2,
          mb: { xs: 2, md: 2.5 },
          overflowX: "auto",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Tabs value={active} variant="scrollable" scrollButtons={false} sx={{ minHeight: 40 }}>
          {items.map((item) => (
            <Tab
              key={item.path}
              value={item.path}
              label={t(item.key)}
              component={RouterLink}
              to={item.path}
            />
          ))}
        </Tabs>
      </Box>
      <Outlet />
    </Box>
  );
}
