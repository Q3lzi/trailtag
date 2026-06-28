"use client";

import { useEffect, useRef } from "react";

export default function LeafletTestPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    import("leaflet").then((L) => {
      if (!containerRef.current) return;
      const map = L.default.map(containerRef.current).setView([46.8182, 8.2275], 8);
      L.default
        .tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
          maxZoom: 18,
          subdomains: "abc",
        })
        .addTo(map);
    });
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Leaflet Isolation Test — kein Tailwind, kein Wrapper</h1>
      <div
        ref={containerRef}
        style={{ width: "600px", height: "400px", border: "2px solid red" }}
      />
    </div>
  );
}
