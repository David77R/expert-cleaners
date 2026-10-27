import { US_FOCUS, US_METROS, US_REGIONS, US_VIEWBOX } from "@/components/us-map-data";

const FOCUS_DELAYS = ["0s", "-36s", "-18s"] as const;
const REGION_DELAYS = ["0s", "2.4s", "4.8s", "7.2s", "9.6s"] as const;

function Star({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  return (
    <g transform={`translate(${x} ${y})`} className="usmap-twinkle" style={{ animationDelay: `${delay}s` }}>
      <circle r={size * 3} fill="#ffffff" opacity="0.08" />
      <circle r={size * 1.6} fill="#dfe4ff" opacity="0.22" />
      <circle r={size} fill="#ffffff" />
    </g>
  );
}

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
              <Star key={metro.name} x={metro.at[0]} y={metro.at[1]} size={0.9} delay={(index % 7) * 0.7} />
            ))}
            {US_FOCUS.map((focus, index) => (
              <g key={focus.name} className="usmap-focus" style={{ animationDelay: FOCUS_DELAYS[index] }}>
                <circle cx={focus.at[0]} cy={focus.at[1]} r="36" fill="#5b6cff" opacity="0.08" />
                {focus.routes.map((route) => (
                  <path
                    key={route.d}
                    d={`M${focus.at[0]} ${focus.at[1]} ${route.stops.map(([x, y]) => `L${x} ${y}`).join(" ")}`}
                    fill="none"
                    stroke="#ffffff"
                    strokeOpacity="0.32"
                    strokeWidth="1"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                <path
                  d={focus.routes
                    .map((route, routeIndex) => {
                      const next = focus.routes[(routeIndex + 1) % focus.routes.length];
                      return `M${route.stops[2][0]} ${route.stops[2][1]} L${next.stops[1][0]} ${next.stops[1][1]}`;
                    })
                    .join(" ")}
                  fill="none"
                  stroke="#ffffff"
                  strokeOpacity="0.12"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
                {focus.routes.flatMap((route, routeIndex) =>
                  route.stops.map(([x, y], stopIndex) => (
                    <Star
                      key={`${x}-${y}`}
                      x={x}
                      y={y}
                      size={stopIndex === route.stops.length - 1 ? 0.75 : 0.55}
                      delay={(routeIndex * 4 + stopIndex) * 0.45}
                    />
                  )),
                )}
                <Star x={focus.at[0]} y={focus.at[1]} size={1.1} delay={0} />
              </g>
            ))}
          </svg>
        </div>
        {US_FOCUS.map((focus, index) => (
          <div
            key={focus.name}
            className="usmap-focus absolute left-1/2 top-[calc(50%-11rem)] hidden -translate-x-1/2 items-center gap-2.5 whitespace-nowrap rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 shadow-2xl backdrop-blur-md sm:flex"
            style={{ animationDelay: FOCUS_DELAYS[index] }}
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-white shadow-[0_0_12px_#ffffff]" />
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
