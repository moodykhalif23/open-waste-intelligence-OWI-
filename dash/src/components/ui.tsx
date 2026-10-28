import { Fragment, type ReactNode } from "react";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";
import ChevronLeftOutlined from "@mui/icons-material/ChevronLeftOutlined";
import ChevronRightOutlined from "@mui/icons-material/ChevronRightOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import { owi } from "../theme";

export const GAP = { xs: 2, md: 2.5 } as const;

export function PageStack({ children }: { children: ReactNode }) {
  return <Stack spacing={GAP}>{children}</Stack>;
}

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
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
        flexWrap: "wrap",
        minHeight: 36,
      }}
    >
      <Box sx={{ minWidth: 0, flex: "1 1 320px" }}>
        {title != null && (typeof title === "string" ? <Typography variant="h5">{title}</Typography> : title)}
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: title != null ? 0.5 : 0, maxWidth: 680 }}>
            {description}
          </Typography>
        )}
      </Box>
      {action && <Box sx={{ flexShrink: 0, display: "flex", gap: 1.25, alignItems: "center", flexWrap: "wrap" }}>{action}</Box>}
    </Box>
  );
}

export function Kicker({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Typography
      component="span"
      sx={[
        {
          display: "block",
          color: "text.secondary",
          fontSize: "0.7rem",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          lineHeight: 1.5,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Typography>
  );
}

function CardTitle({ title, hint }: { title?: ReactNode; hint?: ReactNode }) {
  if (!title && !hint) return null;
  return (
    <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, minWidth: 0, flexWrap: "wrap" }}>
      {typeof title === "string" ? <Typography variant="h6">{title}</Typography> : title}
      {hint && (
        <Typography component="span" sx={{ color: "text.secondary", fontSize: "0.84rem", fontWeight: 500 }}>
          {hint}
        </Typography>
      )}
    </Box>
  );
}

export function SectionCard({
  title,
  hint,
  subtitle,
  action,
  collapsible,
  children,
}: {
  title?: ReactNode;
  hint?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  collapsible?: boolean;
  children: ReactNode;
}) {
  if (collapsible) {
    return (
      <Accordion
        disableGutters
        elevation={0}
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "14px",
          bgcolor: "background.paper",
          "&:before": { display: "none" },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreOutlined />} sx={{ px: { xs: 2, md: 2.75 }, minHeight: 56 }}>
          <CardTitle title={title} hint={hint} />
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
  const header = (title || action || hint) && (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
        mb: subtitle ? 0.5 : 2,
        minHeight: 32,
      }}
    >
      <CardTitle title={title} hint={hint} />
      {action && <Box sx={{ flexShrink: 0, display: "flex", gap: 1, alignItems: "center" }}>{action}</Box>}
    </Box>
  );
  return (
    <Card sx={{ height: "100%", minWidth: 0 }}>
      <CardContent>
        {header}
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {subtitle}
          </Typography>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

export function TableSection({
  title,
  hint,
  action,
  children,
}: {
  title?: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      {(title || action) && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            mb: 1.5,
            minHeight: 36,
            flexWrap: "wrap",
          }}
        >
          <CardTitle title={title} hint={hint} />
          {action && <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", flexWrap: "wrap" }}>{action}</Box>}
        </Box>
      )}
      {children}
    </Box>
  );
}

export function Panel({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "12px",
        p: { xs: 1.75, md: 2 },
        bgcolor: "background.paper",
      }}
    >
      {children}
    </Box>
  );
}

