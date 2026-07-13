import { useCallback, useEffect, useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import FormLabel from "@mui/material/FormLabel";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import { api } from "../api";
import { Muted, PageStack, SectionCard, StatCard } from "../components/ui";
import { useI18n, type StringKey } from "../i18n";

const MATERIALS = ["plastic", "glass", "metal", "paper", "organic", "e_waste", "textile"] as const;

interface MaterialValue {
  material: string;
  kg: number;
  kes_per_kg: number | null;
  value_kes: number;
  partners: number;
}

interface ValueReport {
  window_days: number;
  total_kg: number;
  total_value_kes: number;
  materials: MaterialValue[];
}

interface Price {
  id: string;
  material: string;
  kes_per_kg: number;
  effective_date: string;
}

interface Partner {
  id: string;
  name: string;
  materials_accepted: string[];
  min_kg_per_month: number;
  contact: string | null;
}

export default function Recycling() {
  const { t } = useI18n();
  const [value, setValue] = useState<ValueReport | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);

  const reload = useCallback(async () => {
    const [v, p, pa] = await Promise.all([
      api<ValueReport>("/api/v1/recycling/value?days=30"),
      api<Price[]>("/api/v1/recycling/prices"),
      api<Partner[]>("/api/v1/recycling/partners"),
    ]);
    setValue(v);
    setPrices(p);
    setPartners(pa);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const label = (m: string) => t(m as StringKey);
  if (value === null) return <Muted>{t("loading")}</Muted>;

  return (
    <PageStack>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard label={t("kgCollected30")} value={Math.round(value.total_kg).toLocaleString()} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard
            label={t("estValue30")}
            value={`KES ${Math.round(value.total_value_kes).toLocaleString()}`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard label={t("partnersRegistered")} value={partners.length} />
        </Grid>
      </Grid>

      <SectionCard title={t("recoverableValue")}>
        {value.materials.length === 0 ? (
          <Muted>{t("noValueYet")}</Muted>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("material")}</TableCell>
                  <TableCell>{t("kgEst")}</TableCell>
                  <TableCell>{t("pricePerKg")}</TableCell>
                  <TableCell>{t("valueKes")}</TableCell>
                  <TableCell>{t("matchingPartners")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {value.materials.map((m) => (
                  <TableRow key={m.material}>
                    <TableCell>{label(m.material)}</TableCell>
                    <TableCell>{m.kg.toLocaleString()}</TableCell>
                    <TableCell>{m.kes_per_kg === null ? "—" : `KES ${m.kes_per_kg}`}</TableCell>
                    <TableCell>
                      {m.value_kes ? `KES ${Math.round(m.value_kes).toLocaleString()}` : "—"}
                    </TableCell>
                    <TableCell>{m.partners}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <Alert severity="info" sx={{ mt: 2.5 }}>
          {t("valueMethod")}
        </Alert>
      </SectionCard>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <PriceForm onSaved={reload} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <PartnerForm onSaved={reload} />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard title={t("priceTable")}>
            {prices.length === 0 ? (
              <Muted>{t("noPrices")}</Muted>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>{t("material")}</TableCell>
                      <TableCell>{t("pricePerKg")}</TableCell>
                      <TableCell>{t("effectiveDate")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {prices.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{label(p.material)}</TableCell>
                        <TableCell>KES {p.kes_per_kg}</TableCell>
                        <TableCell>{p.effective_date}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard title={t("partners")}>
            {partners.length === 0 ? (
              <Muted>{t("noPartners")}</Muted>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>{t("name")}</TableCell>
                      <TableCell>{t("accepts")}</TableCell>
                      <TableCell>{t("minKg")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {partners.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.name}</TableCell>
                        <TableCell>{p.materials_accepted.map(label).join(", ")}</TableCell>
                        <TableCell>{p.min_kg_per_month}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </SectionCard>
        </Grid>
      </Grid>
    </PageStack>
  );
}

function PriceForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const { t } = useI18n();
  const [material, setMaterial] = useState<string>("plastic");
  const [price, setPrice] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await api("/api/v1/recycling/prices", {
      method: "POST",
      body: JSON.stringify({
        material,
        kes_per_kg: Number(price),
        effective_date: effectiveDate,
      }),
    });
    setPrice("");
    await onSaved();
  }

  return (
    <SectionCard title={t("setPrice")}>
      <form onSubmit={(e) => void onSubmit(e)}>
        <Stack spacing={2}>
          <TextField
            select
            label={t("material")}
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
          >
            {MATERIALS.map((m) => (
              <MenuItem key={m} value={m}>
                {t(m as StringKey)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="number"
            label={t("pricePerKg")}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
          />
          <TextField
            type="date"
            label={t("effectiveDate")}
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Button variant="contained" type="submit">
            {t("setPrice")}
          </Button>
        </Stack>
      </form>
    </SectionCard>
  );
}

function PartnerForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [accepts, setAccepts] = useState<string[]>([]);
  const [minKg, setMinKg] = useState("0");
  const [contact, setContact] = useState("");

  function toggle(m: string) {
    setAccepts((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await api("/api/v1/recycling/partners", {
      method: "POST",
      body: JSON.stringify({
        name,
        materials_accepted: accepts,
        min_kg_per_month: Number(minKg),
        contact: contact || null,
      }),
    });
    setName("");
    setAccepts([]);
    setMinKg("0");
    setContact("");
    await onSaved();
  }

  return (
    <SectionCard title={t("addPartner")}>
      <form onSubmit={(e) => void onSubmit(e)}>
        <Stack spacing={2}>
          <TextField
            label={t("name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <div>
            <FormLabel component="legend" sx={{ mb: 1 }}>
              {t("accepts")}
            </FormLabel>
            <FormGroup row>
              {MATERIALS.map((m) => (
                <FormControlLabel
                  key={m}
                  control={
                    <Checkbox
                      color="primary"
                      checked={accepts.includes(m)}
                      onChange={() => toggle(m)}
                    />
                  }
                  label={t(m as StringKey)}
                />
              ))}
            </FormGroup>
          </div>
          <TextField
            type="number"
            label={t("minKg")}
            value={minKg}
            onChange={(e) => setMinKg(e.target.value)}
            slotProps={{ htmlInput: { min: 0 } }}
          />
          <TextField
            label={t("contact")}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
          <Button variant="contained" type="submit">
            {t("addPartner")}
          </Button>
        </Stack>
      </form>
    </SectionCard>
  );
}
