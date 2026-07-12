import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, apiBlob, type Bin, type Site } from "../api";
import { useI18n } from "../i18n";

export default function Bins() {
  const { t } = useI18n();
  const [sites, setSites] = useState<Site[]>([]);
  const [bins, setBins] = useState<Bin[] | null>(null);

  const reload = useCallback(async () => {
    const [siteList, binList] = await Promise.all([
      api<Site[]>("/api/v1/sites"),
      api<Bin[]>("/api/v1/bins"),
    ]);
    setSites(siteList);
    setBins(binList);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function downloadQr(bin: Bin) {
    const blob = await apiBlob(`/api/v1/bins/${bin.id}/qr.svg`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bin-${bin.qr_code}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (bins === null) return <p className="muted">{t("loading")}</p>;
  const siteName = (id: string) => sites.find((s) => s.id === id)?.name ?? id.slice(0, 8);

  return (
    <>
      <section className="cards">
        <SiteForm onCreated={reload} />
        <BinForm sites={sites} onCreated={reload} />
      </section>
      <div className="card">
        <h2>{t("bins")}</h2>
        {bins.length === 0 ? (
          <p className="muted">{t("noData")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("qrCode")}</th>
                <th>{t("site")}</th>
                <th>{t("binType")}</th>
                <th>{t("volume")}</th>
                <th>{t("lat")}</th>
                <th>{t("lng")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {bins.map((bin) => (
                <tr key={bin.id}>
                  <td className="mono">{bin.qr_code}</td>
                  <td>{siteName(bin.site_id)}</td>
                  <td>{bin.bin_type}</td>
                  <td>{bin.volume_liters}</td>
                  <td>{bin.lat.toFixed(5)}</td>
                  <td>{bin.lng.toFixed(5)}</td>
                  <td>
                    <button className="secondary" onClick={() => void downloadQr(bin)}>
                      {t("downloadQr")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function SiteForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [siteType, setSiteType] = useState("estate");
  const [ward, setWard] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await api("/api/v1/sites", {
      method: "POST",
      body: JSON.stringify({ name, site_type: siteType, ward: ward || null }),
    });
    setName("");
    setWard("");
    await onCreated();
  }

  return (
    <form className="card form" onSubmit={(e) => void onSubmit(e)}>
      <h2>{t("newSite")}</h2>
      <label>
        {t("name")}
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        {t("siteType")}
        <select value={siteType} onChange={(e) => setSiteType(e.target.value)}>
          {["estate", "school", "market", "business", "public"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <label>
        {t("ward")}
        <input value={ward} onChange={(e) => setWard(e.target.value)} />
      </label>
      <button className="primary" type="submit">
        {t("create")}
      </button>
    </form>
  );
}

function BinForm({ sites, onCreated }: { sites: Site[]; onCreated: () => Promise<void> }) {
  const { t } = useI18n();
  const [siteId, setSiteId] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [volume, setVolume] = useState("240");
  const [binType, setBinType] = useState("standard");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await api("/api/v1/bins", {
      method: "POST",
      body: JSON.stringify({
        site_id: siteId,
        lat: Number(lat),
        lng: Number(lng),
        volume_liters: Number(volume),
        bin_type: binType,
      }),
    });
    setLat("");
    setLng("");
    await onCreated();
  }

  return (
    <form className="card form" onSubmit={(e) => void onSubmit(e)}>
      <h2>{t("newBin")}</h2>
      <label>
        {t("site")}
        <select value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
          <option value="" disabled>
            —
          </option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("lat")}
        <input value={lat} onChange={(e) => setLat(e.target.value)} required inputMode="decimal" />
      </label>
      <label>
        {t("lng")}
        <input value={lng} onChange={(e) => setLng(e.target.value)} required inputMode="decimal" />
      </label>
      <label>
        {t("volume")}
        <input
          value={volume}
          onChange={(e) => setVolume(e.target.value)}
          required
          inputMode="numeric"
        />
      </label>
      <label>
        {t("binType")}
        <input value={binType} onChange={(e) => setBinType(e.target.value)} required />
      </label>
      <button className="primary" type="submit">
        {t("create")}
      </button>
    </form>
  );
}
