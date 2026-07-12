import { useCallback, useEffect, useState } from "react";
import { t, type Lang, type StringKey } from "../i18n";
import { fetchCollectList, markCollected, type BinHealth } from "../lib/collect";

type Load = { kind: "loading" } | { kind: "error" } | { kind: "ok"; bins: BinHealth[] };

export default function CollectList({ lang, token }: { lang: Lang; token: string }) {
  const tr = (key: StringKey, vars?: Record<string, string | number>) => t(lang, key, vars);
  const [state, setState] = useState<Load>({ kind: "loading" });

  const reload = useCallback(async () => {
    if (!token) return setState({ kind: "error" });
    try {
      setState({ kind: "ok", bins: await fetchCollectList(token) });
    } catch {
      setState({ kind: "error" });
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function collect(bin: BinHealth) {
    await markCollected(token, bin.bin_id);
    await reload();
  }

  if (state.kind === "loading") return <p className="gps">{tr("loading")}</p>;
  if (state.kind === "error") return <p className="warning">{tr("collectOffline")}</p>;
  if (state.bins.length === 0) return <p className="gps">{tr("collectNone")}</p>;

  return (
    <ul className="collect-list">
      {state.bins.map((bin) => (
        <li key={bin.bin_id} className="collect-row">
          <div className="collect-info">
            <span className="collect-bin">
              <span className={`ring ring-${bin.overflow_risk}`} aria-hidden />
              {bin.site_name} · {bin.qr_code}
            </span>
            <span className="collect-sub">
              {Math.round(bin.fill_pct)}% ·{" "}
              {bin.recommendation === "collect_today" ? tr("collectNow") : tr("collectSoon")}
            </span>
          </div>
          <button className="primary collect-btn" onClick={() => void collect(bin)}>
            {tr("done")}
          </button>
        </li>
      ))}
    </ul>
  );
}
