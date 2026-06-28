"use client";

export default function ElevationChart({ points }: { points: { ele?: number | null }[] }) {
  const filtered = points.filter((p) => p.ele != null) as { ele: number }[];
  if (filtered.length < 2) return null;

  const eles = filtered.map((p) => p.ele);
  const minEle = Math.min(...eles);
  const maxEle = Math.max(...eles);
  const range = maxEle - minEle || 1;
  const svgW = 800;
  const h = 110;
  const pad = 12;

  const pts = filtered
    .map((p, i) => {
      const x = pad + (i / (filtered.length - 1)) * (svgW - pad * 2);
      const y = h - pad - ((p.ele - minEle) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
  const area = `${pad},${h - pad} ${pts} ${svgW - pad},${h - pad}`;

  return (
    <div className="bg-white rounded-2xl border border-forest-950/[0.06] shadow-card p-6">
      <h3 className="font-display font-semibold text-sm text-forest-950 mb-4">Höhenprofil</h3>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${svgW} ${h}`} style={{ width: "100%", height: 110 }} preserveAspectRatio="none">
          <defs>
            <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2c694e" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#2c694e" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <polygon points={area} fill="url(#elevGrad)" />
          <polyline points={pts} fill="none" stroke="#2c694e" strokeWidth="2" />
          <text x={pad + 2} y={pad + 12} fontSize="11" fill="#6b7280">{Math.round(maxEle)} m</text>
          <text x={pad + 2} y={h - pad - 2} fontSize="11" fill="#6b7280">{Math.round(minEle)} m</text>
        </svg>
      </div>
    </div>
  );
}
