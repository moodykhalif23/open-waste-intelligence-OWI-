import { useCallback, useEffect, useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import { api, type Role, type User } from "../api";
import { DataTable, type GridColDef } from "../components/DataTable";
import { EmptyState, ErrorPanel, PageStack, SectionCard, TableSection, TableSkeleton } from "../components/ui";
import { useI18n } from "../i18n";

const ROLES: Role[] = ["collector", "coordinator", "viewer", "admin"];

export default function Users() {
  const { t } = useI18n();
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ userId: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const reload = useCallback(async () => {
    try {
      setUsers(await api<User[]>("/api/v1/users"));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function issueToken(user: User) {
    const response = await api<{ access_token: string }>("/api/v1/auth/device-tokens", {
      method: "POST",
      body: JSON.stringify({ user_id: user.id }),
    });
    setIssued({ userId: user.id, token: response.access_token });
    setCopied(false);
  }

  async function revoke(user: User) {
    await api(`/api/v1/users/${user.id}/revoke-tokens`, { method: "POST" });
    if (issued?.userId === user.id) setIssued(null);
  }

  async function copyToken() {
    if (!issued) return;
    await navigator.clipboard.writeText(issued.token);
    setCopied(true);
  }

  if (error) {
    return (
      <PageStack>
        <ErrorPanel
          message={t("errorLoad")}
          retryLabel={t("retry")}
          onRetry={() => {
            setError(null);
            setUsers(null);
            void reload();
          }}
        />
      </PageStack>
    );
  }

  if (users === null) {
    return (
      <PageStack>
        <TableSkeleton />
      </PageStack>
    );
  }

  const columns: GridColDef<User>[] = [
    { field: "name", headerName: t("name"), flex: 1, minWidth: 130 },
    {
      field: "phone",
      headerName: t("phone"),
      flex: 1,
      minWidth: 130,
      renderCell: (p) => <Box sx={{ fontFamily: "ui-monospace, monospace" }}>{(p.value as string) ?? "—"}</Box>,
    },
    { field: "role", headerName: t("role"), width: 130 },
    {
      field: "actions",
      headerName: "",
      width: 240,
      sortable: false,
      filterable: false,
      renderCell: (p) => (
        <Stack direction="row" spacing={1} sx={{ height: "100%", alignItems: "center" }}>
          {p.row.role === "collector" && (
            <Button variant="outlined" size="small" onClick={() => void issueToken(p.row)}>
              {t("issueToken")}
            </Button>
          )}
          <Button variant="outlined" size="small" color="error" onClick={() => void revoke(p.row)}>
            {t("revokeTokens")}
          </Button>
        </Stack>
      ),
    },
  ];

  return (
    <PageStack>
      <SectionCard collapsible title={t("newUser")}>
        <UserForm onCreated={reload} />
      </SectionCard>

      <TableSection title={t("users")}>
        {users.length === 0 ? (
          <EmptyState icon={<ManageAccountsOutlinedIcon />} title={t("noData")} />
        ) : (
          <DataTable rows={users} columns={columns} />
        )}

        {issued && (
          <Alert severity="success" icon={false} sx={{ mt: 2.5 }}>
            <Stack spacing={1.5}>
              <Typography variant="body2">{t("tokenIssuedHint")}</Typography>
              <TextField
                value={issued.token}
                fullWidth
                size="small"
                slotProps={{
                  input: {
                    readOnly: true,
                    sx: { fontFamily: "ui-monospace, monospace", fontSize: "0.85rem" },
                  },
                }}
              />
              <Box>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => void copyToken()}
                >
                  {copied ? t("copied") : t("copy")}
                </Button>
              </Box>
            </Stack>
          </Alert>
        )}
      </TableSection>
    </PageStack>
  );
}

function UserForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("collector");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({ name, phone, role, password: password || null }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    setName("");
    setPhone("");
    setPassword("");
    await onCreated();
  }

  return (
    <Box component="form" onSubmit={(e) => void onSubmit(e)}>
      <Stack spacing={2.5}>
        <TextField
          label={t("name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          size="small"
          fullWidth
        />
        <TextField
          label={t("phone")}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          size="small"
          fullWidth
        />
        <TextField
          select
          label={t("role")}
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          size="small"
          fullWidth
        >
          {ROLES.map((value) => (
            <MenuItem key={value} value={value}>
              {value}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label={t("passwordOptional")}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          size="small"
          fullWidth
        />
        {error && <Alert severity="error">{error}</Alert>}
        <Box>
          <Button variant="contained" type="submit">
            {t("create")}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
