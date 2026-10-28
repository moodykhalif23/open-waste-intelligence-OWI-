import { DEPOT, MAP_VIEW, ROUTE_PLANS } from "./map-data";

type Step = { at: number; tap?: string; view?: string; on?: string; off?: string; emit?: string };
type Scene = { view: string; beat: number; dur: number; flags?: string; steps?: Step[] };
type Point = [number, number];

const TAP_TRAVEL = 420;
const TAP_PRESS = 140;
const BEAT_HOLD = 1600;

const FIELD: Scene[] = [
  { view: "home", beat: 0, dur: 1500, steps: [{ at: 300, tap: "scan", view: "scan" }] },
  { view: "scan", beat: 0, dur: 2400, steps: [{ at: 1200, on: "qrlock" }] },
  { view: "home", beat: 1, flags: "linked", dur: 1500, steps: [{ at: 300, tap: "photo", view: "camera" }] },
  { view: "camera", beat: 1, flags: "linked", dur: 1900, steps: [{ at: 500, tap: "shutter", on: "flash" }, { at: 1300, off: "flash" }] },
  {
    view: "staged",
    beat: 2,
    flags: "linked",
    dur: 2700,
    steps: [{ at: 400, tap: "fill-high", on: "fill" }, { at: 1500, tap: "save", view: "home", off: "linked", on: "offline queued toast-saved" }],
  },
  { view: "home", beat: 3, flags: "offline queued toast-saved", dur: 2000, steps: [{ at: 1500, off: "toast-saved" }] },
  {
    view: "home",
    beat: 3,
    flags: "offline queued",
    dur: 2600,
    steps: [
      { at: 300, off: "offline" },
      { at: 700, tap: "send", on: "sending" },
      { at: 1500, off: "sending queued", on: "sent toast-sync", emit: "owi:sync" },
      { at: 2400, off: "toast-sync" },
    ],
  },
  {
    view: "home",
    beat: 4,
    flags: "sent",
    dur: 4000,
    steps: [
      { at: 200, tap: "tab-collect", view: "collect" },
      { at: 1100, tap: "start", on: "tracking" },
      { at: 1800, tap: "done1", on: "d1" },
      { at: 2500, tap: "done2", on: "d2" },
      { at: 3200, tap: "done3", on: "d3" },
    ],
  },
  {
    view: "collect",
    beat: 4,
    flags: "sent tracking d1 d2 d3",
    dur: 3400,
    steps: [{ at: 200, tap: "complete", on: "dlg" }, { at: 1800, tap: "dlg-ok", off: "dlg", on: "completed" }],
  },
];

const OPS: Scene[] = [
  { view: "overview", beat: 0, dur: 3600, steps: [{ at: 1600, on: "ping" }] },
  {
    view: "overview",
    beat: 1,
    flags: "ping",
    dur: 4200,
    steps: [{ at: 100, tap: "nav-collect", view: "collect", off: "ping" }, { at: 2200, tap: "chip-high", on: "high" }],
  },
  {
    view: "collect",
    beat: 2,
    dur: 5000,
    steps: [
      { at: 200, tap: "nav-routes", view: "routes", off: "high" },
      { at: 1300, tap: "plan", on: "dlg" },
      { at: 3500, tap: "plan-go", off: "dlg", on: "planned toast" },
    ],
  },
  {
    view: "routes",
    beat: 3,
    flags: "planned toast",
    dur: 4400,
    steps: [{ at: 1000, off: "toast" }, { at: 1400, tap: "route-ink", on: "focus" }, { at: 3800, off: "focus" }],
  },
  {
    view: "routes",
    beat: 4,
    flags: "planned",
    dur: 4800,
    steps: [{ at: 400, tap: "breakdown", on: "replan toast" }, { at: 3200, off: "toast" }],
  },
  { view: "routes", beat: 5, flags: "planned replan", dur: 5000, steps: [{ at: 300, tap: "calc", on: "scrolled" }] },
  {
    view: "routes",
    beat: 6,
    flags: "planned replan scrolled",
    dur: 6600,
    steps: [{ at: 100, tap: "nav-intel", view: "intel", off: "scrolled" }, { at: 3300, tap: "tab-dumping", on: "dumping" }],
  },
  {
    view: "intel",
    beat: 7,
    flags: "dumping",
    dur: 7000,
    steps: [
      { at: 100, tap: "nav-records", view: "records", off: "dumping" },
      { at: 1700, tap: "pick-paper", on: "corrected" },
      { at: 4200, tap: "tab-bins", on: "bins" },
    ],
  },
];

function binScene(cls: string, crop = false): string {
  const viewBox = crop ? "40 70 220 165" : "0 0 300 400";
  return `<svg class="${cls}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="${cls}-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a8f99"/><stop offset="1" stop-color="#6c727d"/></linearGradient>
      <linearGradient id="${cls}-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b6170"/><stop offset="1" stop-color="#3b404b"/></linearGradient>
      <linearGradient id="${cls}-body" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#16704a"/><stop offset=".55" stop-color="#22915f"/><stop offset="1" stop-color="#145f40"/></linearGradient>
      <radialGradient id="${cls}-sh" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="300" height="400" fill="url(#${cls}-wall)"/>
    <rect x="200" y="40" width="70" height="90" rx="4" fill="#9ba1ab"/><rect x="206" y="46" width="58" height="78" rx="2" fill="#4c5361"/>
    <rect y="262" width="300" height="138" fill="url(#${cls}-ground)"/>
    <rect y="258" width="300" height="8" fill="#9aa0aa"/>
    <ellipse cx="150" cy="318" rx="92" ry="14" fill="url(#${cls}-sh)"/>
    <path d="M96 150 H204 L196 304 Q195 312 187 312 H113 Q105 312 104 304 Z" fill="url(#${cls}-body)"/>
    <path d="M112 168 L116 296 M188 168 L184 296" stroke="#0f5638" stroke-width="3" stroke-linecap="round" opacity=".6"/>
    <rect x="128" y="196" width="44" height="44" rx="4" fill="#f8f6f0"/>
    <path d="M134 202h12v12h-12zM154 202h12v12h-12zM134 222h12v12h-12zM156 224h4v4h-4zM162 230h4v4h-4zM154 232h4v4h-4z" fill="#101828"/>
    <circle cx="116" cy="314" r="13" fill="#101828"/><circle cx="116" cy="314" r="5" fill="#3a4256"/>
    <circle cx="184" cy="314" r="13" fill="#101828"/><circle cx="184" cy="314" r="5" fill="#3a4256"/>
    <ellipse cx="128" cy="134" rx="34" ry="24" fill="#2a2f3a"/><path d="M122 112 q6 -10 12 0" stroke="#2a2f3a" stroke-width="5" fill="none"/>
    <ellipse cx="170" cy="128" rx="30" ry="26" fill="#f2b949"/><ellipse cx="162" cy="120" rx="10" ry="6" fill="#f7ce77"/>
    <ellipse cx="196" cy="142" rx="20" ry="14" fill="#e9e6df"/>
    <g transform="rotate(-9 92 148)"><rect x="86" y="140" width="126" height="18" rx="6" fill="#0f5638"/><rect x="140" y="134" width="22" height="8" rx="3" fill="#0b4a30"/></g>
    <ellipse cx="62" cy="330" rx="10" ry="5" fill="#f2b949"/><rect x="236" y="336" width="18" height="7" rx="3" fill="#e9e6df" transform="rotate(14 245 340)"/>
  </svg>`;
}

