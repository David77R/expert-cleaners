import { US_METROS, US_REGIONS, US_SPOTS, US_VIEWBOX } from "@/components/us-map-data";

const REGION_DELAYS = ["0s", "2.4s", "4.8s", "7.2s", "9.6s"] as const;
const SPOT_DURATIONS = [22, 27, 24, 29] as const;

function spotTiming(index: number) {
  const duration = SPOT_DURATIONS[index % SPOT_DURATIONS.length];
  const offset = ((index * 0.618 * duration + index * 1.7) % duration).toFixed(1);
  return { animationDuration: `${duration}s`, animationDelay: `-${offset}s` };
}

export function UsOpsMap() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_55%_40%,rgb(59_76_255/0.22),transparent_70%)]" />
      <div className="absolute left-1/2 top-0 w-[min(104%,1040px)] -translate-x-1/2 lg:top-[10%] lg:w-[min(94%,1000px)]">
        <svg
          viewBox={`0 0 ${US_VIEWBOX.width} ${US_VIEWBOX.height}`}
          className="aspect-[975/610] h-auto w-full overflow-visible"
        >
          {US_REGIONS.map((region, index) => (
            <path
              key={region.id}
              d={region.d}
              className="usmap-region"
              style={{ animationDelay: REGION_DELAYS[index] }}
            />
          ))}
          {US_METROS.map((metro, index) => (
            <circle
              key={metro.name}
              cx={metro.at[0]}
              cy={metro.at[1]}
              r="1.6"
              fill="#c7cdff"
              className="usmap-twinkle"
              style={{ animationDelay: `${(index % 7) * 0.7}s` }}
            />
          ))}
          {US_SPOTS.map((spot, index) => (
            <g key={spot.name} className="usmap-spot" style={spotTiming(index)}>
              <circle cx={spot.at[0]} cy={spot.at[1]} r="34" fill="#7c8cff" opacity="0.08" />
              <path
                d={spot.d}
                pathLength={1}
                fill="none"
                stroke="#ffffff"
                strokeOpacity="0.45"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="usmap-draw"
                style={spotTiming(index)}
              />
              {spot.stars.map(([x, y], starIndex) => (
                <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
                  <circle r={starIndex === 0 ? 7 : 5} fill="#ffffff" opacity="0.1" />
                  <circle
                    r={starIndex === 0 ? 2.6 : 1.9}
                    fill="#ffffff"
                    className="usmap-twinkle"
                    style={{ animationDelay: `${starIndex * 0.6}s` }}
                  />
                </g>
              ))}
              <text
                x={spot.at[0] + 10}
                y={spot.at[1] - 10}
                className="hidden fill-white/70 text-[13px] font-medium tracking-wide sm:inline"
              >
                {spot.name}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-[#070b14] via-transparent to-[#070b14]/60" />
      <div className="absolute inset-0 bg-[radial-gradient(70%_55%_at_15%_85%,#070b14_20%,transparent_75%)]" />
    </div>
  );
}
