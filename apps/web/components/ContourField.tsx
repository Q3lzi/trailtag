"use client";

// Decorative topographic contour-line field, evoking Swiss survey maps.
// Pure SVG, no external assets, respects reduced-motion via CSS.
export default function ContourField({ className = "" }: { className?: string }) {
  // Generate a set of nested, hand-tuned wavy contour paths.
  const lines = [
    "M-50,180 C150,120 300,220 500,160 C700,100 850,200 1050,150",
    "M-50,230 C160,170 320,260 500,210 C690,150 860,240 1050,200",
    "M-50,280 C170,230 330,300 500,260 C680,210 870,290 1050,250",
    "M-50,330 C180,290 340,340 500,310 C670,270 880,340 1050,300",
    "M-50,380 C190,350 350,390 500,365 C660,335 890,390 1050,355",
  ];

  return (
    <svg
      viewBox="0 0 1000 460"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      {lines.map((d, i) => (
        <path
          key={i}
          d={d}
          className="contour-line"
          strokeWidth={i === 2 ? 1.4 : 0.8}
          opacity={0.18 + i * 0.05}
        />
      ))}
    </svg>
  );
}
