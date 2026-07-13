import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

// Vertical rhythm for a page - Layout already provides the padded container.
export function PageStack({ children }: { children: ReactNode }) {
  return <Stack spacing={{ xs: 2.5, md: 3.5 }}>{children}</Stack>;
}

// A titled card with an optional right-aligned action (button, filter, badge).
export function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardContent>
        {(title || action) && (
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 2,
              mb: subtitle ? 0.5 : 2.5,
            }}
          >
            {typeof title === "string" ? <Typography variant="h6">{title}</Typography> : title}
            {action}
          </Box>
        )}
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            {subtitle}
          </Typography>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

// A big headline number with a caption - the stat tile.
export function StatCard({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: ReactNode;
  color?: string;
  sub?: ReactNode;
}) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography
          sx={{ fontWeight: 720, letterSpacing: "-0.02em", fontSize: "2.1rem", lineHeight: 1.05, color }}
        >
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {label}
        </Typography>
        {sub}
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