export function Sparkline({ values, height = 34 }: { values: number[]; height?: number }) {
  if (values.length < 2) return <Box sx={{ height }} />;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / (max - min || 1)) * 24}`)
    .join(" ");
  return (
    <Box
      component="svg"
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      aria-hidden
      sx={{ display: "block", width: "100%", height, overflow: "visible" }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={owi.gold}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </Box>
  );
}

export function StatCard({
  label,
  value,
  color,
  spark,
  caption,
}: {
  label: string;
  value: ReactNode;
  color?: string;
  spark?: number[];
  caption?: ReactNode;
}) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box" }}>
        <Kicker>{label}</Kicker>
        <Typography
          sx={{
            fontWeight: 760,
            letterSpacing: "-0.025em",
            fontSize: { xs: "1.6rem", md: "1.95rem" },
            lineHeight: 1.1,
            mt: 0.75,
            fontVariantNumeric: "tabular-nums",
            overflowWrap: "anywhere",
            color: color ?? "text.primary",
          }}
        >
          {value}
        </Typography>
        {caption && (
          <Typography sx={{ mt: 0.75, color: "text.secondary", fontSize: "0.84rem" }}>{caption}</Typography>
        )}
        {spark && (
          <Box sx={{ mt: "auto", pt: 1.5 }}>
            <Sparkline values={spark} />
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export function StatRow({ children }: { children: ReactNode[] }) {
  const n = children.filter(Boolean).length;
  return (
    <Grid container spacing={GAP}>
      {children.filter(Boolean).map((child, i) => (
        <Grid key={i} size={{ xs: 12, sm: n > 2 ? 6 : 12 / n, md: 12 / n }}>
          {child}
        </Grid>
      ))}
    </Grid>
  );
}

export function InlineStat({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Kicker>{label}</Kicker>
      <Typography
        sx={{
          fontWeight: 740,
          fontSize: "1.6rem",
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
          fontVariantNumeric: "tabular-nums",
          color: color ?? "text.primary",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

export interface Part {
  label: string;
  value: number;
  color?: string;
}

const pct = (v: number, total: number) => (total > 0 ? (v / total) * 100 : 0);

export function StackBar({
  items,
  format = (v) => v.toLocaleString(),
  inline,
}: {
  items: Part[];
  format?: (v: number) => string;
  inline?: boolean;
}) {
  const total = items.reduce((s, i) => s + i.value, 0);
  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          height: 14,
          borderRadius: 999,
          overflow: "hidden",
          bgcolor: owi.well,
          mb: 2.25,
        }}
      >
        {items
          .filter((i) => i.value > 0)
          .map((i) => (
            <Tooltip key={i.label} title={`${i.label} · ${format(i.value)} (${Math.round(pct(i.value, total))}%)`}>
              <Box
                sx={{
                  width: `${pct(i.value, total)}%`,
                  bgcolor: i.color ?? owi.ink,
                  borderRight: "2px solid #ffffff",
                  "&:last-of-type": { borderRight: 0 },
                }}
              />
            </Tooltip>
          ))}
      </Box>
      <Box
        sx={
          inline
            ? { display: "flex", flexWrap: "wrap", columnGap: 4, rowGap: 1 }
            : { display: "flex", flexDirection: "column", gap: 1.1 }
        }
      >
        {items.map((i) => (
          <Box key={i.label} sx={{ display: "flex", alignItems: "center", gap: 1.25, fontSize: "0.92rem" }}>
            <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: i.color ?? owi.ink, flexShrink: 0 }} />
            <Typography sx={{ color: owi.inkSoft, fontSize: "inherit", flex: inline ? "none" : 1, minWidth: 0 }} noWrap>
              {i.label}
            </Typography>
            <Typography sx={{ fontWeight: 660, fontSize: "inherit", fontVariantNumeric: "tabular-nums" }}>
              {format(i.value)}
            </Typography>
            <Typography
              sx={{
                color: "text.secondary",
                fontSize: "0.8rem",
                width: "3.2em",
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {Math.round(pct(i.value, total))}%
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function rankWithOther(items: Part[], keep: number, otherLabel: string, pinned: Part[] = []): Part[] {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const extra = pinned.reduce((s, p) => s + p.value, 0);
  if (sorted.length + (extra > 0 ? 1 : 0) <= keep + 1) {
    return extra > 0 ? [...sorted, { label: otherLabel, value: extra }] : sorted;
  }
  const rest = sorted.slice(keep).reduce((s, p) => s + p.value, 0) + extra;
  return [...sorted.slice(0, keep), { label: otherLabel, value: rest }];
}

export function RankBars({
  items,
  format = (v) => v.toLocaleString(),
  labelWidth = "8.5em",
}: {
  items: Part[];
  format?: (v: number) => string;
  labelWidth?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: `minmax(5em, ${labelWidth}) 1fr auto`,
        alignItems: "center",
        columnGap: 1.75,
        rowGap: 1.6,
        pt: 0.5,
        fontSize: "0.92rem",
      }}
    >
      {items.map((i, k) => (
        <Fragment key={i.label}>
          <Typography sx={{ color: owi.inkSoft, fontSize: "inherit" }} noWrap title={i.label}>
            {i.label}
          </Typography>
          <Box sx={{ height: 10, borderRadius: 999, bgcolor: owi.rule, overflow: "hidden" }}>
            <Box
              sx={{
                height: "100%",
                width: `${(i.value / max) * 100}%`,
                minWidth: i.value > 0 ? 6 : 0,
                borderRadius: 999,
                bgcolor: i.color ?? (k === 0 ? owi.gold : owi.ink),
              }}
            />
          </Box>
          <Typography
            sx={{ fontWeight: 660, fontSize: "inherit", textAlign: "right", fontVariantNumeric: "tabular-nums", minWidth: "3em" }}
          >
            {format(i.value)}
          </Typography>
        </Fragment>
      ))}
    </Box>
  );
}

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <Box role="group" sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <ButtonBase
            key={o.value}
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            sx={{
              height: 32,
              px: 1.6,
              gap: 0.75,
              borderRadius: 999,
              border: "1px solid",
              borderColor: on ? owi.ink : owi.line,
              bgcolor: on ? owi.ink : "#ffffff",
              color: on ? "#ffffff" : owi.inkSoft,
              fontFamily: "inherit",
              fontSize: "0.86rem",
              fontWeight: 620,
              whiteSpace: "nowrap",
              transition: "background-color 120ms, border-color 120ms, color 120ms",
              "&:hover": { borderColor: on ? owi.ink : owi.stroke },
            }}
          >
            {o.label}
            {o.count !== undefined && (
              <Box
                component="span"
                sx={{ color: on ? "#c2c7d0" : "text.secondary", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
              >
                {o.count.toLocaleString()}
              </Box>
            )}
          </ButtonBase>
        );
      })}
    </Box>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  width = 260,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  width?: number | string;
}) {
  return (
    <TextField
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      sx={{ width: { xs: "100%", sm: width }, "& .MuiOutlinedInput-input": { py: "7px", fontSize: "0.9rem" } }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchOutlined sx={{ fontSize: 19, color: "text.secondary" }} />
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => onChange("")} aria-label="clear" edge="end">
                <CloseOutlined sx={{ fontSize: 16 }} />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        },
        htmlInput: { "aria-label": placeholder },
      }}
    />
  );
}

export function Toolbar({ start, end }: { start?: ReactNode; end?: ReactNode }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1.5,
        flexWrap: "wrap",
        mb: 1.5,
      }}
    >
      <Box sx={{ minWidth: 0 }}>{start}</Box>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", ml: "auto" }}>{end}</Box>
    </Box>
  );
}

export type Tone = "bad" | "warn" | "ok" | "neutral" | "gold";

const TONES: Record<Tone, { border: string; bg: string; fg: string }> = {
  bad: { border: owi.badLine, bg: owi.badTint, fg: owi.bad },
  warn: { border: owi.goldLine, bg: owi.goldTint, fg: owi.brown },
  ok: { border: owi.okLine, bg: owi.okTint, fg: owi.ok },
  neutral: { border: owi.line, bg: "#ffffff", fg: owi.inkSoft },
  gold: { border: owi.gold, bg: owi.gold, fg: owi.ink },
};

export function Tag({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const c = TONES[tone];
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        px: 1,
        py: "1px",
        border: "1px solid",
        borderColor: c.border,
        bgcolor: c.bg,
        color: c.fg,
        borderRadius: 999,
        fontSize: "0.78rem",
        fontWeight: 640,
        lineHeight: 1.55,
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {children}
    </Box>
  );
}

export function Meter({ value, bad }: { value: number; bad?: boolean }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%", justifyContent: "flex-end" }}>
      <Box sx={{ width: 64, height: 6, borderRadius: 999, bgcolor: owi.well, overflow: "hidden", flexShrink: 0 }}>
        <Box sx={{ width: `${v}%`, height: "100%", borderRadius: 999, bgcolor: bad ? owi.bad : owi.ink }} />
      </Box>
      <Box
        component="span"
        sx={{ color: "text.secondary", fontSize: "0.85rem", width: "3.2em", textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}
      >
        {Math.round(value)}%
      </Box>
    </Box>
  );
}

export function CodeLabel({ children }: { children: ReactNode }) {
  return (
    <Box component="span" sx={{ fontWeight: 640, color: "text.primary", letterSpacing: "0.01em", whiteSpace: "nowrap" }}>
      {children}
    </Box>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", color: "text.secondary" }}>
      <InfoOutlined sx={{ fontSize: 17, mt: "3px", flexShrink: 0 }} />
      <Typography variant="body2" sx={{ color: "inherit", fontSize: "0.86rem" }}>
        {children}
      </Typography>
    </Box>
  );
}

export function Pager({
  page,
  pageSize,
  total,
  onPage,
  ofLabel,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  ofLabel: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, pt: 2 }}>
      <Typography sx={{ color: "text.secondary", fontSize: "0.88rem", fontVariantNumeric: "tabular-nums" }}>
        {from.toLocaleString()}–{to.toLocaleString()} {ofLabel} {total.toLocaleString()}
      </Typography>
      <Box sx={{ display: "flex", gap: 0.75 }}>
        {[
          { icon: <ChevronLeftOutlined fontSize="small" />, to: page - 1, off: page === 0, label: "previous" },
          { icon: <ChevronRightOutlined fontSize="small" />, to: page + 1, off: page >= pages - 1, label: "next" },
        ].map((b) => (
          <IconButton
            key={b.label}
            size="small"
            aria-label={b.label}
            disabled={b.off}
            onClick={() => onPage(b.to)}
            sx={{ border: "1px solid", borderColor: "divider", borderRadius: "8px", width: 32, height: 32 }}
          >
            {b.icon}
          </IconButton>
        ))}
      </Box>
    </Box>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return (
    <Typography variant="body2" color="text.secondary">
      {children}
    </Typography>
  );
}

export function StatRowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Grid container spacing={GAP}>
      {Array.from({ length: count }, (_, i) => (
        <Grid size={{ xs: 12, sm: 6, md: 12 / count }} key={i}>
          <Card>
            <CardContent>
              <Skeleton animation="wave" width="45%" />
              <Skeleton animation="wave" width="35%" height={40} />
              <Skeleton animation="wave" height={28} sx={{ mt: 1 }} />
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: "14px", p: 2.5, bgcolor: "background.paper" }}>
      <Skeleton animation="wave" width="30%" height={24} />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton animation="wave" height={34} key={i} />
      ))}
    </Box>
  );
}

export function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Skeleton animation="wave" width="35%" height={24} />
        <Skeleton animation="wave" variant="rounded" height={height} sx={{ mt: 2, borderRadius: "10px" }} />
      </CardContent>
    </Card>
  );
}

export function PageSkeleton() {
  return (
    <Stack spacing={GAP}>
      <StatRowSkeleton />
      <TableSkeleton />
    </Stack>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  height,
}: {
  icon?: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  height?: number;
}) {
  return (
    <Stack
      spacing={1}
      sx={{ alignItems: "center", justifyContent: "center", textAlign: "center", py: 4, px: 2, minHeight: height }}
    >
      {icon && (
        <Box sx={{ display: "flex", color: owi.muted, mb: 0.25, "& svg": { fontSize: 30 } }}>
          {icon}
        </Box>
      )}
      <Typography sx={{ fontWeight: 620, fontSize: "0.98rem", color: owi.inkSoft, maxWidth: 460 }}>{title}</Typography>
      {hint && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
          {hint}
        </Typography>
      )}
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
