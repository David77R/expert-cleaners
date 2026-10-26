export function CompanySolutionsMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id="cs-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7c8cff" />
          <stop offset="100%" stopColor="#4f5bff" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="#11172a" stroke="#2a3355" />
      <rect x="9" y="9" width="10" height="10" rx="3" fill="#ffffff" />
      <rect x="21" y="9" width="10" height="10" rx="3" fill="#94a3c8" />
      <rect x="9" y="21" width="10" height="10" rx="3" fill="#94a3c8" />
      <rect x="21" y="21" width="10" height="10" rx="3" fill="url(#cs-mark)" />
    </svg>
  );
}
