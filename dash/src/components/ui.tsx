import type { ReactNode } from "react";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";

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
  title?: ReactNode;
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
        {title != null && (typeof title === "string" ? <Typography variant="h4">{title}</Typography> : title)}
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: title != null ? 0.5 : 0, maxWidth: 620 }}>
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
  collapsible,
  defaultExpanded,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  flush?: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  children: ReactNode;
}) {
  if (collapsible) {
    return (
      <Accordion
        defaultExpanded={defaultExpanded}
        disableGutters
        elevation={0}
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "4px",
          bgcolor: "background.paper",
          "&:before": { display: "none" },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreOutlined />} sx={{ px: { xs: 2, md: 2.75 } }}>
          {typeof title === "string" ? <Typography variant="h6">{title}</Typography> : title}
        </AccordionSummary>
        <AccordionDetails sx={{ px: { xs: 2, md: 2.75 }, pt: 0, pb: 2.5 }}>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {subtitle}
            </Typography>
          )}
          {children}
        </AccordionDetails>
      </Accordion>
    );
  }
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

// A table section with NO paper card — just a heading row + the content. The
// DataGrid carries its own border, so wrapping it in a Card is redundant chrome.
export function TableSection({
  title,
  action,
  children,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box>
      {(title || action) && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            mb: 1.5,
            flexWrap: "wrap",
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
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
          <Typography
            variant="overline"
            sx={{ color: "text.secondary", fontSize: "0.68rem", lineHeight: 1.4, letterSpacing: "0.06em" }}
          >
            {label}
          </Typography>
          {icon && (
            <Box
              sx={{
                display: "grid",
                placeItems: "center",
                width: 28,
                height: 28,
                borderRadius: "4px",
                flexShrink: 0,
                bgcolor: "#fbeecf",
                color: "#835a09",
                "& svg": { fontSize: 17 },
              }}
            >
              {icon}
            </Box>
          )}
        </Box>
        <Typography
          sx={{
            fontWeight: 720,
            letterSpacing: "-0.02em",
            fontSize: "1.5rem",
            lineHeight: 1.1,
            mt: 0.5,
            fontVariantNumeric: "tabular-nums",
            color,
          }}
        >
          {value}
        </Typography>
        {sub && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
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

// Loading placeholders mirror the loaded layout, so nothing shifts when data lands.
const SKELETON_SX = { bgcolor: "#f0ede5" };

export function StatRowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Grid container spacing={{ xs: 2, md: 2.5 }}>
      {Array.from({ length: count }, (_, i) => (
        <Grid size={{ xs: 12, sm: 12 / count }} key={i}>
          <Card>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Skeleton animation="wave" width="45%" sx={SKELETON_SX} />
              <Skeleton animation="wave" width="30%" height={34} sx={SKELETON_SX} />
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: "4px", p: 2 }}>
      <Skeleton animation="wave" width="35%" height={28} sx={SKELETON_SX} />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton animation="wave" height={36} sx={SKELETON_SX} key={i} />
      ))}
    </Box>
  );
}

export function PageSkeleton() {
  return (
    <Stack spacing={{ xs: 2, md: 2.5 }}>
      <StatRowSkeleton />
      <TableSkeleton />
    </Stack>
  );
}

// Empty states carry the next action, not just the absence of data — a fresh
// deploy is ALL empty states, so they are the first-run experience.
export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Stack spacing={1.25} sx={{ alignItems: "center", textAlign: "center", py: 5 }}>
      {icon && (
        <Box
          sx={{
            display: "grid",
            placeItems: "center",
            width: 56,
            height: 56,
            borderRadius: "4px",
            bgcolor: "#fbeecf",
            color: "#835a09",
            "& svg": { fontSize: 30 },
          }}
        >
          {icon}
        </Box>
      )}
      <Typography variant="h6">{title}</Typography>
      {hint && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
          {hint}
        </Typography>
      )}
      {action && <Box sx={{ mt: 0.75 }}>{action}</Box>}
    </Stack>
  );
}

export function ErrorPanel({ message, onRetry, retryLabel }: {
  message: ReactNode;
  onRetry: () => void;
  retryLabel: string;
}) {
  return (
    <Alert
      severity="error"
      variant="outlined"
      action={
        <Button color="inherit" size="small" onClick={onRetry}>
          {retryLabel}
        </Button>
      }
    >
      {message}
    </Alert>
  );
}
