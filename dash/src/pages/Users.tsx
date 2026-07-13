import { useCallback, useEffect, useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { api, type Role, type User } from "../api";
import { Muted, PageStack, SectionCard } from "../components/ui";
import { useI18n } from "../i18n";

const ROLES: Role[] = ["collector", "coordinator", "viewer", "admin"];

export default function Users() {
  const { t } = useI18n();
  const [users, setUsers] = useState<User[] | null>(null);
  const [issued, setIssued] = useState<{ userId: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const reload = useCallback(async () => {
    setUsers(await api<User[]>("/api/v1/users"));
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

  if (users === null) return <Muted>{t("loading")}</Muted>;

  return (
    <PageStack>
      <SectionCard title={t("newUser")}>
        <UserForm onCreated={reload} />
      </SectionCard>

      <SectionCard title={t("users")}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t("name")}</TableCell>
                <TableCell>{t("phone")}</TableCell>
                <TableCell>{t("role")}</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>{user.name}</TableCell>
                  <TableCell sx={{ fontFamily: "ui-monospace, monospace" }}>
                    {user.phone ?? "—"}
                  </TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                      {user.role === "collector" && (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => void issueToken(user)}
                        >
                          {t("issueToken")}
                        </Button>
                      )}
                      <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        onClick={() => void revoke(user)}
                      >
                        {t("revokeTokens")}
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

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
      </SectionCard>
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
