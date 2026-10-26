export function CarMotion({ size = 20, moving = true }: { size?: number; moving?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0 overflow-visible"
    >
      {moving && (
        <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.8">
          <path d="M1 10h4" className="car-speed" />
          <path d="M0 14h5" className="car-speed" style={{ animationDelay: "0.3s" }} />
          <path d="M2 18h3" className="car-speed" style={{ animationDelay: "0.6s" }} />
        </g>
      )}
      <g className={moving ? "car-bob" : ""}>
        <path
          d="M7 16.5v-3.2c0-.6.2-1.1.6-1.5l2.6-3.3c.5-.6 1.2-1 2-1h6.2c.8 0 1.5.3 2 .9l2.9 3.4 2.2.6c.9.3 1.5 1.1 1.5 2v2.1c0 .6-.4 1-1 1H8c-.6 0-1-.4-1-1z"
          fill="currentColor"
          fillOpacity="0.18"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M11.5 11.8l1.8-2.4h3.2v2.4zM18 9.4h.8c.4 0 .7.1.9.4l1.6 2H18z" fill="currentColor" />
      </g>
      <g stroke="currentColor" strokeWidth="1.6" fill="none">
        <g className={moving ? "car-wheel" : ""}>
          <circle cx="11.5" cy="18" r="2.4" />
          <path d="M11.5 15.9v4.2" strokeWidth="1" />
        </g>
        <g className={moving ? "car-wheel" : ""}>
          <circle cx="21.5" cy="18" r="2.4" />
          <path d="M21.5 15.9v4.2" strokeWidth="1" />
        </g>
      </g>
    </svg>
  );
}
