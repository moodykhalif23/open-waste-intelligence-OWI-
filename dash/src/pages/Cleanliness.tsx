import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { api } from "../api";
import { DataTable, type GridColDef } from "../components/DataTable";
import { Muted, PageStack } from "../components/ui";
import { useI18n, type StringKey } from "../i18n";

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

// Higher score = cleaner area.
function scoreHex(score: number): string {
  if (score >= 75) return "#0e7a55";
  if (score >= 50) return "#b4791a";
  return "#c0392b";
}

export default function Cleanliness() {
  const { t } = useI18n();
  const [areas, setAreas] = useState<AreaScore[] | null>(null);
  const [method, setMethod] = useState<Methodology | null>(null);

  useEffect(() => {
    void api<AreaScore[]>("/api/v1/cleanliness").then(setAreas);
    void api<Methodology>("/api/v1/cleanliness/methodology").then(setMethod);
  }, []);

  if (areas === null) return <Muted>{t("loading")}</Muted>;

  const compNames = Array.from(new Set(areas.flatMap((a) => a.components.map((c) => c.name))));

  const columns: GridColDef<AreaScore>[] = [
    { field: "site_name", headerName: t("site"), flex: 1, minWidth: 150 },
    {
      field: "score",
      headerName: t("score"),
      width: 120,
      type: "number",
      valueGetter: (_v, row) => (row.sufficient && row.score != null ? Math.round(row.score) : null),
      renderCell: (p) =>
        p.value == null ? (
          <Box sx={{ color: "text.secondary" }}>{t("insufficient")}</Box>
        ) : (
          <Box sx={{ fontWeight: 800, fontSize: "1.05rem", color: scoreHex(p.value as number) }}>{p.value as number}</Box>
        ),
    },
    ...compNames.map(
      (name): GridColDef<AreaScore> => ({
        field: `comp_${name}`,
        headerName: t(`comp_${name}` as StringKey),
        type: "number",
        flex: 1,
        minWidth: 130,
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
      <Typography variant="h5">{t("cleanlinessIndex")}</Typography>

      {areas.length === 0 ? (
        <Muted>{t("noAreas")}</Muted>
      ) : (
        <DataTable rows={areas} columns={columns} getRowId={(r) => r.site_id} toolbar={false} />
      )}

      {method && (
        <Muted>
          {t("methodology")} {method.version}: {method.note}
        </Muted>
      )}
    </PageStack>
  );
}