function qrSvg(): string {
  const n = 21;
  let seed = 142;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const finder = (x: number, y: number, gx: number, gy: number) => {
    const dx = gx - x;
    const dy = gy - y;
    if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return null;
    return Math.max(Math.abs(dx - 3), Math.abs(dy - 3)) !== 2;
  };
  let d = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const f = finder(0, 0, x, y) ?? finder(14, 0, x, y) ?? finder(0, 14, x, y);
      const sep = (x === 7 && y < 8) || (y === 7 && x < 8) || (x === 13 && y < 8) || (y === 7 && x > 12) || (y === 13 && x < 8) || (x === 7 && y > 12);
      if (f ?? (sep ? false : rand() > 0.52)) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return `<svg class="qr" viewBox="-2 -2 25 25" shape-rendering="crispEdges" aria-hidden="true"><rect x="-2" y="-2" width="25" height="25" fill="#fff"/><path d="${d}" fill="#101828"/></svg>`;
}

function slabs(n: number): string {
  return Array.from({ length: n }, (_, i) => `<i class="slab" style="--z:${i + 1}"></i>`).join("");
}

const FILL_BANDS: [string, string][] = [
  ["empty", "Empty"],
  ["low", "Low"],
  ["half", "Half"],
  ["high", "High"],
  ["overflowing", "Overflowing"],
];

function phoneScreen(): string {
  const fills = FILL_BANDS.map(([key, label]) => `<span class="ph-fill ph-fill-${key}" data-hit="fill-${key}">${label}</span>`).join("");
  const stops: [string, string, boolean][] = [
    ["BIN-0142", "Market gate", true],
    ["BIN-0087", "School east", true],
    ["BIN-0213", "Estate block C", true],
    ["BIN-0031", "Bus stage", false],
    ["BIN-0064", "Clinic road", false],
    ["BIN-0118", "Stage 2 kiosk", false],
  ];
  const stopRows = stops
    .map(
      ([code, site, hot], i) => `<li class="ph-stop" data-mark="d${i + 1}">
        <span class="ph-stop-t"><b>${code}</b><span>${site}</span></span>
        <span class="ph-tag ${hot ? "ph-tag-hot" : ""}">${hot ? "Collect now" : "Soon"}</span>
        <span class="ph-done" data-hit="done${i + 1}"><span data-when="!d${i + 1}">Done</span><i class="fa-solid fa-circle-check" data-when="d${i + 1}"></i></span>
      </li>`,
    )
    .join("");
  const recent: [string, string, string][] = [
    ["BIN-0139", "Half", "07:31"],
    ["BIN-0136", "Low", "07:22"],
    ["BIN-0131", "Overflowing", "07:10"],
  ];
  const recentRows = recent
    .map(([code, band, time]) => `<div class="ph-row"><span class="ph-thumb"></span><b>${code}</b><span>${band}</span><time>${time}</time></div>`)
    .join("");

  return `
  <div class="ph-status">
    <span>07:42</span>
    <span class="ph-punch"></span>
    <span class="ph-sys"><i class="fa-solid fa-wifi" data-when="!offline"></i><i class="fa-solid fa-signal"></i><i class="fa-solid fa-battery-three-quarters"></i></span>
  </div>
  <div class="ph-bar">
    <img src="/icon.svg" alt="" class="ph-logo" />
    <b>OWI Field Report</b>
    <span class="ph-net"><i class="fa-solid fa-circle"></i><span data-when="!offline">Online</span><span data-when="offline">Offline</span></span>
    <i class="fa-solid fa-gear ph-gear"></i>
  </div>
  <div class="ph-body">
    <section class="v v-home">
      <p class="ph-date" data-today></p>
      <span class="ph-chip" data-when="linked"><i class="fa-solid fa-qrcode"></i> Bin BIN-0142</span>
      <div class="ph-hero" data-hit="photo">
        <span class="ph-hero-icon"><i class="fa-solid fa-camera"></i></span>
        <b>Take photo</b>
        <span>Photo, then fill level &mdash; about 20 seconds</span>
      </div>
      <div class="ph-btn ph-btn-line" data-hit="scan"><i class="fa-solid fa-qrcode"></i> Scan bin QR</div>
      <div class="ph-stats">
        <div class="ph-stat">
          <span class="ph-stat-h">Waiting to send <i class="fa-solid fa-cloud-arrow-up"></i></span>
          <b><em data-when="!queued">0</em><em data-when="queued">1</em></b>
          <span class="ph-send" data-hit="send" data-when="queued"><span data-when="!sending">Send now</span><span data-when="sending">Sending&hellip;</span></span>
        </div>
        <div class="ph-stat">
          <span class="ph-stat-h">Sent today <i class="fa-solid fa-circle-check"></i></span>
          <b><em data-when="!sent">12</em><em data-when="sent">13</em></b>
        </div>
      </div>
      <div class="ph-list">
        <p class="ph-list-h">Sent reports</p>
        <div class="ph-row ph-row-new" data-when="sent"><span class="ph-thumb"></span><b>BIN-0142</b><span>High</span><time>07:43</time></div>
        ${recentRows}
      </div>
    </section>

    <section class="v v-scan">
      <div class="ph-video">
        <div class="ph-qr">${qrSvg()}</div>
        <span class="ph-scanline"></span>
        <span class="ph-lock" data-when="qrlock"><i class="fa-solid fa-check"></i> BIN-0142</span>
      </div>
      <div class="ph-field"><span>Or type the bin code</span></div>
      <div class="ph-actions ph-actions-scan">
        <span class="ph-btn ph-btn-line">Cancel</span>
        <span class="ph-btn ph-btn-off">OK</span>
      </div>
    </section>

    <section class="v v-staged">
      <span class="ph-chip"><i class="fa-solid fa-qrcode"></i> Bin BIN-0142</span>
      <div class="ph-shot">${binScene("ph-shot-art", true)}</div>
      <p class="ph-gps">GPS &plusmn;6 m</p>
      <p class="ph-q">How full is the bin?</p>
      <div class="ph-fills">${fills}</div>
      <div class="ph-actions">
        <span class="ph-btn ph-btn-line">Retake</span>
        <span class="ph-btn ph-btn-ink" data-hit="save">Save report</span>
      </div>
    </section>

    <section class="v v-collect">
      <div class="ph-route">
        <div class="ph-route-h"><b>Truck 1</b><span class="ph-tag">Truck</span><span class="ph-route-n">6 stops</span></div>
        <span class="ph-btn ph-btn-ink" data-hit="start" data-when="!tracking"><i class="fa-solid fa-play"></i> Start route</span>
        <p class="ph-track" data-when="tracking !completed"><i class="ph-live"></i> Route in progress &middot; 3.42 km</p>
        <span class="ph-btn ph-btn-line" data-hit="complete" data-when="tracking !completed">Complete route</span>
        <p class="ph-track ph-track-done" data-when="completed"><i class="fa-solid fa-flag-checkered"></i> GPS 9.6 km &middot; 2.5 L &middot; 1,240 kg</p>
        <ol class="ph-stops">${stopRows}</ol>
      </div>
    </section>
  </div>
  <nav class="ph-tabs">
    <span class="ph-tab t-report"><i class="fa-solid fa-camera"></i>Report</span>
    <span class="ph-tab t-collect" data-hit="tab-collect"><i class="fa-solid fa-truck"></i>Collect</span>
    <span class="ph-tab"><i class="fa-solid fa-chart-line"></i>Insights</span>
  </nav>
  <div class="ph-gesture"><i></i></div>

  <section class="v v-camera">
    <div class="cam-top"><i class="fa-solid fa-bolt"></i><i class="fa-solid fa-sliders"></i></div>
    <div class="cam-view">${binScene("cam-art")}<span class="cam-grid"></span><span class="ph-flash" data-when="flash"></span></div>
    <div class="cam-modes"><span>Video</span><span class="cam-mode-on">Photo</span><span>Portrait</span></div>
    <div class="cam-ctl">
      <span class="cam-thumb"></span>
      <span class="cam-shutter" data-hit="shutter"></span>
      <span class="cam-flip"><i class="fa-solid fa-rotate"></i></span>
    </div>
    <div class="ph-gesture ph-gesture-dark"><i></i></div>
  </section>`;
}

