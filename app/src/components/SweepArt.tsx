const DUST = [
  { x: 104, y: 107, r: 4, fill: "#835a09", delay: 0 },
  { x: 100, y: 109, r: 3, fill: "#b9ad94", delay: 0.28 },
  { x: 107, y: 104, r: 2.6, fill: "#6b6456", delay: 0.55 },
  { x: 98, y: 106, r: 3.4, fill: "#c9a24a", delay: 0.82 },
  { x: 103, y: 110, r: 2.2, fill: "#835a09", delay: 1.1 },
];

const HEAP = [
  { cx: 156, cy: 95, r: 4.6, fill: "#835a09" },
  { cx: 163, cy: 91, r: 4, fill: "#6b6456" },
  { cx: 168, cy: 88, r: 3.2, fill: "#c9a24a" },
  { cx: 150, cy: 99, r: 3.4, fill: "#b9ad94" },
  { cx: 160, cy: 96, r: 3, fill: "#c9a24a" },
];

const BRISTLES = [70, 76, 82, 88, 94, 100];

export default function SweepArt({ size = 188 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={(size * 130) / 200}
      viewBox="0 0 200 130"
      role="presentation"
      aria-hidden="true"
      style={{ display: "block", overflow: "visible" }}
    >
      <style>{`
        .sw-broom { transform-box: view-box; transform-origin: 36px 4px; animation: sw-sweep 1.4s cubic-bezier(.45,0,.35,1) infinite alternate; }
        .sw-dust { animation: sw-dust 1.4s cubic-bezier(.3,.7,.4,1) infinite; }
        .sw-puff { transform-box: fill-box; transform-origin: center; animation: sw-puff 1.4s ease-out infinite; }
        .sw-pile { transform-box: fill-box; transform-origin: center bottom; animation: sw-pile 2.8s ease-in-out infinite; }
        @keyframes sw-sweep { from { transform: rotate(-7deg); } to { transform: rotate(9deg); } }
        @keyframes sw-dust {
          0% { transform: translate(0, 0); opacity: 0; }
          18% { opacity: 1; }
          55% { transform: translate(17px, -8px); }
          88% { opacity: 1; }
          100% { transform: translate(36px, 0); opacity: 0; }
        }
        @keyframes sw-puff {
          0% { transform: scale(0.4); opacity: 0; }
          30% { opacity: 0.55; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes sw-pile { 0%, 100% { transform: scaleY(0.92); } 50% { transform: scaleY(1.06); } }
        @media (prefers-reduced-motion: reduce) {
          .sw-broom, .sw-dust, .sw-puff, .sw-pile { animation: none !important; }
        }
      `}</style>

      <line x1="8" y1="113" x2="192" y2="113" stroke="#e4dfd2" strokeWidth="3" strokeLinecap="round" />

      <circle className="sw-puff" cx="104" cy="104" r="6" fill="#e9e4d8" style={{ animationDelay: "0.2s" }} />
      <circle className="sw-puff" cx="96" cy="100" r="4.5" fill="#efebe2" style={{ animationDelay: "0.9s" }} />

      {DUST.map((d) => (
        <circle
          key={`${d.x}-${d.y}`}
          className="sw-dust"
          cx={d.x}
          cy={d.y}
          r={d.r}
          fill={d.fill}
          style={{ animationDelay: `${d.delay}s` }}
        />
      ))}

      <polygon
        points="120,112 174,112 174,83 131,104"
        fill="#f2b949"
        stroke="#101828"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <line x1="124" y1="110.5" x2="171" y2="110.5" stroke="#101828" strokeWidth="1.6" opacity="0.25" />
      <line x1="174" y1="85" x2="192" y2="56" stroke="#101828" strokeWidth="5.5" strokeLinecap="round" />
      <g className="sw-pile">
        {HEAP.map((h) => (
          <circle key={`${h.cx}-${h.cy}`} cx={h.cx} cy={h.cy} r={h.r} fill={h.fill} />
        ))}
      </g>

      <g className="sw-broom">
        <line x1="36" y1="4" x2="80" y2="88" stroke="#835a09" strokeWidth="6" strokeLinecap="round" />
        <rect x="70" y="84" width="22" height="9" rx="2.5" fill="#101828" transform="rotate(27 81 88.5)" />
        <path d="M66 94 L98 90 L110 113 L58 113 Z" fill="#f2b949" stroke="#101828" strokeWidth="3" strokeLinejoin="round" />
        {BRISTLES.map((x, i) => (
          <line
            key={x}
            x1={x + i * 0.6}
            y1={95 - i * 0.6}
            x2={x - 7 + i * 2.6}
            y2="111"
            stroke="#c98a12"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        ))}
      </g>
    </svg>
  );
}
