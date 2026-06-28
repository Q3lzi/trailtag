"use client";

import { useEffect, useRef, useState } from "react";

export default function MiniMap({
  lat,
  lng,
  dark = false,
}: {
  lat: number;
  lng: number;
  dark?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval>;

    function hasSize(el: HTMLElement) {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    async function init() {
      if (!containerRef.current) return;
      const el = containerRef.current;

      await new Promise<void>((resolve) => {
        if (hasSize(el)) { resolve(); return; }
        pollTimer = setInterval(() => {
          if (hasSize(el)) {
            clearInterval(pollTimer);
            resolve();
          }
        }, 50);
      });

      if (cancelled || !containerRef.current) return;
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      const map = L.default.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        keyboard: false,
        center: [lat, lng],
        zoom: 13,
      });
      mapRef.current = map;

      const tileUrl = dark
        ? "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

      L.default.tileLayer(tileUrl, { maxZoom: 18, subdomains: "abc" }).addTo(map);

      L.default
        .circleMarker([lat, lng], { radius: 8, fillColor: "#4a8f6f", color: "#fff", weight: 3, fillOpacity: 1 })
        .addTo(map);

      map.invalidateSize();
      setReady(true);
    }

    init();

    return () => {
      cancelled = true;
      clearInterval(pollTimer);
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
        mapRef.current = null;
      }
    };
  }, [lat, lng, dark]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: "1px" }} />;
}
