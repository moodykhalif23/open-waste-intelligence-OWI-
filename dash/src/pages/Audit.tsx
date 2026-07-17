import HistoryOutlined from "@mui/icons-material/HistoryOutlined";
import { DataTable, type GridColDef } from "../components/DataTable";
import {
  EmptyState,
  ErrorPanel,
  PageStack,
  TableSection,
  TableSkeleton,
} from "../components/ui";
import { useI18n } from "../i18n";
import { useApi } from "../useApi";

interface AuditRow {
  id: string;
  created_at: string;
  actor_name: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  ip: string | null;
  detail: Record<string, unknown>;
}

export default function Audit() {
  const { t } = useI18n();
  const { data: rows, error, retry } = useApi<AuditRow[]>(
    "/api/v1/admin/audit?limit=500",
  );

  if (error) {
    return (
      <PageStack>
        <ErrorPanel message={t("errorLoad")} retryLabel={t("retry")} onRetry={retry} />
      </PageStack>
    );
  }

  if (rows === null) {
    return (
      <PageStack>
        <TableSection title={t("audit")}>
          <TableSkeleton />
        </TableSection>
      </PageStack>
    );
  }

  const columns: GridColDef<AuditRow>[] = [
    {
      field: "created_at",
      headerName: t("auditTime"),
      minWidth: 170,
      valueFormatter: (v: string) => new Date(v).toLocaleString(),
    },
    {
      field: "actor_name",
      headerName: t("auditActor"),
      minWidth: 140,
      valueFormatter: (v: string | null) => v ?? "—",
    },
    { field: "action", headerName: t("auditAction"), minWidth: 160 },
    { field: "entity", headerName: t("auditEntity"), minWidth: 110 },
    {
      field: "ip",
      headerName: "IP",
      minWidth: 120,
      valueFormatter: (v: string | null) => v ?? "—",
    },
    {
      field: "detail",
      headerName: t("auditDetail"),
      flex: 1,
      minWidth: 220,
      valueFormatter: (v: Record<string, unknown>) =>
        v && Object.keys(v).length > 0 ? JSON.stringify(v) : "—",
    },
  ];

  return (
    <PageStack>
      <TableSection title={t("audit")}>
        {rows.length === 0 ? (
          <EmptyState icon={<HistoryOutlined />} title={t("noAudit")} />
        ) : (
          <DataTable rows={rows} columns={columns} pageSize={25} />
        )}
      </TableSection>
    </PageStack>
  );
}
