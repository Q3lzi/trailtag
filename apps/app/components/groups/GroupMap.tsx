"use client";

import { useEffect, useRef, useState } from "react";

const PARTICIPANT_COLORS = ["#2c694e", "#1d4ed8", "#dc2626", "#ea580c", "#7c3aed", "#0891b2"];

export type GroupParticipant = {
  userId: string;
  name: string;
  lat: number | null;
  lng: number | null;
  status: string; // ACTIVE | ALARM | COMPLETED | PLANNED
};

/**
 * Live map showing every participant of a shared hike at once — the actual
 * point of a TourGroup: seeing where everyone in your group currently is,
 * not just your own position. Each participant gets a distinct colour and
 * a name label, so it reads as "the group" rather than overlapping dots.
 */
export default function GroupMap({ participants }: { participants: GroupParticipant[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const [ready, setReady] = useState(false);

  const located = participants.filter((p) => p.lat != null && p.lng != null);

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
          if (hasSize(el)) { clearInterval(pollTimer); resolve(); }
        }, 50);
      });
      if (cancelled || !containerRef.current) return;

      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L.default;

      const center = located[0] ? [located[0].lat, located[0].lng] as [number, number] : [46.8182, 8.2275];
      const map = L.default.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
        center,
        zoom: located.length > 0 ? 13 : 7,
      });
      mapRef.current = map;

      L.default
        .tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { maxZoom: 18, subdomains: "abc" })
        .addTo(map);

      if (located.length > 1) {
        map.fitBounds(L.default.latLngBounds(located.map((p) => [p.lat, p.lng] as [number, number])), { padding: [50, 50] });
      }

      map.invalidateSize();
      setReady(true);
    }

    init();

    return () => {
      cancelled = true;
      clearInterval(pollTimer);
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch {}
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw/update participant markers whenever positions or the participant
  // list itself changes — moves existing markers smoothly, adds new ones,
  // removes ones for participants no longer reporting a position.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !ready) return;

    const currentIds = new Set(located.map((p) => p.userId));
    for (const [id, marker] of markersRef.current) {
      if (!currentIds.has(id)) {
        map.removeLayer(marker);
        markersRef.current.delete(id);
      }
    }

    located.forEach((p, i) => {
      const color = PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length];
      const isAlarm = p.status === "ALARM";
      const existing = markersRef.current.get(p.userId);

      if (existing) {
        existing.setLatLng([p.lat, p.lng]);
        return;
      }

      const icon = L.divIcon({
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;">
            <div style="position:relative;width:18px;height:18px;margin-bottom:2px;">
              <div style="position:absolute;inset:0;border-radius:50%;background:${isAlarm ? "#ba1a1a" : color};opacity:0.35;animation:groupMapPulse 2s ease-out infinite;"></div>
              <div style="position:absolute;inset:4px;border-radius:50%;background:${isAlarm ? "#ba1a1a" : color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3);"></div>
            </div>
            <div style="background:#fff;padding:2px 7px;border-radius:8px;font-size:11px;font-weight:600;color:#061907;box-shadow:0 1px 3px rgba(0,0,0,.2);white-space:nowrap;">${escapeHtml(p.name)}</div>
          </div>
        `,
        iconSize: [80, 40],
        iconAnchor: [40, 18],
        className: "",
      });

      const marker = L.marker([p.lat, p.lng], { icon }).addTo(map);
      markersRef.current.set(p.userId, marker);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, JSON.stringify(located)]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: "1px" }} className="bg-forest-100">
      {!ready && <div style={{ width: "100%", height: "100%" }} />}
      <style jsx global>{`
        @keyframes groupMapPulse {
          0% { transform: scale(1); opacity: 0.35; }
          100% { transform: scale(2.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
