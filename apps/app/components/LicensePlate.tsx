/**
 * Swiss vehicle plate. Matches a real CH plate's proportions: white
 * background throughout, the red Swiss-cross badge sitting directly on the
 * white field (no separate dark block behind it) — and visually matches the
 * rescue portal's HTML version (apps/api/src/routes/qr.ts `plate()` helper)
 * so the plate looks like the same physical object in both places.
 */
export default function LicensePlate({ text, size = "md" }: { text: string; size?: "sm" | "md" | "lg" }) {
  const dims = {
    sm: { badge: 18, font: 13, padX: 3, padY: 3, textPadX: 10, textPadY: 4, tracking: "0.12em" },
    md: { badge: 22, font: 16, padX: 4, padY: 4, textPadX: 14, textPadY: 6, tracking: "0.14em" },
    lg: { badge: 26, font: 19, padX: 5, padY: 5, textPadX: 18, textPadY: 8, tracking: "0.15em" },
  }[size];

  return (
    <span
      className="inline-flex items-stretch rounded-md overflow-hidden border-[1.5px] border-forest-950 bg-white"
      style={{ boxShadow: "0 2px 6px rgba(6,25,7,.12), inset 0 1px 0 rgba(255,255,255,.5)" }}
    >
      <span className="flex items-center justify-center" style={{ padding: dims.padX }}>
        <svg width={dims.badge} height={dims.badge} viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
          <rect width="22" height="22" rx="3" fill="#D52B1E" />
          <rect x="9" y="3" width="4" height="16" fill="#fff" />
          <rect x="3" y="9" width="16" height="4" fill="#fff" />
        </svg>
      </span>
      <span
        className="bg-white text-forest-950 font-display font-extrabold"
        style={{ fontSize: dims.font, letterSpacing: dims.tracking, padding: `${dims.textPadY}px ${dims.textPadX}px` }}
      >
        {text}
      </span>
    </span>
  );
}
