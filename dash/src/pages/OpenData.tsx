import { useCallback, useEffect, useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
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
import { api, type ApiKey, type ApiKeyCreated, type PublicMeta } from "../api";
import { Muted, PageStack, SectionCard } from "../components/ui";
import { useI18n } from "../i18n";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function OpenData() {
  const { t } = useI18n();
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [meta, setMeta] = useState<PublicMeta | null>(null);
  const [issued, setIssued] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reload = useCallback(async () => {
    setKeys(await api<ApiKey[]>("/api/v1/admin/api-keys"));
  }, []);

  useEffect(() => {
    void reload();
    void api<PublicMeta>("/api/v1/public/meta").then(setMeta);
  }, [reload]);

  async function revoke(id: string) {
    await api(`/api/v1/admin/api-keys/${id}/revoke`, { method: "POST" });
    await reload();
  }

  async function copyKey() {
    if (!issued) return;
    await navigator.clipboard.writeText(issued);
    setCopied(true);
  }

  if (keys === null) return <Muted>{t("loading")}</Muted>;

  return (
    <PageStack>
      <SectionCard title={t("publicApiDocs")} subtitle={t("publicApiIntro")}>
        {meta && (
          <Stack spacing={1.5}>
            <Meta label={t("license")} value={meta.license} />
            <Meta label={t("delay")} value={`${meta.delay_days} days`} />
            <Meta label={t("suppression")} value={meta.suppression} />
            <Meta label={t("endpoints")} value={meta.endpoints.map((e) => `/api/v1/public${e}`).join("  ·  ")} />
            <Box>
              <Typography variant="overline" color="text.secondary">
                {t("exampleRequest")}
              </Typography>
              <Box
                sx={{
                  mt: 0.5,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: "#0f172a",
                  color: "#e2e8f0",
                  fontFamily: "ui-monospace, Consolas, monospace",
                  fontSize: "0.82rem",
                  overflowX: "auto",
                }}
              >
                curl -H &quot;X-API-Key: owi_…&quot; \{"\n"}
                &nbsp;&nbsp;&quot;/api/v1/public/composition?ward=Kariobangi&amp;weeks=12&amp;format=csv&quot;
              </Box>
            </Box>
          </Stack>
        )}
      </SectionCard>

      <SectionCard
        title={t("apiKeys")}
        action={<KeyForm onCreated={reload} onIssued={(k) => { setIssued(k); setCopied(false); }} />}
      >
        {issued && (
          <Alert severity="success" icon={false} sx={{ mb: 2.5 }}>
            <Stack spacing={1.5}>
              <Typography variant="body2">{t("keyIssuedHint")}</Typography>
              <TextField
                value={issued}
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
                  onClick={() => void copyKey()}
                >
                  {copied ? t("copied") : t("copy")}
                </Button>
              </Box>
            </Stack>
          </Alert>
        )}
        {keys.length === 0 ? (
          <Muted>{t("noKeys")}</Muted>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("keyLabel")}</TableCell>
                  <TableCell>{t("keyPrefix")}</TableCell>
                  <TableCell>{t("created")}</TableCell>
                  <TableCell>{t("lastUsed")}</TableCell>
                  <TableCell>{t("status")}</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id} hover>
                    <TableCell>{k.label}</TableCell>
                    <TableCell sx={{ fontFamily: "ui-monospace, monospace" }}>{k.key_prefix}</TableCell>
                    <TableCell>{fmtDate(k.created_at)}</TableCell>
                    <TableCell>{k.last_used_at ? fmtDate(k.last_used_at) : t("never")}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={k.revoked_at ? "default" : "success"}
                        label={k.revoked_at ? t("revoked") : t("active")}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {!k.revoked_at && (
                        <Button variant="outlined" size="small" color="error" onClick={() => void revoke(k.id)}>
                          {t("revoke")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SectionCard>
    </PageStack>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
      <Typography variant="body2" sx={{ minWidth: 96, fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
        {value}
      </Typography>
    </Box>
  );
}

function KeyForm({
  onCreated,
  onIssued,
}: {
  onCreated: () => Promise<void>;
  onIssued: (key: string) => void;
}) {
  const { t } = useI18n();
  const [label, setLabel] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    const created = await api<ApiKeyCreated>("/api/v1/admin/api-keys", {
      method: "POST",
      body: JSON.stringify({ label }),
    });
    onIssued(created.api_key);
    setLabel("");
    await onCreated();
  }

  return (
    <Box component="form" onSubmit={(e) => void onSubmit(e)} sx={{ display: "flex", gap: 1 }}>
      <TextField
        size="small"
        label={t("keyLabel")}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <Button variant="contained" type="submit">
        {t("newApiKey")}
      </Button>
    </Box>
  );
}
