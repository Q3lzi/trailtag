"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The large, primary map for the dashboard's "mission control" view.
 * Unlike the tour-detail RouteMap, this map's hero element is the live
 * pulsing position — but it still needs the planned route/markers as
 * context, otherwise an observer can't tell "on track" from "off track".
 */
export default function SituationMap({
  lat,
  lng,
  accuracy,
  plannedRoute,
  startLat,
  startLng,
  waypoints,
  overnightStops,
  parking,
}: {
  lat: number;
  lng: number;
  accuracy?: number | null;
  plannedRoute?: { lat: number; lng: number }[];
  startLat?: number | null;
  startLng?: number | null;
  waypoints?: { name?: string; lat: number; lng: number }[];
  overnightStops?: { night: number; name?: string; lat?: number | null; lng?: number | null }[];
  parking?: { lat: number | null; lng: number | null; name?: string | null } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
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
          if (hasSize(el)) { clearInterval(pollTimer); resolve(); }
        }, 50);
      });
      if (cancelled || !containerRef.current) return;

      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L.default;

      const map = L.default.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
        center: [lat, lng],
        zoom: 13,
      });
      mapRef.current = map;

      L.default
        .tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { maxZoom: 18, subdomains: "abc" })
        .addTo(map);

      // Planned route, drawn first so the live marker sits visually on top.
      const plannedPoints = (plannedRoute ?? []).map((p) => [p.lat, p.lng] as [number, number]);
      if (plannedPoints.length > 1) {
        L.default.polyline(plannedPoints, { color: "#357a5c", weight: 3, opacity: 0.55, dashArray: "6 6" }).addTo(map);
      }

      if (startLat && startLng) {
        L.default
          .circleMarker([startLat, startLng], { radius: 7, fillColor: "#2c694e", color: "#fff", weight: 2, fillOpacity: 1 })
          .bindPopup("Start")
          .addTo(map);
      }

      (waypoints ?? []).forEach((wp) => {
        if (!wp.lat || !wp.lng) return;
        L.default
          .circleMarker([wp.lat, wp.lng], { radius: 6, fillColor: "#f59e0b", color: "#fff", weight: 2, fillOpacity: 1 })
          .bindPopup(wp.name || "Wegpunkt")
          .addTo(map);
      });

      if (parking?.lat && parking?.lng) {
        L.default
          .circleMarker([parking.lat, parking.lng], { radius: 8, fillColor: "#0d2410", color: "#fff", weight: 2, fillOpacity: 1 })
          .bindPopup(parking.name || "Parkplatz")
          .addTo(map);
      }

      (overnightStops ?? []).forEach((stop) => {
        if (!stop.lat || !stop.lng) return;
        const icon = L.default.divIcon({
          html: '<div style="font-size:16px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4))">🌙</div>',
          iconSize: [18, 18],
          className: "",
        });
        L.default
          .marker([stop.lat, stop.lng], { icon })
          .bindPopup(`Nacht ${stop.night}${stop.name ? ": " + stop.name : ""}`)
          .addTo(map);
      });

      // Fit the whole planned route in view first, so the observer sees the
      // full picture on load — the effect below then nudges towards the
      // live point without fighting this initial framing.
      const allPlanned = [
        ...plannedPoints,
        ...(startLat && startLng ? [[startLat, startLng] as [number, number]] : []),
      ];
      if (allPlanned.length > 1) {
        map.fitBounds(L.default.latLngBounds([...allPlanned, [lat, lng]]), { padding: [40, 40] });
      } else {
        map.setView([lat, lng], 14);
      }

      if (accuracy && accuracy > 0) {
        circleRef.current = L.default
          .circle([lat, lng], { radius: accuracy, color: "#4a8f6f", weight: 1, fillColor: "#4a8f6f", fillOpacity: 0.12 })
          .addTo(map);
      }

      // Pulsing marker via a CSS-animated divIcon, not a static circleMarker —
      // this is the one thing on the whole dashboard that should feel alive.
      const icon = L.default.divIcon({
        html: `<div style="position:relative;width:18px;height:18px;">
          <div style="position:absolute;inset:0;border-radius:50%;background:#4a8f6f;opacity:0.35;animation:situationPulse 2s ease-out infinite;"></div>
          <div style="position:absolute;inset:4px;border-radius:50%;background:#2c694e;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3);"></div>
        </div>`,
        iconSize: [18, 18],
        className: "",
      });
      markerRef.current = L.default.marker([lat, lng], { icon }).bindPopup("Letzter Standort").addTo(map);

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

  // Move the live marker smoothly on subsequent updates instead of
  // re-mounting the map (which would also reset the user's pan/zoom).
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !ready) return;
    markerRef.current?.setLatLng([lat, lng]);
    circleRef.current?.setLatLng([lat, lng]);
    if (accuracy) circleRef.current?.setRadius(accuracy);
    map.panTo([lat, lng], { animate: true, duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, ready]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: "1px" }} className="bg-forest-100">
      {!ready && <div style={{ width: "100%", height: "100%" }} />}
      <style jsx global>{`
        @keyframes situationPulse {
          0% { transform: scale(1); opacity: 0.35; }
          100% { transform: scale(2.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