function phoneFloat(): string {
  return `
  <div class="ft ft-toast" data-when="toast-saved">Saved to queue</div>
  <div class="ft ft-toast" data-when="toast-sync">All reports sent</div>
  <div class="ft ph-dlg" data-when="dlg">
    <b>Complete route</b>
    <p>Enter the fuel used and weighed waste collected.</p>
    <label><span>GPS distance (km)</span><em>9.6</em></label>
    <label><span>Fuel used (L)</span><em>2.5</em></label>
    <label><span>Weighed waste (kg)</span><em>1,240</em></label>
    <div class="ph-dlg-a"><span>Cancel</span><span class="ph-dlg-ok" data-hit="dlg-ok">Complete route</span></div>
  </div>
  <span class="cursor cursor-tap"></span>`;
}

function realMap(cls: string, overlay: string): string {
  return `<div class="d-map ${cls}">
    <img class="d-map-base" src="/maps/dandora.svg" alt="" />
    <svg class="d-map-over" viewBox="0 0 ${MAP_VIEW.w} ${MAP_VIEW.h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${overlay}</svg>
    <span class="d-map-credit">&copy; OpenStreetMap contributors</span>
  </div>`;
}

function routeOverlay(): string {
  const lines = (plan: "a" | "b") =>
    Object.entries(ROUTE_PLANS[plan])
      .map(([c, r], k) => `<path class="rt rt-${plan} c-${c}" style="--k:${k}" pathLength="1" d="${r.d}"/>`)
      .join("");
  const owner = new Map<string, [string, string]>();
  const key = (p: readonly number[]) => `${p[0]},${p[1]}`;
  for (const [c, r] of Object.entries(ROUTE_PLANS.a)) for (const s of r.stops) owner.set(key(s), [c, c]);
  for (const [c, r] of Object.entries(ROUTE_PLANS.b)) {
    for (const s of r.stops) {
      const prev = owner.get(key(s));
      owner.set(key(s), [prev ? prev[0] : c, c]);
    }
  }
  const stops = [...owner.entries()]
    .map(([k, [a, b]]) => {
      const [x, y] = k.split(",");
      return `<circle class="st st-${a} st-to-${b}" cx="${x}" cy="${y}" r="15"/>`;
    })
    .join("");
  return `${lines("a")}${lines("b")}${stops}<rect class="depot" x="${DEPOT[0] - 18}" y="${DEPOT[1] - 18}" width="36" height="36" rx="8"/>`;
}

const HOTSPOTS: [number, number, number][] = [
  [470, 300, 14],
  [905, 455, 9],
  [1215, 330, 6],
  [690, 760, 4],
];

function hotspotOverlay(): string {
  return HOTSPOTS.map(
    ([x, y, n]) => `<g class="hot"><circle cx="${x}" cy="${y}" r="${40 + n * 5}"/><circle class="hot-core" cx="${x}" cy="${y}" r="20"/><text x="${x}" y="${y}">${n}</text></g>`,
  ).join("");
}

