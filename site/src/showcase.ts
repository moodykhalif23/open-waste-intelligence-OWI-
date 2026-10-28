type Step = { at: number; tap?: string; view?: string; on?: string; off?: string; emit?: string };
type Scene = { view: string; beat: number; dur: number; flags?: string; steps?: Step[] };
type Point = [number, number];

const TAP_TRAVEL = 420;
const TAP_PRESS = 140;

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
  { view: "overview", beat: 0, dur: 3400, steps: [{ at: 1500, on: "ping" }] },
  { view: "overview", beat: 1, flags: "ping", dur: 3400, steps: [{ at: 100, tap: "nav-collect", view: "collect" }] },
  {
    view: "collect",
    beat: 2,
    dur: 4800,
    steps: [
      { at: 200, tap: "nav-routes", view: "routes" },
      { at: 1300, tap: "plan", on: "dlg" },
      { at: 3400, tap: "plan-go", off: "dlg", on: "planned toast" },
    ],
  },
  {
    view: "routes",
    beat: 3,
    flags: "planned toast",
    dur: 4200,
    steps: [{ at: 900, off: "toast" }, { at: 1300, tap: "route-ink", on: "focus" }, { at: 3600, off: "focus" }],
  },
  {
    view: "routes",
    beat: 4,
    flags: "planned",
    dur: 4400,
    steps: [{ at: 400, tap: "breakdown", on: "replan toast" }, { at: 3000, off: "toast" }],
  },
  { view: "routes", beat: 5, flags: "planned replan", dur: 5000, steps: [{ at: 300, tap: "calc", on: "scrolled" }] },
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
        <p class="ph-track ph-track-done" data-when="completed"><i class="fa-solid fa-flag-checkered"></i> GPS 11.8 km &middot; 4.6 L &middot; 1,240 kg</p>
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
    <label><span>GPS distance (km)</span><em>11.8</em></label>
    <label><span>Fuel used (L)</span><em>4.6</em></label>
    <label><span>Weighed waste (kg)</span><em>1,240</em></label>
    <div class="ph-dlg-a"><span>Cancel</span><span class="ph-dlg-ok" data-hit="dlg-ok">Complete route</span></div>
  </div>
  <span class="cursor cursor-tap"></span>`;
}

const HEAT = (() => {
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const rows: number[][] = [];
  for (let d = 0; d < 7; d++) {
    const row: number[] = [];
    for (let h = 0; h < 24; h++) {
      const morning = Math.exp(-((h - 8) ** 2) / 5);
      const afternoon = Math.exp(-((h - 15) ** 2) / 6) * 0.7;
      const weekend = d >= 5 ? 0.45 : 1;
      row.push(Math.min(4, Math.floor(((morning + afternoon) * weekend + rand() * 0.18) * 4.2)));
    }
    rows.push(row);
  }
  return rows;
})();

const DEPOT: Point = [180, 140];
const STOPS: Record<string, Point> = {
  i1: [140, 140], i2: [100, 180], i3: [60, 180], i4: [20, 140], i5: [60, 100], i6: [100, 60],
  g1: [220, 180], g2: [260, 220], g3: [300, 180], g4: [340, 220], g5: [260, 140],
  n1: [180, 100], n2: [220, 60], n3: [260, 20], n4: [300, 60], n5: [340, 20], n6: [380, 100],
};
const PLAN_A: [string, string[]][] = [
  ["ink", ["i1", "i2", "i3", "i4", "i5", "i6"]],
  ["gold", ["g1", "g2", "g3", "g4", "g5"]],
  ["green", ["n1", "n2", "n3", "n4", "n5", "n6"]],
];
const PLAN_B: [string, string[]][] = [
  ["ink", ["g1", "g2", "i2", "i3", "i4", "i5", "i6", "i1"]],
  ["green", ["g5", "g3", "g4", "n6", "n5", "n4", "n3", "n2", "n1"]],
];

function streetPath(ids: string[]): string {
  let d = `M${DEPOT[0]} ${DEPOT[1]}`;
  for (const id of ids) {
    const [x, y] = STOPS[id];
    d += ` H${x} V${y}`;
  }
  return d;
}

function mapSvg(): string {
  const tints = ["#efebe2", "#e9e4d8", "#efebe2", "#e4dfd2"];
  let blocks = "";
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 5; j++) {
      let fill = tints[(i * 3 + j * 5) % tints.length];
      if ((i === 1 && j === 0) || (i === 6 && j === 3)) fill = "#d6e7da";
      if (i === 4 && j === 2) fill = "#fbeecf";
      blocks += `<rect x="${24 + 40 * i}" y="${24 + 40 * j}" width="32" height="32" rx="3" fill="${fill}"/>`;
    }
  }
  const owner: Record<string, [string, string]> = {};
  for (const [c, ids] of PLAN_A) for (const id of ids) owner[id] = [c, c];
  for (const [c, ids] of PLAN_B) for (const id of ids) owner[id] = [owner[id][0], c];
  const lines = (plan: [string, string[]][], cls: string) =>
    plan.map(([c, ids], k) => `<path class="rt ${cls} c-${c}" style="--k:${k}" pathLength="1" d="${streetPath(ids)}"/>`).join("");
  const stops = Object.entries(STOPS)
    .map(([id, [x, y]]) => {
      const [a, b] = owner[id];
      return `<circle class="st st-${a} st-to-${b}" cx="${x}" cy="${y}" r="5"/>`;
    })
    .join("");
  return `<svg class="d-map-svg" viewBox="0 0 400 240" aria-hidden="true">
    <rect width="400" height="240" fill="#ffffff"/>${blocks}
    ${lines(PLAN_A, "rt-a")}${lines(PLAN_B, "rt-b")}
    ${stops}
    <rect x="${DEPOT[0] - 8}" y="${DEPOT[1] - 8}" width="16" height="16" rx="4" fill="#101828"/>
    <circle cx="${DEPOT[0]}" cy="${DEPOT[1]}" r="3.5" fill="#f2b949"/>
  </svg>`;
}

const DUE: [string, string, number, string, string, boolean][] = [
  ["BIN-0142", "Market gate", 100, "High", "0", true],
  ["BIN-0087", "School east", 78, "High", "0.5", true],
  ["BIN-0213", "Estate block C", 74, "High", "1", true],
  ["BIN-0031", "Bus stage", 66, "Medium", "1.5", true],
  ["BIN-0064", "Clinic road", 52, "Medium", "2", false],
  ["BIN-0118", "Stage 2 kiosk", 47, "Medium", "2.5", false],
  ["BIN-0009", "Chief's camp", 25, "Low", "4", false],
];

function dashScreen(): string {
  const nav: [string, string, string][] = [
    ["overview", "fa-table-cells-large", "Overview"],
    ["collect", "fa-list-check", "Collect today"],
    ["routes", "fa-route", "Routes"],
    ["", "fa-chart-line", "Intelligence"],
    ["", "fa-box-archive", "Records"],
    ["", "fa-user-gear", "Admin"],
  ];
  const navItems = nav
    .map(([key, icon, label]) => `<span class="d-nav ${key ? `d-nav-${key}` : ""}" ${key ? `data-hit="nav-${key}"` : ""}><i class="fa-solid ${icon}"></i>${label}</span>`)
    .join("");
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const heat = HEAT.map((row, d) => `<span class="d-heat-l">${days[d]}</span>${row.map((v) => `<i class="h${v}"></i>`).join("")}`).join("");
  const fills: [string, number][] = [["Empty", 18], ["Low", 34], ["Half", 41], ["High", 27], ["Overflowing", 12]];
  const fillBars = fills.map(([label, v], i) => `<span class="d-bar" style="--v:${v};--i:${i}"><i></i><em>${label}</em></span>`).join("");
  const dueRows = DUE.map(
    ([code, site, pct, risk, days, today], i) => `<div class="d-tr" style="--i:${i}">
      <b>${code}</b><span>${site}</span><span class="d-fill"><span class="d-meter"><i style="width:${pct}%"></i></span>${pct}%</span>
      <span class="d-tag d-risk-${risk.toLowerCase()}">${risk}</span><span class="d-num">${days}</span>
      <span class="d-tag ${today ? "d-tag-ink" : "d-tag-line"}">${today ? "Collect today" : "Schedule soon"}</span>
    </div>`,
  ).join("");
  const routeRow = (c: string, name: string, method: string, a: string, b: string, hit: string, breakdownHit = "") => `
    <div class="d-route d-route-${c}" data-hit="${hit}">
      <span class="d-sw"></span>
      <span class="d-route-t"><b>${name}</b><span>${method}</span></span>
      <span class="d-route-m"><span data-when="!replan">${a}</span><span data-when="replan">${b}</span></span>
      <span class="d-mini" ${breakdownHit ? `data-hit="${breakdownHit}"` : ""}>Breakdown</span>
    </div>`;

  return `
  <aside class="d-side">
    <span class="d-brand"><img src="/icon.svg" alt="" />OpenWaste</span>
    <nav class="d-navs">${navItems}</nav>
    <div class="d-today">
      <span class="d-kick">Today</span>
      <span class="d-today-r"><b>17</b>To collect</span>
      <span class="d-today-r"><b>4</b>To review</span>
    </div>
  </aside>
  <div class="d-main">
    <header class="d-top">
      <b class="d-title"><span class="d-t-overview">Overview</span><span class="d-t-collect">Collect today</span><span class="d-t-routes">Routes</span></b>
      <span class="d-search"><i class="fa-solid fa-magnifying-glass"></i>Search&hellip;<kbd>Ctrl K</kbd></span>
      <span class="d-icons"><i class="fa-solid fa-bell"></i><i class="fa-solid fa-circle-user"></i></span>
    </header>
    <div class="d-body">
      <section class="v v-overview">
        <p class="d-lede">Turn field photos into collection decisions, recovered value, and reports.</p>
        <div class="d-kpis">
          <div class="d-card d-kpi"><span class="d-kick">Bins registered</span><b>148</b><i class="fa-solid fa-trash-can"></i></div>
          <div class="d-card d-kpi d-kpi-ping"><span class="d-kick">Reports, last 7 days</span><b><em data-when="!ping">1,204</em><em data-when="ping">1,205</em></b><i class="fa-solid fa-camera"></i></div>
          <div class="d-card d-kpi"><span class="d-kick">Overflowing, last 7 days</span><b class="d-red">23</b><i class="fa-solid fa-triangle-exclamation"></i></div>
        </div>
        <div class="d-charts">
          <div class="d-card"><p class="d-card-h">Reporting activity &mdash; by day &amp; hour</p><div class="d-heat">${heat}</div></div>
          <div class="d-card"><p class="d-card-h">Fill levels &mdash; last 7 days</p><div class="d-bars">${fillBars}</div></div>
        </div>
      </section>

      <section class="v v-collect">
        <div class="d-card d-table">
          <div class="d-th"><span>Bin</span><span>Site</span><span>Fill</span><span>Risk</span><span>Days to full</span><span>Recommendation</span></div>
          ${dueRows}
        </div>
      </section>

      <section class="v v-routes">
        <div class="d-scroll">
          <div class="d-head">
            <p class="d-lede">Plan from bins due today, then compare with a fixed sweep.</p>
            <span class="d-btn d-btn-line" data-hit="calc">Calculate</span>
            <span class="d-btn d-btn-ink" data-hit="plan">Plan today</span>
          </div>
          <div class="d-kpis">
            <div class="d-card d-kpi"><span class="d-kick">Bins to collect</span><b>17</b><i class="fa-solid fa-trash-can"></i></div>
            <div class="d-card d-kpi"><span class="d-kick">Planned km</span><b><em data-when="!planned">&mdash;</em><em data-when="planned !replan">38.4</em><em data-when="replan">41.5</em></b><i class="fa-solid fa-route"></i></div>
            <div class="d-card d-kpi"><span class="d-kick">Planned fuel (L)</span><b><em data-when="!planned">&mdash;</em><em data-when="planned !replan">8.6</em><em data-when="replan">9.3</em></b><i class="fa-solid fa-gas-pump"></i></div>
          </div>
          <div class="d-split">
            <div class="d-card d-map">${mapSvg()}</div>
            <div class="d-card d-routes">
              <p class="d-card-h">Today&rsquo;s routes</p>
              <p class="d-empty" data-when="!planned">No routes yet &mdash; Plan today</p>
              <div class="d-route-list" data-when="planned">
                ${routeRow("ink", "Truck 1", "Truck", "6 stops &middot; 13.2 km", "8 stops &middot; 18.9 km", "route-ink")}
                ${routeRow("gold", "Tuk-tuk 1", "Tuk-tuk", "5 stops &middot; 9.8 km", "Out of service", "route-gold", "breakdown")}
                ${routeRow("green", "Truck 2", "Truck", "6 stops &middot; 15.4 km", "9 stops &middot; 22.6 km", "route-green")}
              </div>
            </div>
          </div>
          <div class="d-split d-split-even">
            <div class="d-card">
              <p class="d-card-h">Savings vs fixed schedule</p>
              <p class="d-big"><b>31%</b> less distance per tonne collected</p>
              <div class="d-cmp">
                <span></span><span class="d-kick">Fixed sweep</span><span class="d-kick">Need-driven</span>
                <span>Bins visited</span><b>42</b><b>17</b>
                <span>Distance (km)</span><b>52.0</b><b>38.4</b>
                <span>km / tonne</span><b>24.8</b><b>17.1</b>
              </div>
            </div>
            <div class="d-card">
              <p class="d-card-h">Measured route outcomes &middot; Truck 1</p>
              <div class="d-meas">
                <span>Distance (km)</span><b>11.8</b><em>/ 13.2 planned</em>
                <span>Actual fuel (L)</span><b>4.6</b><em>/ 4.9 planned</em>
                <span>Weighed waste (kg)</span><b>1,240</b><em>weighed in</em>
              </div>
            </div>
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
    <div class="d-chips"><span class="d-tag d-tag-gold">3 vehicles</span><span class="d-tag d-tag-line">17 Bins to collect</span><span class="d-tag d-tag-line">17 selected</span></div>
    <div class="d-picks">${picks}</div>
    <div class="d-dlg-a"><span>Cancel</span><span class="d-btn d-btn-ink" data-hit="plan-go">Plan today &middot; 17</span></div>
  </div>
  <div class="ft ft-toast d-toast" data-when="toast"><i class="fa-solid fa-circle-check"></i> Routes planned &middot; 17 stops</div>
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

  private jump(beat: number): void {
    if (this.playing) {
      this.clear();
      this.run(this.firstSceneOf(beat));
    } else {
      this.snap(this.lastSceneOf(beat));
    }
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
    this.later(scene.dur, () => {
      this.timers = [];
      const next = (i + 1) % this.scenes.length;
      if (next === 0) this.parkCursor();
      this.run(next);
    });
  }

  private snap(i: number): void {
    const scene = this.scenes[i];
    this.index = i;
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
    new Player(stage, rig, phone ? FIELD : OPS, reduced);
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
