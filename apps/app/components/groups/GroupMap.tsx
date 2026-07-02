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
 * Live map showing every participant of a shared hike at once — plus the
 * planned route, waypoints, overnight stops, and parking, so switching to
 * this view once the tour starts doesn't make all the planning context
 * (the route line, where the water source is) disappear. Only participant
 * markers update live; the route context is static once drawn.
 */
export default function GroupMap({
  participants,
  routePoints = [],
  waypoints = [],
  overnightStops = [],
  parking = null,
}: {
  participants: GroupParticipant[];
  routePoints?: { lat: number; lng: number }[];
  waypoints?: { name?: string; lat?: string | number | null; lng?: string | number | null }[];
  overnightStops?: { night?: number; name?: string; lat?: string | number | null; lng?: string | number | null }[];
  parking?: { lat: number | null; lng: number | null; name?: string | null } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const routeLayerRef = useRef<any>(null);
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

      const center = located[0]
        ? [located[0].lat, located[0].lng] as [number, number]
        : routePoints[0]
        ? [routePoints[0].lat, routePoints[0].lng] as [number, number]
        : [46.8182, 8.2275];

      const map = L.default.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
        center,
        zoom: located.length > 0 || routePoints.length > 0 ? 13 : 7,
      });
      mapRef.current = map;

      L.default
        .tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { maxZoom: 18, subdomains: "abc" })
        .addTo(map);

      routeLayerRef.current = L.default.layerGroup().addTo(map);

      const boundsPoints: [number, number][] = [
        ...located.map((p) => [p.lat, p.lng] as [number, number]),
        ...routePoints.map((p) => [p.lat, p.lng] as [number, number]),
      ];
      if (boundsPoints.length > 1) {
        map.fitBounds(L.default.latLngBounds(boundsPoints), { padding: [50, 50] });
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

  // Static route/waypoint/parking context — drawn once and left in place,
  // separate from the live-updating participant markers below.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const group = routeLayerRef.current;
    if (!L || !map || !group || !ready) return;
    group.clearLayers();

    if (routePoints.length > 1) {
      L.polyline(routePoints.map((p) => [p.lat, p.lng]), { color: "#357a5c", weight: 3, opacity: 0.55, dashArray: "6 6" }).addTo(group);
    }

    if (parking?.lat && parking?.lng) {
      L.circleMarker([parking.lat, parking.lng], { radius: 7, fillColor: "#0d2410", color: "#fff", weight: 2, fillOpacity: 1 })
        .bindPopup(parking.name || "Parkplatz")
        .addTo(group);
    }

    overnightStops.forEach((s, i) => {
      const lat = s.lat ? Number(s.lat) : null;
      const lng = s.lng ? Number(s.lng) : null;
      if (!lat || !lng) return;
      const icon = L.divIcon({
        html: `<div style="display:flex;flex-direction:column;align-items:center;">
          <div style="font-size:15px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4))">🌙</div>
          <div style="background:#0d2410;color:#fff;font-size:8px;font-weight:700;padding:1px 3px;border-radius:5px;margin-top:1px;">N${s.night ?? i + 1}</div>
        </div>`,
        iconSize: [36, 28], className: "",
      });
      L.marker([lat, lng], { icon }).bindPopup(s.name || `Nacht ${s.night}`).addTo(group);
    });

    waypoints.forEach((w, i) => {
      const lat = w.lat ? Number(w.lat) : null;
      const lng = w.lng ? Number(w.lng) : null;
      if (!lat || !lng) return;
      const icon = L.divIcon({
        html: `<div style="display:flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:#f59e0b;border:1.5px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,.3);color:#fff;font-size:8px;font-weight:800;">${i + 1}</div>`,
        iconSize: [16, 16], className: "",
      });
      L.marker([lat, lng], { icon }).bindPopup(w.name || "Wegpunkt").addTo(group);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, JSON.stringify(routePoints), JSON.stringify(waypoints), JSON.stringify(overnightStops), JSON.stringify(parking)]);

  // Live participant markers — the part that actually updates in real time.
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