function sparkline(values: number[]): string {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / (max - min || 1)) * 24}`).join(" ");
  return `<svg class="d-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"/></svg>`;
}

function areaChart(values: number[]): string {
  const max = Math.max(...values) * 1.15;
  const xy = values.map((v, i) => [(i / (values.length - 1)) * 600, 180 - (v / max) * 170] as const);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return `<svg class="d-area" viewBox="0 0 600 180" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="d-area-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2b949" stop-opacity=".35"/><stop offset="1" stop-color="#f2b949" stop-opacity="0"/></linearGradient></defs>
    <path class="d-grid" d="M0 45H600M0 90H600M0 135H600"/>
    <polygon points="0,180 ${line} 600,180" fill="url(#d-area-fill)"/>
    <polyline class="d-area-line" points="${line}" pathLength="1"/>
  </svg>`;
}

const REPORTS_PER_DAY = [1480, 1620, 1710, 1590, 1840, 1210, 980, 1520, 1690, 1760, 1810, 1930, 1340, 1060];

const DUE: [string, string, number, string, string][] = [
  ["BIN-0142", "Market gate", 100, "High", "0"],
  ["BIN-0087", "School east", 92, "High", "0.5"],
  ["BIN-0213", "Estate block C", 88, "High", "0.5"],
  ["BIN-0031", "Bus stage", 74, "Medium", "1.5"],
  ["BIN-0064", "Clinic road", 68, "Medium", "2"],
  ["BIN-0118", "Stage 2 kiosk", 63, "Medium", "2.5"],
  ["BIN-0009", "Chief's camp", 61, "Medium", "3"],
];

const BINS: [string, string, string, string][] = [
  ["BIN-0001", "Dandora Phase 1 gate", "Ward 1", "2 h ago"],
  ["BIN-0002", "Dandora Phase 1 market", "Ward 1", "5 h ago"],
  ["BIN-0003", "Kamunde Rd clinic", "Ward 2", "1 d ago"],
  ["BIN-0004", "Baba Dogo bus stage", "Ward 3", "3 h ago"],
  ["BIN-0005", "Komarock shops", "Ward 4", "6 h ago"],
  ["BIN-0006", "Outer Ring junction", "Ward 2", "2 d ago"],
  ["BIN-0007", "Kariobangi North school", "Ward 5", "4 h ago"],
  ["BIN-0008", "Dandora Phase 2 clinic", "Ward 1", "1 h ago"],
  ["BIN-0009", "Chief's camp", "Ward 3", "7 h ago"],
];

const MATERIALS: [string, number][] = [
  ["Plastic", 34],
  ["Organic", 27],
  ["Paper", 14],
  ["Glass", 9],
  ["Metal", 6],
  ["Other", 10],
];

function dashScreen(): string {
  const nav: [string, string, string][] = [
    ["overview", "fa-table-cells-large", "Overview"],
    ["collect", "fa-list-check", "Collect today"],
    ["routes", "fa-route", "Routes"],
    ["intel", "fa-chart-line", "Intelligence"],
    ["records", "fa-box-archive", "Records"],
    ["", "fa-user-gear", "Admin"],
  ];
  const navItems = nav
    .map(([key, icon, label]) => `<span class="d-nav ${key ? `d-nav-${key}` : ""}" ${key ? `data-hit="nav-${key}"` : ""}><i class="fa-solid ${icon}"></i>${label}</span>`)
    .join("");
  const riskTag = (risk: string) => `<span class="d-tag d-risk-${risk.toLowerCase()}">${risk}</span>`;
  const dueRows = DUE.map(
    ([code, site, pct, risk, days], i) => `<div class="d-tr ${risk === "High" ? "is-high" : ""}" style="--i:${i}">
      <b>${code}</b><span>${site}</span><span class="d-fill"><span class="d-meter"><i style="width:${pct}%"></i></span>${pct}%</span>
      <span class="d-num">${days} d</span>${riskTag(risk)}
    </div>`,
  ).join("");
  const binRows = BINS.map(
    ([code, site, ward, seen], i) => `<div class="d-tr d-tr-bins" style="--i:${i}"><b>${code}</b><span>${site}</span><span>${ward}</span><span class="d-num">${seen}</span></div>`,
  ).join("");
  const materials = MATERIALS.map(
    ([name, pct], i) => `<div class="d-hbar" style="--v:${pct};--i:${i}"><span>${name}</span><i><b></b></i><em>${pct}%</em></div>`,
  ).join("");
  const reviewCards = (
    [
      ["Plastic", 41, ["Plastic", "Paper", "Glass"]],
      ["Organic", 58, ["Organic", "Paper", "Other"]],
      ["Metal", 47, ["Metal", "Plastic", "Glass"]],
      ["Glass", 52, ["Glass", "Plastic", "Other"]],
      ["Paper", 44, ["Paper", "Plastic", "Organic"]],
      ["Plastic", 49, ["Plastic", "Metal", "Other"]],
    ] as [string, number, string[]][]
  )
    .map(
      ([guess, conf, options], i) => `<div class="d-rev ${i === 0 ? "d-rev-first" : ""}">
        <div class="d-rev-img">${binScene(`d-rev-art${i}`, true)}</div>
        <div class="d-rev-body">
          <span class="d-rev-model">Model: <b>${guess}</b> &middot; ${conf}%</span>
          <div class="d-rev-opts">${options
            .map((o, k) => `<span class="d-opt ${k === 0 ? "d-opt-guess" : ""} ${i === 0 && o === "Paper" ? "d-opt-fix" : ""}" ${i === 0 && o === "Paper" ? 'data-hit="pick-paper"' : ""}>${o}</span>`)
            .join("")}</div>
          ${i === 0 ? '<span class="d-rev-done" data-when="corrected"><i class="fa-solid fa-check"></i> Corrected to Paper</span>' : ""}
        </div>
      </div>`,
    )
    .join("");
  const routeRow = (c: string, name: string, method: string, a: string, b: string, hit: string, breakdownHit = "") => `
    <div class="d-route d-route-${c}" data-hit="${hit}">
      <span class="d-sw"></span>
      <span class="d-route-t"><b>${name}</b><span>${method}</span></span>
      <span class="d-route-m"><span data-when="!replan">${a}</span><span data-when="replan">${b}</span></span>
      <span class="d-mini" ${breakdownHit ? `data-hit="${breakdownHit}"` : ""}>Breakdown</span>
    </div>`;
  const plan = ROUTE_PLANS;

  return `
  <aside class="d-side">
    <span class="d-brand"><img src="/icon.svg" alt="" />OpenWaste</span>
    <nav class="d-navs">${navItems}</nav>
    <div class="d-today">
      <span class="d-kick">Today</span>
      <span class="d-today-r"><b>17</b>To collect</span>
      <span class="d-today-r"><b>38</b>To review</span>
    </div>
  </aside>
  <div class="d-main">
    <header class="d-top">
      <b class="d-title"><span class="d-t-overview">Overview</span><span class="d-t-collect">Collect today</span><span class="d-t-routes">Routes</span><span class="d-t-intel">Intelligence</span><span class="d-t-records">Records</span></b>
      <span class="d-search"><i class="fa-solid fa-magnifying-glass"></i>Search&hellip;<kbd>Ctrl K</kbd></span>
      <span class="d-range"><i class="fa-solid fa-calendar-days"></i>Last 7 days</span>
      <span class="d-avatar">SC</span>
    </header>
    <div class="d-body">
      <section class="v v-overview">
        <div class="d-kpis">
          <div class="d-card d-kpi"><span class="d-kick">Bins registered</span><b>1,482</b>${sparkline([1390, 1402, 1418, 1430, 1446, 1461, 1482])}</div>
          <div class="d-card d-kpi d-kpi-ping"><span class="d-kick">Reports, last 7 days</span><b><em data-when="!ping">12,406</em><em data-when="ping">12,407</em></b>${sparkline(REPORTS_PER_DAY.slice(7))}</div>
          <div class="d-card d-kpi"><span class="d-kick">Overflowing, last 7 days</span><b class="d-red">214</b>${sparkline([41, 38, 33, 36, 29, 21, 16])}</div>
        </div>
        <div class="d-charts">
          <div class="d-card">
            <p class="d-card-h">Reports per day <span>last 14 days</span></p>
            ${areaChart(REPORTS_PER_DAY)}
            <div class="d-axis"><span>15 Oct</span><span>21 Oct</span><span>Today</span></div>
          </div>
          <div class="d-card">
            <p class="d-card-h">Fill level mix <span>latest per bin</span></p>
            <div class="d-stack"><i style="--v:12" class="b0"></i><i style="--v:23" class="b1"></i><i style="--v:31" class="b2"></i><i style="--v:22" class="b3"></i><i style="--v:12" class="b4"></i></div>
            <ul class="d-legend">
              <li><i class="b0"></i>Empty<b>178</b></li><li><i class="b1"></i>Low<b>341</b></li><li><i class="b2"></i>Half<b>459</b></li><li><i class="b3"></i>High<b>326</b></li><li><i class="b4"></i>Overflowing<b>178</b></li>
            </ul>
          </div>
        </div>
        <div class="d-card d-feed">
          <p class="d-card-h">Latest reports <span>live from the field</span></p>
          <div class="d-feed-row d-feed-new" data-when="ping"><span class="ph-thumb"></span><b>BIN-0142</b><span>Market gate</span><span class="d-tag d-risk-high">High</span><span>Truck 1 crew</span><time>just now</time></div>
          <div class="d-feed-row"><span class="ph-thumb"></span><b>BIN-0139</b><span>Kamunde Rd clinic</span><span class="d-tag d-risk-medium">Half</span><span>Ward 2 crew</span><time>2 min</time></div>
          <div class="d-feed-row"><span class="ph-thumb"></span><b>BIN-0136</b><span>Baba Dogo bus stage</span><span class="d-tag d-risk-low">Low</span><span>Ward 3 crew</span><time>4 min</time></div>
          <div class="d-feed-row" data-when="!ping"><span class="ph-thumb"></span><b>BIN-0131</b><span>Komarock shops</span><span class="d-tag d-risk-high">Overflowing</span><span>Ward 4 crew</span><time>6 min</time></div>
        </div>
      </section>

      <section class="v v-collect">
        <div class="d-toolbar">
          <span class="d-chip d-chip-all">All <b>17</b></span>
          <span class="d-chip d-chip-high" data-hit="chip-high">High <b>3</b></span>
          <span class="d-chip">Medium <b>14</b></span>
          <span class="d-field"><i class="fa-solid fa-magnifying-glass"></i>Search bins or sites</span>
        </div>
        <div class="d-card d-table">
          <div class="d-th"><span>Bin</span><span>Site</span><span>Fill</span><span>Full in</span><span>Risk</span></div>
          ${dueRows}
          <div class="d-pager"><span data-when="!high">1&ndash;7 of 17</span><span data-when="high">1&ndash;3 of 3</span><span class="d-pager-btns"><i class="fa-solid fa-chevron-left"></i><i class="fa-solid fa-chevron-right"></i></span></div>
        </div>
      </section>

      <section class="v v-routes">
        <div class="d-scroll">
          <div class="d-head">
            <span class="d-stat"><span class="d-kick">Bins to collect</span><b>17</b></span>
            <span class="d-stat"><span class="d-kick">Planned km</span><b><em data-when="!planned">&mdash;</em><em data-when="planned !replan">${(plan.a.ink.km + plan.a.gold.km + plan.a.green.km).toFixed(1)}</em><em data-when="replan">${(plan.b.ink.km + plan.b.green.km).toFixed(1)}</em></b></span>
            <span class="d-stat"><span class="d-kick">Planned fuel (L)</span><b><em data-when="!planned">&mdash;</em><em data-when="planned !replan">5.0</em><em data-when="replan">6.7</em></b></span>
            <span class="d-btn d-btn-line" data-hit="calc">Calculate savings</span>
            <span class="d-btn d-btn-ink" data-hit="plan">Plan today</span>
          </div>
          <div class="d-split">
            ${realMap("d-map-routes", routeOverlay())}
            <div class="d-card d-routes">
              <p class="d-card-h">Today&rsquo;s routes</p>
              <p class="d-empty" data-when="!planned">No routes yet. Plan today to assign the due bins.</p>
              <div class="d-route-list" data-when="planned">
                ${routeRow("ink", "Truck 1", "Truck", `6 stops &middot; ${plan.a.ink.km} km`, `8 stops &middot; ${plan.b.ink.km} km`, "route-ink")}
                ${routeRow("gold", "Tuk-tuk 1", "Tuk-tuk", `5 stops &middot; ${plan.a.gold.km} km`, "Out of service", "route-gold", "breakdown")}
                ${routeRow("green", "Truck 2", "Truck", `6 stops &middot; ${plan.a.green.km} km`, `9 stops &middot; ${plan.b.green.km} km`, "route-green")}
              </div>
            </div>
          </div>
          <div class="d-split d-split-even">
            <div class="d-card">
              <p class="d-card-h">Savings vs fixed schedule</p>
              <p class="d-big"><b>41%</b> less distance per tonne</p>
              <div class="d-cmp">
                <span></span><span class="d-kick">Fixed sweep</span><span class="d-kick">Need-driven</span>
                <span>Bins visited</span><b>42</b><b>17</b>
                <span>Distance (km)</span><b>38.5</b><b>24.2</b>
                <span>km per tonne</span><b>18.8</b><b>11.0</b>
              </div>
            </div>
            <div class="d-card">
              <p class="d-card-h">Measured outcome <span>Truck 1</span></p>
              <div class="d-meas">
                <span>Distance (km)</span><b>9.6</b><em>planned ${plan.a.ink.km}</em>
                <span>Fuel (L)</span><b>2.5</b><em>planned 2.3</em>
                <span>Weighed waste (kg)</span><b>1,240</b><em>at the depot</em>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="v v-intel">
        <div class="d-tabs">
          <span class="d-tab-composition">Composition</span><span>Recycling</span><span>Carbon</span><span>Cleanliness</span><span>Coverage</span><span class="d-tab-dumping" data-hit="tab-dumping">Dumping</span>
        </div>
        <div class="d-pane d-pane-composition">
          <div class="d-card">
            <p class="d-card-h">Material mix <span>last 30 days &middot; 48,210 photos</span></p>
            <div class="d-hbars">${materials}</div>
          </div>
          <div class="d-tiles">
            <div class="d-card d-tile"><span class="d-kick">Recovered value</span><b>KES 412k</b><em>estimated, from configured prices</em></div>
            <div class="d-card d-tile"><span class="d-kick">CO2e avoided</span><b>18.4 t</b><em>method-versioned estimate</em></div>
            <div class="d-card d-tile"><span class="d-kick">Human-reviewed</span><b>92%</b><em>of low-confidence photos</em></div>
          </div>
        </div>
        <div class="d-pane d-pane-dumping">
          ${realMap("d-map-hot", hotspotOverlay())}
          <div class="d-card d-hot-list">
            <p class="d-card-h">Confirmed hotspots</p>
            <div class="d-hot-row"><b>14</b><span>Baba Dogo river crossing</span></div>
            <div class="d-hot-row"><b>9</b><span>Kamunde Rd market</span></div>
            <div class="d-hot-row"><b>6</b><span>Komarock shops</span></div>
            <div class="d-hot-row"><b>4</b><span>Outer Ring service lane</span></div>
          </div>
        </div>
      </section>

      <section class="v v-records">
        <div class="d-tabs">
          <span class="d-tab-bins" data-hit="tab-bins">Bins <b>1,482</b></span><span>Reports <b>12,406</b></span><span class="d-tab-review">Review <b>38</b></span><span>Volunteers</span>
        </div>
        <div class="d-pane d-pane-review">
          <p class="d-lede">Lowest-confidence predictions first. Tap the right label; the highlighted one is the model&rsquo;s guess.</p>
          <div class="d-revs">${reviewCards}</div>
        </div>
        <div class="d-pane d-pane-bins">
          <div class="d-toolbar"><span class="d-field d-field-wide"><i class="fa-solid fa-magnifying-glass"></i>Search 1,482 bins by code, site or ward</span><span class="d-chip">Ward: all</span></div>
          <div class="d-card d-table">
            <div class="d-th d-th-bins"><span>Bin</span><span>Site</span><span>Ward</span><span>Last report</span></div>
            ${binRows}
            <div class="d-pager"><span>1&ndash;9 of 1,482</span><span class="d-pager-btns"><i class="fa-solid fa-chevron-left"></i><i class="fa-solid fa-chevron-right"></i></span></div>
          </div>
        </div>
      </section>
    </div>
  </div>`;
}

function dashFloat(): string {
  const picks = DUE.slice(0, 5)
    .map(([code, site, , risk], i) => `<span class="d-pick" style="--i:${i}"><i class="fa-solid fa-square-check"></i><b>${code}</b><span>${site}</span><span class="d-tag d-risk-${risk.toLowerCase()}">${risk}</span></span>`)
    .join("");
  return `
  <div class="ft d-dlg" data-when="dlg">
    <b>Plan today&rsquo;s collection</b>
    <p>Pick which due bins to include, then plan routes across the available vehicles.</p>
    <div class="d-chips"><span class="d-tag d-tag-gold">3 vehicles</span><span class="d-tag d-tag-line">17 due</span><span class="d-tag d-tag-line">17 selected</span></div>
    <div class="d-picks">${picks}</div>
    <div class="d-dlg-a"><span>Cancel</span><span class="d-btn d-btn-ink" data-hit="plan-go">Plan today &middot; 17</span></div>
  </div>
  <div class="ft ft-toast d-toast" data-when="toast"><i class="fa-solid fa-circle-check"></i> Routes planned on real roads &middot; 17 stops</div>
  <span class="cursor cursor-arrow"><svg viewBox="0 0 14 21" aria-hidden="true"><path d="M1 1 V17.2 L4.9 13.6 L7.6 19.6 L10.2 18.5 L7.6 12.6 H12.8 Z" fill="#000" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/></svg></span>`;
}

function phoneRig(): string {
  return `<div class="bob"><div class="rig rig-phone">
    <div class="phone">
      ${slabs(20)}
      <i class="side-key side-power"></i>
      <i class="side-key side-volume"></i>
      <div class="phone-face"></div>
      <div class="phone-screen screen">${phoneScreen()}</div>
      <div class="phone-float float">${phoneFloat()}</div>
    </div>
    <span class="floor"></span>
  </div></div>`;
}

function laptopRig(): string {
  return `<div class="bob"><div class="rig rig-laptop">
    <div class="lid">
      ${slabs(8)}
      <div class="lid-face"><i class="lid-cam"></i></div>
      <div class="lid-screen screen">${dashScreen()}</div>
      <div class="lid-float float">${dashFloat()}</div>
    </div>
    <div class="base">
      <span class="base-shadow"></span>
      ${slabs(7)}
      <div class="base-face"><span class="keys"></span><span class="pad"></span><span class="notch"></span></div>
    </div>
  </div></div>`;
}

function centerOf(el: HTMLElement, root: HTMLElement): Point {
  let x = el.offsetWidth / 2;
  let y = el.offsetHeight / 2;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return [x, y];
}

function tokens(value?: string): string[] {
  return value ? value.split(/\s+/).filter(Boolean) : [];
}

class Player {
  private timers: number[] = [];
  private index = 0;
  private visible = false;
  private userPaused = false;
  private view = "";
  private flags = new Set<string>();
  private follow = false;
  private currentBeat = -1;
  private lockUntil = 0;
  private beatObserver: IntersectionObserver | null = null;
  private readonly beats: HTMLButtonElement[];
  private readonly cursor: HTMLElement;
  private readonly screen: HTMLElement;
  private readonly float: HTMLElement;
  private readonly toggle: HTMLButtonElement | null;

  constructor(
    private readonly stage: HTMLElement,
    private readonly rig: HTMLElement,
    private readonly scenes: Scene[],
    private readonly reduced: boolean,
  ) {
    this.beats = [...stage.querySelectorAll<HTMLButtonElement>("[data-beat]")];
    this.cursor = rig.querySelector<HTMLElement>(".cursor")!;
    this.screen = rig.querySelector<HTMLElement>(".screen")!;
    this.float = rig.querySelector<HTMLElement>(".float")!;
    this.toggle = stage.querySelector<HTMLButtonElement>("[data-play]");

    this.beats.forEach((btn) => btn.addEventListener("click", () => this.jump(Number(btn.dataset.beat))));
    this.toggle?.addEventListener("click", () => {
      this.userPaused = !this.userPaused;
      this.sync();
    });
    if (reduced) {
      stage.classList.add("is-static");
      this.snap(this.lastSceneOf(0));
      return;
    }
    new IntersectionObserver(
      ([entry]) => {
        this.visible = entry.isIntersecting;
        this.sync();
      },
      { threshold: 0.3 },
    ).observe(rig);
    document.addEventListener("visibilitychange", () => this.sync());
    this.apply(scenes[0].view, new Set(tokens(scenes[0].flags)));
    this.parkCursor();
  }

  private get playing(): boolean {
    return !this.reduced && this.visible && !this.userPaused && !document.hidden;
  }

  private sync(): void {
    const paused = !this.playing;
    this.stage.classList.toggle("is-paused", paused);
    if (this.toggle) {
      this.toggle.setAttribute("aria-pressed", String(this.userPaused));
      this.toggle.querySelector("i")!.className = `fa-solid ${this.userPaused ? "fa-play" : "fa-pause"}`;
      this.toggle.querySelector("span")!.textContent = this.userPaused ? "Play" : "Pause";
    }
    if (paused) this.clear();
    else if (this.timers.length === 0) this.run(this.index);
  }

  private clear(): void {
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(window.setTimeout(fn, ms));
  }

  private firstSceneOf(beat: number): number {
    return this.scenes.findIndex((s) => s.beat === beat);
  }

  private lastSceneOf(beat: number): number {
    let last = 0;
    this.scenes.forEach((s, i) => {
      if (s.beat === beat) last = i;
    });
    return last;
  }

  setFollow(on: boolean): void {
    this.follow = on;
    if (!on || this.beatObserver) return;
    this.beatObserver = new IntersectionObserver(
      (entries) => {
        if (!this.follow || performance.now() < this.lockUntil) return;
        for (const entry of entries) {
          if (entry.isIntersecting) this.activate(Number((entry.target as HTMLElement).dataset.beat));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    this.beats.forEach((btn) => this.beatObserver!.observe(btn));
  }

  private activate(beat: number): void {
    if (beat === this.currentBeat) return;
    if (this.playing) {
      this.clear();
      this.run(this.firstSceneOf(beat));
    } else {
      this.snap(this.lastSceneOf(beat));
    }
  }

  private jump(beat: number): void {
    if (this.follow) {
      this.lockUntil = performance.now() + 1000;
      this.beats[beat]?.scrollIntoView({ block: "center", behavior: this.reduced ? "auto" : "smooth" });
    }
    this.currentBeat = -1;
    this.activate(beat);
  }

  private apply(view: string, flags: Set<string>): void {
    this.view = view;
    this.flags = flags;
    this.rig.dataset.view = view;
    this.rig.dataset.flags = [...flags].join(" ");
    this.rig.querySelectorAll<HTMLElement>("[data-when]").forEach((el) => {
      const ok = tokens(el.dataset.when).every((t) => (t.startsWith("!") ? !flags.has(t.slice(1)) : flags.has(t)));
      el.classList.toggle("on", ok);
    });
    this.rig.querySelectorAll<HTMLElement>("[data-mark]").forEach((el) => {
      el.classList.toggle("marked", flags.has(el.dataset.mark!));
    });
  }

  private change(step: Step): void {
    const next = new Set(this.flags);
    tokens(step.off).forEach((f) => next.delete(f));
    tokens(step.on).forEach((f) => next.add(f));
    this.apply(step.view ?? this.view, next);
    if (step.emit) document.dispatchEvent(new CustomEvent(step.emit));
  }

  private markBeat(i: number): void {
    const scene = this.scenes[i];
    this.currentBeat = scene.beat;
    let offset = 0;
    let total = 0;
    this.scenes.forEach((s, k) => {
      if (s.beat !== scene.beat) return;
      if (k < i) offset += s.dur;
      total += s.dur;
    });
    this.beats.forEach((btn, b) => {
      const active = b === scene.beat;
      btn.classList.toggle("active", active);
      btn.classList.remove("run");
      if (active) {
        btn.setAttribute("aria-current", "step");
        btn.style.setProperty("--beat-ms", `${total}ms`);
        btn.style.setProperty("--beat-offset", `${-offset}ms`);
        void btn.offsetWidth;
        btn.classList.add("run");
      } else {
        btn.removeAttribute("aria-current");
      }
    });
  }

  private place(x: number, y: number): void {
    this.cursor.style.setProperty("--cx", `${x}px`);
    this.cursor.style.setProperty("--cy", `${y}px`);
  }

  private parkCursor(): void {
    this.cursor.classList.remove("press");
    this.place(this.screen.offsetWidth * 0.62, this.screen.offsetHeight * 0.86);
  }

  private moveTo(hit: string): void {
    const target = this.rig.querySelector<HTMLElement>(`[data-hit="${hit}"]`);
    if (!target) return;
    const root = this.float.contains(target) ? this.float : this.screen;
    const [x, y] = centerOf(target, root);
    this.place(x, y);
  }

  private run(i: number): void {
    const scene = this.scenes[i];
    this.index = i;
    this.apply(scene.view, new Set(tokens(scene.flags)));
    this.markBeat(i);
    for (const step of scene.steps ?? []) {
      if (step.tap) {
        this.later(step.at, () => this.moveTo(step.tap!));
        this.later(step.at + TAP_TRAVEL, () => this.cursor.classList.add("press"));
        this.later(step.at + TAP_TRAVEL + TAP_PRESS, () => {
          this.cursor.classList.remove("press");
          this.change(step);
        });
      } else {
        this.later(step.at, () => this.change(step));
      }
    }
    const loop = this.follow && this.scenes[i + 1]?.beat !== scene.beat;
    const next = loop ? this.firstSceneOf(scene.beat) : (i + 1) % this.scenes.length;
    this.later(scene.dur + (loop ? BEAT_HOLD : 0), () => {
      this.timers = [];
      if (next === 0) this.parkCursor();
      this.run(next);
    });
  }

  private snap(i: number): void {
    const scene = this.scenes[i];
    this.index = i;
    this.currentBeat = scene.beat;
    this.apply(scene.view, new Set(tokens(scene.flags)));
    for (const step of scene.steps ?? []) this.change({ ...step, emit: undefined });
    this.beats.forEach((btn, b) => {
      btn.classList.toggle("active", b === scene.beat);
      btn.classList.remove("run");
      if (b === scene.beat) btn.setAttribute("aria-current", "step");
      else btn.removeAttribute("aria-current");
    });
  }
}

function fitRig(scene: HTMLElement, rig: HTMLElement): void {
  const parts = [...rig.querySelectorAll<HTMLElement>(".phone, .lid, .base")];
  const bounds = () => {
    let top = Infinity;
    let bottom = -Infinity;
    let left = Infinity;
    let right = -Infinity;
    for (const el of parts) {
      const r = el.getBoundingClientRect();
      top = Math.min(top, r.top);
      bottom = Math.max(bottom, r.bottom);
      left = Math.min(left, r.left);
      right = Math.max(right, r.right);
    }
    return { top, bottom, left, right };
  };
  const measure = () => {
    rig.style.translate = "";
    rig.style.setProperty("--fit", "1");
    const box = scene.getBoundingClientRect();
    const stage = scene.parentElement?.getBoundingClientRect() ?? box;
    const outerLeft = box.left + box.width / 2 < stage.left + stage.width / 2;
    const spare = Math.min(200, Math.max(0, outerLeft ? box.left - 16 : window.innerWidth - box.right - 16));
    const minX = outerLeft ? box.left - spare : box.left;
    const maxX = outerLeft ? box.right : box.right + spare;
    const pinned = getComputedStyle(scene).position === "sticky";
    let fit = 1;
    for (let pass = 0; pass < 2; pass++) {
      const b = bounds();
      const byWidth = (maxX - minX) / (b.right - b.left);
      const byHeight = pinned ? (box.height * 0.9) / (b.bottom - b.top) : Infinity;
      fit = Math.min(1, fit * Math.min(byWidth, byHeight));
      rig.style.setProperty("--fit", fit.toFixed(3));
    }
    const b = bounds();
    const dx = Math.max(minX - b.left, Math.min(0, maxX - b.right));
    const dy = pinned ? (box.top + box.bottom) / 2 - (b.top + b.bottom) / 2 : 0;
    rig.style.translate = `${Math.round(dx)}px ${Math.round(dy)}px`;
  };
  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(measure);
  };
  schedule();
  window.addEventListener("resize", schedule);
  window.matchMedia("(min-width: 1000px)").addEventListener("change", schedule);
  void document.fonts?.ready.then(schedule);
}

function tilt(scene: HTMLElement, rig: HTMLElement): void {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  scene.addEventListener("pointermove", (e) => {
    const r = scene.getBoundingClientRect();
    rig.style.setProperty("--px", (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
    rig.style.setProperty("--py", (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
  });
  scene.addEventListener("pointerleave", () => {
    rig.style.setProperty("--px", "0");
    rig.style.setProperty("--py", "0");
  });
}

export function mountShowcase(): void {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  document.querySelectorAll<HTMLElement>("[data-stage]").forEach((stage) => {
    const mount = stage.querySelector<HTMLElement>("[data-scene-mount]");
    if (!mount) return;
    const phone = mount.dataset.sceneMount === "phone";
    mount.innerHTML = phone ? phoneRig() : laptopRig();
    mount.setAttribute("role", "img");
    mount.setAttribute(
      "aria-label",
      phone
        ? "Animated field app walkthrough on an Android phone: scan a bin QR code, take a photo, tap the fill level, save offline, sync, then work the collection route."
        : "Animated dashboard walkthrough on a laptop: overview, bins due today, planning routes across vehicles, replanning after a breakdown, and measured savings.",
    );
    mount.querySelectorAll<HTMLElement>("[data-today]").forEach((el) => (el.textContent = today));
    const rig = mount.querySelector<HTMLElement>(".rig")!;
    const player = new Player(stage, rig, phone ? FIELD : OPS, reduced);
    const wide = window.matchMedia("(min-width: 1000px)");
    player.setFollow(wide.matches);
    wide.addEventListener("change", (e) => player.setFollow(e.matches));
    fitRig(mount, rig);
    if (!reduced) tilt(mount, rig);
  });

  const flow = document.querySelector<HTMLElement>("[data-flow]");
  if (flow && !reduced) {
    const runFlow = () => {
      flow.classList.remove("run");
      void flow.offsetWidth;
      flow.classList.add("run");
    };
    document.addEventListener("owi:sync", runFlow);
    new IntersectionObserver(
      ([entry], observer) => {
        if (!entry.isIntersecting) return;
        runFlow();
        observer.disconnect();
      },
      { threshold: 0.6 },
    ).observe(flow);
  }
}
