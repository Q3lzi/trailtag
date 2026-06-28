"use client";

// Ambient, slowly drifting topographic contour lines — the same visual
// language as the marketing site's hero, brought into the app as a living
// backdrop rather than a static texture. Pure CSS animation, GPU-friendly,
// respects prefers-reduced-motion via the .animate-drift utility guard in globals.css.
export default function ContourBackdrop({ className = "" }: { className?: string }) {
  const lines = [
    "M-100,120 C100,60 250,160 450,100 C650,40 800,140 1100,90",
    "M-100,180 C120,130 270,210 450,160 C640,100 810,190 1100,150",
    "M-100,240 C140,200 290,260 450,220 C630,170 820,240 1100,210",
    "M-100,300 C160,270 310,310 450,280 C620,240 830,300 1100,270",
  ];

  return (
    <svg
      viewBox="0 0 1000 380"
      preserveAspectRatio="none"
      className={`animate-drift ${className}`}
      aria-hidden="true"
    >
      {lines.map((d, i) => (
        <path
          key={i}
          d={d}
          className="contour-line"
          strokeWidth={i === 1 ? 1.2 : 0.7}
          opacity={0.5 - i * 0.09}
        />
      ))}
    </svg>
  );
}
