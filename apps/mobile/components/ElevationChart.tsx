interface Props {
  points: { lat: number; lng: number; ele?: number }[];
}

export default function ElevationChart({ points }: Props) {
  const withEle = points.filter(p => p.ele !== undefined);
  if (withEle.length === 0) return null;

  const eles = withEle.map(p => p.ele!);
  const minEle = Math.min(...eles);
  const maxEle = Math.max(...eles);
  const range = maxEle - minEle || 1;

  const width = 800;
  const height = 120;
  const padding = 10;

  const pointsStr = withEle.map((p, i) => {
    const x = padding + (i / (withEle.length - 1)) * (width - padding * 2);
    const y = height - padding - ((p.ele! - minEle) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  const areaStr = `${padding},${height - padding} ${pointsStr} ${width - padding},${height - padding}`;

  return (
    <div style={{ marginTop: 12, backgroundColor: '#f9f9f9', borderRadius: 12, padding: 12 }}>
      <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#444' }}>📈 Höhenprofil</p>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
        <defs>
          <linearGradient id="eleGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2D6A4F" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#2D6A4F" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <polygon points={areaStr} fill="url(#eleGrad)" />
        <polyline points={pointsStr} fill="none" stroke="#2D6A4F" strokeWidth="2" />
        {/* Min/Max Labels */}
        <text x={padding} y={padding + 10} fontSize="10" fill="#666">{Math.round(maxEle)} m</text>
        <text x={padding} y={height - padding - 2} fontSize="10" fill="#666">{Math.round(minEle)} m</text>
      </svg>
    </div>
  );
}