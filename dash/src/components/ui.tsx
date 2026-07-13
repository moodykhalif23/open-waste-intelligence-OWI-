import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

// Vertical rhythm for a page - Layout already provides the padded container.
export function PageStack({ children }: { children: ReactNode }) {
  return <Stack spacing={{ xs: 2, md: 2.5 }}>{children}</Stack>;
}

// Top-of-page title block: headline, optional caption, optional right action.
// Use once per page so the AppBar stays a thin utility strip.
export function PageHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 2,
        flexWrap: "wrap",
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        {typeof title === "string" ? <Typography variant="h4">{title}</Typography> : title}
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 620 }}>
            {description}
          </Typography>
        )}
      </Box>
      {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
    </Box>
  );
}

// A titled card with an optional right-aligned action (button, filter, badge).
// `flush` drops the card chrome (border/shadow/padding) so it can be nested
// inside another card without doubling borders and padding.
export function SectionCard({
  title,
  subtitle,
  action,
  flush,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  flush?: boolean;
  children: ReactNode;
}) {
  const header = (title || action) && (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
        mb: subtitle ? 0.5 : 2,
      }}
    >
      {typeof title === "string" ? <Typography variant="h6">{title}</Typography> : title}
      {action}
    </Box>
  );
  const body = (
    <>
      {header}
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {subtitle}
        </Typography>
      )}
      {children}
    </>
  );
  if (flush) return <Box>{body}</Box>;
  return (
    <Card>
      <CardContent>{body}</CardContent>
    </Card>
  );
}

// A light bordered surface for grouping content inside a card (no shadow).
export function Panel({
  title,
  action,
  children,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "4px",
        p: { xs: 1.75, md: 2 },
        bgcolor: "background.paper",
      }}
    >
      {(title || action) && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1.5,
            mb: 1.5,
          }}
        >
          {typeof title === "string" ? <Typography variant="h6">{title}</Typography> : title}
          {action}
        </Box>
      )}
      {children}
    </Box>
  );
}

// A big headline number with a caption - the stat tile. Optional icon accent
// and sub line. Flat: a soft tinted icon chip, never a gradient.
export function StatCard({
  label,
  value,
  color,
  icon,
  sub,
}: {
  label: string;
  value: ReactNode;
  color?: string;
  icon?: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontWeight: 720,
                letterSpacing: "-0.02em",
                fontSize: "1.95rem",
                lineHeight: 1.05,
                color,
              }}
            >
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {label}
            </Typography>
          </Box>
          {icon && (
            <Box
              sx={{
                display: "grid",
                placeItems: "center",
                width: 38,
                height: 38,
                borderRadius: "4px",
                flexShrink: 0,
                bgcolor: "#ecfdf5",
                color: "primary.main",
                "& svg": { fontSize: 20 },
              }}
            >
              {icon}
            </Box>
          )}
        </Box>
        {sub && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {sub}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return (
    <Typography variant="body2" color="text.secondary">
      {children}
    </Typography>
  );
}
