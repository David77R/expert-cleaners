const ROUTES = [
  {
    id: "ops-route-a",
    color: "#fbbf24",
    d: "M118 548 C 150 470 168 430 236 404 S 330 352 344 286 S 392 196 470 176",
    stops: [
      [118, 548],
      [236, 404],
      [344, 286],
      [470, 176],
    ],
    duration: 9,
  },
  {
    id: "ops-route-b",
    color: "#60a5fa",
    d: "M78 214 C 160 230 196 268 250 250 S 352 182 430 236 S 520 342 548 420",
    stops: [
      [78, 214],
      [250, 250],
      [430, 236],
      [548, 420],
    ],
    duration: 11,
  },
  {
    id: "ops-route-c",
    color: "#34d399",
    d: "M304 640 C 318 588 362 560 420 548 S 512 500 520 452 S 470 380 402 360",
    stops: [
      [304, 640],
      [420, 548],
      [520, 452],
      [402, 360],
    ],
    duration: 10,
  },
] as const;

const STREETS_X = Array.from({ length: 13 }, (_, index) => 30 + index * 50);
const STREETS_Y = Array.from({ length: 15 }, (_, index) => 20 + index * 50);

const CHIPS = [
  { title: "SVC-2041 confirmada", detail: "Gold · 9:00 AM", dot: "#34d399", place: "left-[8%] top-[22%]" },
  { title: "Técnico 2 en camino", detail: "Llega en 12 min", dot: "#60a5fa", place: "right-[8%] top-[38%]" },
  { title: "Ruta optimizada", detail: "6 paradas · 41 mi", dot: "#fbbf24", place: "left-[14%] top-[58%]" },
  { title: "Lavado completado", detail: "Cobrado $280", dot: "#a78bfa", place: "right-[12%] top-[70%]" },
];

export function OpsMap() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <svg viewBox="0 0 640 720" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="ops-glow" cx="55%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#3b4cff" stopOpacity="0.28" />
            <stop offset="60%" stopColor="#0b1020" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ops-water" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0f2236" />
            <stop offset="100%" stopColor="#0a1828" />
          </linearGradient>
          {ROUTES.map((route) => (
            <path key={route.id} id={route.id} d={route.d} />
          ))}
        </defs>

        <rect width="640" height="720" fill="#070b14" />
        <rect width="640" height="720" fill="url(#ops-glow)" className="ops-glow" />

        <path
          d="M640 0 L640 720 L596 720 C 572 640 600 560 578 480 S 602 330 572 250 S 592 90 560 0 Z"
          fill="url(#ops-water)"
        />
        <path
          d="M392 96 C 430 70 500 80 512 120 S 470 190 430 176 S 360 120 392 96 Z"
          fill="url(#ops-water)"
          stroke="#16304a"
          strokeWidth="1.5"
        />
        <path d="M60 620 C 90 590 150 600 160 636 S 110 690 80 676 S 40 646 60 620 Z" fill="url(#ops-water)" />

        <g stroke="#141c2e" strokeWidth="1">
          {STREETS_X.map((x, index) => (
            <path
              key={`x${x}`}
              d={`M${x} 0 C ${x + (index % 2 ? 12 : -10)} 240 ${x + (index % 3 ? -8 : 14)} 480 ${x + 6} 720`}
              fill="none"
            />
          ))}
          {STREETS_Y.map((y, index) => (
            <path
              key={`y${y}`}
              d={`M0 ${y} C 200 ${y + (index % 2 ? 10 : -8)} 420 ${y + (index % 3 ? -12 : 9)} 640 ${y + 4}`}
              fill="none"
            />
          ))}
        </g>
        <g fill="none" stroke="#1d2840" strokeLinecap="round">
          <path d="M0 470 C 160 430 300 330 380 300 S 560 210 640 160" strokeWidth="5" />
          <path d="M200 0 C 220 160 190 300 236 404 S 300 620 280 720" strokeWidth="4" />
          <path d="M0 140 C 140 150 300 120 430 236" strokeWidth="3" />
        </g>

        {ROUTES.map((route) => (
          <g key={route.id}>
            <path
              d={route.d}
              fill="none"
              stroke={route.color}
              strokeOpacity="0.18"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d={route.d}
              fill="none"
              stroke={route.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              className="ops-route"
            />
            {route.stops.map(([x, y], index) => (
              <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
                <circle
                  r="10"
                  fill={route.color}
                  opacity="0.35"
                  className="ops-pulse"
                  style={{ animationDelay: `${index * 0.6}s` }}
                />
                <circle r="7" fill="#070b14" stroke={route.color} strokeWidth="2.5" />
                <circle r="2.5" fill={route.color} />
              </g>
            ))}
            <g className="ops-car">
              <circle r="6" fill="#ffffff" stroke={route.color} strokeWidth="3">
                <animateMotion dur={`${route.duration}s`} repeatCount="indefinite" rotate="auto">
                  <mpath href={`#${route.id}`} />
                </animateMotion>
              </circle>
            </g>
          </g>
        ))}

        <g transform="translate(300 330)">
          <circle r="22" fill="#5b6cff" opacity="0.25" className="ops-pulse" />
          <rect x="-11" y="-11" width="22" height="22" rx="6" fill="#5b6cff" />
          <rect x="-5" y="-5" width="10" height="10" rx="2.5" fill="#ffffff" />
        </g>
      </svg>

      <div className="absolute inset-0 bg-gradient-to-t from-[#070b14] via-transparent to-[#070b14]/70" />
      <div className="absolute inset-0 bg-[radial-gradient(70%_55%_at_15%_85%,#070b14_20%,transparent_75%)]" />

      {CHIPS.map((chip, index) => (
        <div
          key={chip.title}
          className={`ops-chip absolute hidden ${chip.place} items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.07] px-3.5 py-2.5 shadow-2xl backdrop-blur-md sm:flex`}
          style={{ animationDelay: `${index * 3}s` }}
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: chip.dot, boxShadow: `0 0 12px ${chip.dot}` }}
          />
          <span className="leading-tight">
            <span className="block text-[13px] font-semibold text-white">{chip.title}</span>
            <span className="block text-[11px] text-white/60">{chip.detail}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
