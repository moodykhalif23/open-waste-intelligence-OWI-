import { useEffect, useState } from "react";
import { api } from "../api";
import { DataTable, type GridColDef } from "../components/DataTable";
import { Muted, PageStack, TableSection } from "../components/ui";
import { useI18n } from "../i18n";

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
  const [rows, setRows] = useState<AuditRow[] | null>(null);

  useEffect(() => {
    void api<AuditRow[]>("/api/v1/admin/audit?limit=500")
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  if (rows === null) return <Muted>{t("loading")}</Muted>;

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
          <Muted>{t("noAudit")}</Muted>
        ) : (
          <DataTable rows={rows} columns={columns} pageSize={25} />
        )}
      </TableSection>
    </PageStack>
  );
}
