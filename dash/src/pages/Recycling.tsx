import { useCallback, useEffect, useState, type FormEvent } from "react";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import FormLabel from "@mui/material/FormLabel";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import HandshakeOutlined from "@mui/icons-material/HandshakeOutlined";
import RecyclingOutlined from "@mui/icons-material/RecyclingOutlined";
import SellOutlined from "@mui/icons-material/SellOutlined";
import { api } from "../api";
import { DataTable, type GridColDef } from "../components/DataTable";
import { compact } from "../components/EChart";
import {
  EmptyState,
  ErrorPanel,
  GAP,
  PageSkeleton,
  PageStack,
  RankBars,
  SectionCard,
  StatCard,
  StatRow,
  TableSection,
  rankWithOther,
} from "../components/ui";
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
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [v, p, pa] = await Promise.all([
        api<ValueReport>("/api/v1/recycling/value?days=30"),
        api<Price[]>("/api/v1/recycling/prices"),
        api<Partner[]>("/api/v1/recycling/partners"),
      ]);
      setValue(v);
      setPrices(p);
      setPartners(pa);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const label = (m: string) => t(m as StringKey);
  if (error !== null) {
    return (
      <PageStack>
        <ErrorPanel message={t("errorLoad")} retryLabel={t("retry")} onRetry={() => void reload()} />
      </PageStack>
    );
  }
  if (value === null) return <PageSkeleton />;

  const valueCols: GridColDef<MaterialValue>[] = [
    { field: "material", headerName: t("material"), flex: 1, minWidth: 110, valueGetter: (_v, row) => label(row.material) },
    { field: "kg", headerName: t("kgEst"), type: "number", width: 110, valueFormatter: (v) => Math.round(Number(v)).toLocaleString() },
    { field: "kes_per_kg", headerName: t("pricePerKg"), type: "number", width: 110, valueFormatter: (v) => (v == null ? "—" : `KES ${v}`) },
    { field: "value_kes", headerName: t("valueKes"), type: "number", flex: 1, minWidth: 130, valueFormatter: (v) => (v ? `KES ${Math.round(Number(v)).toLocaleString()}` : "—") },
    { field: "partners", headerName: t("matchingPartners"), type: "number", width: 100 },
  ];
  const priceCols: GridColDef<Price>[] = [
    { field: "material", headerName: t("material"), flex: 1, minWidth: 110, valueGetter: (_v, row) => label(row.material) },
    { field: "kes_per_kg", headerName: t("pricePerKg"), type: "number", width: 120, valueFormatter: (v) => `KES ${v}` },
    { field: "effective_date", headerName: t("effectiveDate"), flex: 1, minWidth: 120 },
  ];
  const partnerCols: GridColDef<Partner>[] = [
    { field: "name", headerName: t("name"), flex: 1, minWidth: 120 },
    { field: "materials_accepted", headerName: t("accepts"), flex: 1.4, minWidth: 160, valueGetter: (_v, row) => row.materials_accepted.map(label).join(", ") },
    { field: "min_kg_per_month", headerName: t("minKg"), type: "number", width: 120, valueFormatter: (v) => Number(v).toLocaleString() },
  ];

  const kes = (v: number) => `KES ${Math.round(v).toLocaleString()}`;
  const bars = rankWithOther(
    value.materials.map((m) => ({ label: label(m.material), value: m.value_kes })),
    6,
    label("other_mixed"),
  );

  return (
    <PageStack>
      <StatRow>
        <StatCard label={t("kgCollected30")} value={Math.round(value.total_kg).toLocaleString()} />
        <StatCard label={t("estValue30")} value={kes(value.total_value_kes)} info={t("valueMethod")} />
        <StatCard label={t("partnersRegistered")} value={partners.length.toLocaleString()} />
      </StatRow>

      {value.materials.length === 0 ? (
        <SectionCard title={t("recoverableValue")}>
          <EmptyState icon={<RecyclingOutlined />} title={t("noValueYet")} />
        </SectionCard>
      ) : (
        <Grid container spacing={GAP}>
          <Grid size={{ xs: 12, md: 5 }}>
            <SectionCard title={t("recoverableValue")}>
              <RankBars items={bars} format={(v) => `KES ${compact(v)}`} />
            </SectionCard>
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            <DataTable rows={value.materials} columns={valueCols} getRowId={(r) => r.material} toolbar={false} />
          </Grid>
        </Grid>
      )}

      <Grid container spacing={GAP} sx={{ alignItems: "flex-start" }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TableSection title={t("priceTable")} hint={prices.length > 0 ? prices.length.toLocaleString() : undefined}>
            {prices.length === 0 ? (
              <SectionCard>
                <EmptyState icon={<SellOutlined />} title={t("noPrices")} />
              </SectionCard>
            ) : (
              <DataTable rows={prices} columns={priceCols} toolbar={false} pageSize={5} />
            )}
          </TableSection>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TableSection title={t("partners")} hint={partners.length > 0 ? partners.length.toLocaleString() : undefined}>
            {partners.length === 0 ? (
              <SectionCard>
                <EmptyState icon={<HandshakeOutlined />} title={t("noPartners")} />
              </SectionCard>
            ) : (
              <DataTable rows={partners} columns={partnerCols} toolbar={false} pageSize={5} />
            )}
          </TableSection>
        </Grid>
      </Grid>

      <Grid container spacing={GAP} sx={{ alignItems: "flex-start" }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <PriceForm onSaved={reload} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <PartnerForm onSaved={reload} />
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
    <SectionCard collapsible title={t("setPrice")}>
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
    <SectionCard collapsible title={t("addPartner")}>
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
