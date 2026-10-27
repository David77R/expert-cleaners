import { US_FOCUS, US_METROS, US_REGIONS, US_VIEWBOX } from "@/components/us-map-data";

const ROUTE_COLORS = ["#fbbf24", "#60a5fa", "#34d399"] as const;
const FOCUS_DELAYS = ["0s", "-20s", "-10s"] as const;
const REGION_DELAYS = ["0s", "1.2s", "2.4s", "3.6s", "4.8s"] as const;

export function UsOpsMap() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_55%_40%,rgb(59_76_255/0.22),transparent_70%)]" />
      <div className="absolute left-1/2 top-0 w-[min(108%,1040px)] -translate-x-1/2 lg:top-[9%] lg:w-[min(112%,1080px)]">
        <div className="usmap-tour aspect-[975/610] w-full">
          <svg viewBox={`0 0 ${US_VIEWBOX.width} ${US_VIEWBOX.height}`} className="h-full w-full overflow-visible">
            {US_REGIONS.map((region, index) => (
              <path
                key={region.id}
                d={region.d}
                className="usmap-region"
                style={{ animationDelay: REGION_DELAYS[index] }}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {US_METROS.map((metro, index) => (
              <g key={metro.name} transform={`translate(${metro.at[0]} ${metro.at[1]})`}>
                <circle
                  r="3.2"
                  fill="#8e9bff"
                  className="ops-pulse"
                  style={{ animationDelay: `${(index % 6) * 0.4}s` }}
                />
                <circle r="1.5" fill="#c7cdff" />
              </g>
            ))}
            {US_FOCUS.map((focus, index) => (
              <g key={focus.name} className="usmap-focus" style={{ animationDelay: FOCUS_DELAYS[index] }}>
                <circle cx={focus.at[0]} cy={focus.at[1]} r="34" fill="#5b6cff" opacity="0.1" />
                {focus.routes.map((route, routeIndex) => (
                  <g key={route.d}>
                    <path
                      d={route.d}
                      fill="none"
                      stroke={ROUTE_COLORS[routeIndex]}
                      strokeOpacity="0.18"
                      strokeWidth="6"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                    <path
                      d={route.d}
                      fill="none"
                      stroke={ROUTE_COLORS[routeIndex]}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      className="ops-route"
                      vectorEffect="non-scaling-stroke"
                    />
                    {route.stops.map(([x, y]) => (
                      <circle
                        key={`${x}-${y}`}
                        cx={x}
                        cy={y}
                        r="0.8"
                        fill="#070b14"
                        stroke={ROUTE_COLORS[routeIndex]}
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                  </g>
                ))}
                <rect
                  x={focus.at[0] - 1.3}
                  y={focus.at[1] - 1.3}
                  width="2.6"
                  height="2.6"
                  rx="0.7"
                  fill="#5b6cff"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ))}
          </svg>
        </div>
        {US_FOCUS.map((focus, index) => (
          <div
            key={focus.name}
            className="usmap-focus absolute left-1/2 top-[calc(50%-11rem)] hidden -translate-x-1/2 items-center gap-2.5 whitespace-nowrap rounded-xl border border-white/10 bg-white/[0.07] px-3.5 py-2.5 shadow-2xl backdrop-blur-md sm:flex"
            style={{ animationDelay: FOCUS_DELAYS[index] }}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#34d399] shadow-[0_0_12px_#34d399]" />
            <span className="leading-tight">
              <span className="block text-[13px] font-semibold text-white">{focus.name}</span>
              <span className="block text-[11px] text-white/60">3 técnicos en ruta · 12 paradas</span>
            </span>
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-[#070b14] via-transparent to-[#070b14]/60" />
      <div className="absolute inset-0 bg-[radial-gradient(70%_55%_at_15%_85%,#070b14_20%,transparent_75%)]" />
    </div>
  );
}
