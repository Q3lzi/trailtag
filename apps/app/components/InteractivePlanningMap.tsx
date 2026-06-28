"use client";

import { useEffect, useRef, useState } from "react";

type MarkerKind = "parking" | "overnight" | "waypoint";

export default function InteractivePlanningMap({
  routePoints,
  startLat,
  startLng,
  parking,
  overnightStops,
  waypoints,
  onSetParking,
  onAddOvernightAt,
  onAddWaypointAt,
  /** Which placement mode is active — null means clicking the map does nothing. */
  activeMode,
}: {
  routePoints: { lat: number; lng: number }[];
  startLat?: number | null;
  startLng?: number | null;
  parking?: { lat: number | null; lng: number | null } | null;
  overnightStops: { night: number; lat?: string | number | null; lng?: string | number | null; name?: string }[];
  waypoints: { name?: string; lat?: string | number | null; lng?: string | number | null }[];
  onSetParking: (lat: number, lng: number) => void;
  onAddOvernightAt: (lat: number, lng: number) => void;
  onAddWaypointAt: (lat: number, lng: number) => void;
  activeMode: MarkerKind | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const startMarkerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const clickHandlerRef = useRef<(lat: number, lng: number) => void>();

  // Keep the latest click behavior available to the persistent map click listener.
  clickHandlerRef.current = (lat: number, lng: number) => {
    if (activeMode === "parking") onSetParking(lat, lng);
    if (activeMode === "overnight") onAddOvernightAt(lat, lng);
    if (activeMode === "waypoint") onAddWaypointAt(lat, lng);
  };

  // Mount the map once. Route/start are drawn here too for the very first
  // paint, but the effect below is what keeps them in sync afterwards —
  // important because the GPX file is often uploaded *after* this step is
  // already mounted (routePoints starts empty, then arrives later).
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

      const center = (startLat && startLng ? [startLat, startLng] as [number, number] : [46.8182, 8.2275]);

      const map = L.default.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
        center,
        zoom: 8,
      });
      mapRef.current = map;

      L.default
        .tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { maxZoom: 18, subdomains: "abc" })
        .addTo(map);

      layerGroupRef.current = L.default.layerGroup().addTo(map);

      map.on("click", (e: any) => {
        clickHandlerRef.current?.(e.latlng.lat, e.latlng.lng);
      });

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

  // Draw/update the route line and start marker whenever they change —
  // this is what makes the line appear once a GPX file is uploaded after
  // the map has already mounted, instead of only on the very first paint.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !ready) return;

    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }
    if (startMarkerRef.current) {
      map.removeLayer(startMarkerRef.current);
      startMarkerRef.current = null;
    }

    const routeLatLngs = routePoints.map((p) => [p.lat, p.lng] as [number, number]);

    if (routeLatLngs.length > 1) {
      routeLineRef.current = L.polyline(routeLatLngs, { color: "#357a5c", weight: 3, opacity: 0.6, dashArray: "6 6" }).addTo(map);
      map.fitBounds(L.latLngBounds(routeLatLngs), { padding: [30, 30] });
    } else if (startLat && startLng) {
      map.setView([startLat, startLng], 13);
    }

    if (startLat && startLng) {
      startMarkerRef.current = L
        .circleMarker([startLat, startLng], { radius: 7, fillColor: "#2c694e", color: "#fff", weight: 2, fillOpacity: 1 })
        .bindPopup("Start")
        .addTo(map);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, JSON.stringify(routePoints), startLat, startLng]);

  // Redraw placed markers whenever parking/overnight/waypoints change.
  useEffect(() => {
    const L = leafletRef.current;
    const group = layerGroupRef.current;
    if (!L || !group || !ready) return;
    group.clearLayers();

    if (parking?.lat && parking?.lng) {
      L.circleMarker([parking.lat, parking.lng], { radius: 8, fillColor: "#0d2410", color: "#fff", weight: 2, fillOpacity: 1 })
        .bindPopup("Parkplatz")
        .addTo(group);
    }

    overnightStops.forEach((s) => {
      const lat = s.lat ? Number(s.lat) : null;
      const lng = s.lng ? Number(s.lng) : null;
      if (!lat || !lng) return;
      const icon = L.divIcon({
        html: '<div style="font-size:16px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4))">🌙</div>',
        iconSize: [18, 18], className: "",
      });
      L.marker([lat, lng], { icon }).bindPopup(`Nacht ${s.night}${s.name ? ": " + s.name : ""}`).addTo(group);
    });

    waypoints.forEach((w) => {
      const lat = w.lat ? Number(w.lat) : null;
      const lng = w.lng ? Number(w.lng) : null;
      if (!lat || !lng) return;
      L.circleMarker([lat, lng], { radius: 6, fillColor: "#f59e0b", color: "#fff", weight: 2, fillOpacity: 1 })
        .bindPopup(w.name || "Wegpunkt")
        .addTo(group);
    });
  }, [ready, parking, JSON.stringify(overnightStops), JSON.stringify(waypoints)]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: "1px" }} className="bg-forest-100">
      {!ready && <div style={{ width: "100%", height: "100%" }} />}
    </div>
  );
}
