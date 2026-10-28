import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import CleaningServicesOutlinedIcon from "@mui/icons-material/CleaningServicesOutlined";
import { DataTable, type GridColDef } from "../components/DataTable";
import {
  EmptyState,
  ErrorPanel,
  FilterChips,
  PageHeader,
  PageSkeleton,
  PageStack,
  SectionCard,
  StackBar,
  Tag,
  type Tone,
} from "../components/ui";
import { useApi } from "../useApi";
import { useI18n, type StringKey } from "../i18n";
import { owi } from "../theme";

interface Component {
  name: string;
  value: number;
  weight: number;
}

interface AreaScore {
  site_id: string;
  site_name: string;
  score: number | null;
  sufficient: boolean;
  method_version: string;
  components: Component[];
}

interface Methodology {
  version: string;
  weights: Record<string, number>;
  note: string;
}

type Band = "good" | "fair" | "poor" | "none";

// Higher score = cleaner area.
function band(a: AreaScore): Band {
  if (!a.sufficient || a.score == null) return "none";
  if (a.score >= 75) return "good";
  if (a.score >= 50) return "fair";
  return "poor";
}

const BAND_TONE: Record<Exclude<Band, "none">, Tone> = { good: "ok", fair: "warn", poor: "bad" };
const BAND_COLOR: Record<Band, string> = { good: owi.ok, fair: owi.gold, poor: owi.bad, none: "#e6e1d5" };

export default function Cleanliness() {
  const { t } = useI18n();
  const { data: areas, error, retry } = useApi<AreaScore[]>("/api/v1/cleanliness");
  // Methodology is a secondary footnote: on failure the line is simply omitted.
  const { data: method } = useApi<Methodology>("/api/v1/cleanliness/methodology");
  const [view, setView] = useState<"all" | Band>("all");

  const counts = useMemo(() => {
    const c: Record<Band, number> = { good: 0, fair: 0, poor: 0, none: 0 };
    for (const a of areas ?? []) c[band(a)] += 1;
    return c;
  }, [areas]);

  const shown = useMemo(
    () => (view === "all" ? (areas ?? []) : (areas ?? []).filter((a) => band(a) === view)),
    [areas, view],
  );

  if (error) {
    return (
      <PageStack>
        <ErrorPanel message={t("errorLoad")} retryLabel={t("retry")} onRetry={retry} />
      </PageStack>
    );
  }
  if (areas === null) return <PageSkeleton />;

  const compNames = Array.from(new Set(areas.flatMap((a) => a.components.map((c) => c.name))));
  const bandLabel: Record<Band, string> = {
    good: t("scoreGood"),
    fair: t("scoreFair"),
    poor: t("scorePoor"),
    none: t("insufficient"),
  };
  const order: Band[] = ["good", "fair", "poor", "none"];

  const columns: GridColDef<AreaScore>[] = [
    { field: "site_name", headerName: t("site"), flex: 1.4, minWidth: 180 },
    {
      field: "score",
      headerName: t("score"),
      width: 120,
      type: "number",
      valueGetter: (_v, row) => (row.sufficient && row.score != null ? Math.round(row.score) : null),
      renderCell: (p) => {
        const b = band(p.row);
        return b === "none" ? (
          <Box title={t("insufficient")} sx={{ color: "text.secondary" }}>—</Box>
        ) : (
          <Tag tone={BAND_TONE[b]}>{p.value as number}</Tag>
        );
      },
    },
    ...compNames.map(
      (name): GridColDef<AreaScore> => ({
        field: `comp_${name}`,
        headerName: t(`comp_${name}` as StringKey),
        type: "number",
        flex: 1,
        minWidth: 120,
        valueGetter: (_v, row) => {
          const c = row.components.find((x) => x.name === name);
          return c ? Math.round(c.value) : null;
        },
        renderCell: (p) => (p.value == null ? "—" : String(p.value)),
      }),
    ),
  ];

  return (
    <PageStack>
      <PageHeader
        title={t("cleanlinessIndex")}
        info={method ? `${method.note} (${t("methodology")}: ${method.version})` : undefined}
      />

      {areas.length === 0 ? (
        <SectionCard>
          <EmptyState icon={<CleaningServicesOutlinedIcon />} title={t("noAreas")} />
        </SectionCard>
      ) : (
        <>
          <SectionCard title={t("scoreBands")} hint={t("areasN").replace("{n}", areas.length.toLocaleString())}>
            <StackBar
              inline
              items={order.map((b) => ({ label: bandLabel[b], value: counts[b], color: BAND_COLOR[b] }))}
            />
          </SectionCard>
          <DataTable
            rows={shown}
            columns={columns}
            getRowId={(r) => r.site_id}
            pageSize={25}
            filters={
              <FilterChips<"all" | Band>
                value={view}
                onChange={setView}
                options={[
                  { value: "all", label: t("all"), count: areas.length },
                  ...order.map((b) => ({ value: b, label: bandLabel[b], count: counts[b] })),
                ]}
              />
            }
          />
        </>
      )}
    </PageStack>
  );
}
