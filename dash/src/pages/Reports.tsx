import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CloseIcon from "@mui/icons-material/Close";
import PhotoOutlinedIcon from "@mui/icons-material/PhotoOutlined";
import { api, apiBlob, type Bin, type Observation } from "../api";
import { Muted, PageStack, SectionCard } from "../components/ui";
import { useI18n, type StringKey } from "../i18n";

export default function Reports() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const material = params.get("material");
  const [observations, setObservations] = useState<Observation[] | null>(null);
  const [bins, setBins] = useState<Bin[]>([]);

  useEffect(() => {
    setObservations(null);
    const q = material ? `&material=${encodeURIComponent(material)}` : "";
    void api<Observation[]>(`/api/v1/observations?limit=200${q}`).then(setObservations);
    void api<Bin[]>("/api/v1/bins").then(setBins);
  }, [material]);

  async function viewPhoto(id: string) {
    const blob = await apiBlob(`/api/v1/observations/${id}/image`);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  if (observations === null) return <Muted>{t("loading")}</Muted>;
  const binCode = (id: string | null) =>
    id === null ? t("noBin") : (bins.find((b) => b.id === id)?.qr_code ?? id.slice(0, 8));

  return (
    <PageStack>
      <SectionCard
        title={t("reports")}
        action={
          material && (
            <Button
              variant="outlined"
              size="small"
              endIcon={<CloseIcon />}
              onClick={() => navigate("/records/reports")}
            >
              {t("filteredBy")}: {t(material as StringKey)}
            </Button>
          )
        }
      >
        {observations.length === 0 ? (
          <Muted>{t("noData")}</Muted>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("capturedAt")}</TableCell>
                  <TableCell>{t("bin")}</TableCell>
                  <TableCell>{t("fillTap")}</TableCell>
                  <TableCell>{t("source")}</TableCell>
                  <TableCell>{t("privacy")}</TableCell>
                  <TableCell>{t("photo")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {observations.map((obs) => (
                  <TableRow key={obs.id} hover>
                    <TableCell>{new Date(obs.captured_at).toLocaleString()}</TableCell>
                    <TableCell sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                      {binCode(obs.bin_id)}
                    </TableCell>
                    <TableCell>
                      {obs.fill_tap ? (
                        <Chip size="small" label={t(obs.fill_tap as StringKey)} />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{obs.location_source}</TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" label={obs.privacy_status} />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="text"
                        size="small"
                        startIcon={<PhotoOutlinedIcon />}
                        onClick={() => void viewPhoto(obs.id)}
                      >
                        {t("view")}
                      </Button>
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
