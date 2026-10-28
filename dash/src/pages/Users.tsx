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
  const [issued, setIssued] = useState<{ userId: string; userName: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

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

  async function issueToken(user: User, newlyCreated = false) {
    setActionError(null);
    setBusyUserId(user.id);
    try {
      const response = await api<{ access_token: string }>("/api/v1/auth/device-tokens", {
        method: "POST",
        body: JSON.stringify({ user_id: user.id }),
      });
      setIssued({ userId: user.id, userName: user.name, token: response.access_token });
      setCopied(false);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setActionError(
        newlyCreated
          ? `${t("collectorCreatedTokenFailed")} (${detail})`
          : `${t("tokenIssueFailed")} (${detail})`,
      );
    } finally {
      setBusyUserId(null);
    }
  }

  async function revoke(user: User) {
    setActionError(null);
    setBusyUserId(user.id);
    try {
      await api(`/api/v1/users/${user.id}/revoke-tokens`, { method: "POST" });
      if (issued?.userId === user.id) setIssued(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyUserId(null);
    }
  }

  async function copyToken() {
    if (!issued) return;
    setActionError(null);
    try {
      await navigator.clipboard.writeText(issued.token);
      setCopied(true);
    } catch {
      setActionError(t("copyTokenFailed"));
    }
  }

  async function handleUserCreated(user: User) {
    await reload();
    if (user.role === "collector") await issueToken(user, true);
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
            <Button
              variant="outlined"
              size="small"
              disabled={busyUserId === p.row.id}
              onClick={() => void issueToken(p.row)}
            >
              {busyUserId === p.row.id ? t("issuingToken") : t("issueToken")}
            </Button>
          )}
          <Button
            variant="outlined"
            size="small"
            color="error"
            disabled={busyUserId === p.row.id}
            onClick={() => void revoke(p.row)}
          >
            {t("revokeTokens")}
          </Button>
        </Stack>
      ),
    },
  ];

  return (
    <PageStack>
      <SectionCard collapsible title={t("newUser")}>
        <UserForm onCreated={handleUserCreated} />
      </SectionCard>

      <TableSection title={t("users")}>
        {users.length === 0 ? (
          <EmptyState icon={<ManageAccountsOutlinedIcon />} title={t("noData")} />
        ) : (
          <DataTable rows={users} columns={columns} />
        )}

        {actionError && (
          <Alert severity="error" sx={{ mt: 2.5 }}>
            {actionError}
          </Alert>
        )}

        {issued && (
          <Alert severity="success" icon={false} sx={{ mt: 2.5 }}>
            <Stack spacing={1.5}>
              <Typography variant="body2">
                {t("tokenIssuedFor")} {issued.userName}. {t("tokenIssuedHint")}
              </Typography>
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

function UserForm({ onCreated }: { onCreated: (user: User) => Promise<void> }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("collector");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    let createdUser: User;
    try {
      createdUser = await api<User>("/api/v1/users", {
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
    await onCreated(createdUser);
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
        {role === "collector" && (
          <Alert severity="info">
            {t("collectorOnboardingHint")}
          </Alert>
        )}
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
