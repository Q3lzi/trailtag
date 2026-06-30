"use client";

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";

type MarkerKind = "parking" | "overnight" | "waypoint";

export type InteractivePlanningMapHandle = {
  /** Pans/zooms to a point and opens its popup — this is what makes a
   *  waypoint list entry actually useful, not just text disconnected from
   *  the map. */
  flyTo: (lat: number, lng: number, zoom?: number) => void;
};

type Props = {
  routePoints: { lat: number; lng: number }[];
  startLat?: number | null;
  startLng?: number | null;
  parking?: { lat: number | null; lng: number | null } | null;
  overnightStops: { id?: string; night: number; lat?: string | number | null; lng?: string | number | null; name?: string }[];
  waypoints: { id?: string; name?: string; lat?: string | number | null; lng?: string | number | null }[];
  onSetParking: (lat: number, lng: number) => void;
  onAddOvernightAt: (lat: number, lng: number) => void;
  onAddWaypointAt: (lat: number, lng: number) => void;
  activeMode: MarkerKind | null;
};

const InteractivePlanningMap = forwardRef<InteractivePlanningMapHandle, Props>(function InteractivePlanningMap({
  routePoints,
  startLat,
  startLng,
  parking,
  overnightStops,
  waypoints,
  onSetParking,
  onAddOvernightAt,
  onAddWaypointAt,
  activeMode,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const startMarkerRef = useRef<any>(null);
  // Keyed by point id, so clicking a list entry can find and open the
  // matching marker's popup, not just pan near it.
  const markersByIdRef = useRef<Map<string, any>>(new Map());
  const [ready, setReady] = useState(false);
  const clickHandlerRef = useRef<(lat: number, lng: number) => void>();

  clickHandlerRef.current = (lat: number, lng: number) => {
    if (activeMode === "parking") onSetParking(lat, lng);
    if (activeMode === "overnight") onAddOvernightAt(lat, lng);
    if (activeMode === "waypoint") onAddWaypointAt(lat, lng);
  };

  useImperativeHandle(ref, () => ({
    flyTo(lat: number, lng: number, zoom = 15) {
      const map = mapRef.current;
      if (!map) return;
      map.flyTo([lat, lng], zoom, { duration: 0.6 });
      // Try to open the matching marker's popup once the fly animation
      // settles, so the click feels connected to a specific point, not
      // just "somewhere over here".
      const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      const marker = markersByIdRef.current.get(key);
      if (marker) setTimeout(() => marker.openPopup(), 650);
    },
  }));

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

  // Redraw placed markers whenever parking/overnight/waypoints change, and
  // keep the id->marker lookup in sync so flyTo can reopen the right popup.
  useEffect(() => {
    const L = leafletRef.current;
    const group = layerGroupRef.current;
    if (!L || !group || !ready) return;
    group.clearLayers();
    markersByIdRef.current.clear();

    function keyFor(lat: number, lng: number) {
      return `${lat.toFixed(5)},${lng.toFixed(5)}`;
    }

    if (parking?.lat && parking?.lng) {
      const m = L.circleMarker([parking.lat, parking.lng], { radius: 8, fillColor: "#0d2410", color: "#fff", weight: 2, fillOpacity: 1 })
        .bindPopup("Parkplatz")
        .addTo(group);
      markersByIdRef.current.set(keyFor(parking.lat, parking.lng), m);
    }

    overnightStops.forEach((s, i) => {
      const lat = s.lat ? Number(s.lat) : null;
      const lng = s.lng ? Number(s.lng) : null;
      if (!lat || !lng) return;
      const icon = L.divIcon({
        html: `<div style="display:flex;flex-direction:column;align-items:center;">
          <div style="font-size:16px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4))">🌙</div>
          <div style="background:#0d2410;color:#fff;font-size:9px;font-weight:700;padding:1px 4px;border-radius:6px;margin-top:1px;">N${s.night ?? i + 1}</div>
        </div>`,
        iconSize: [40, 32], className: "",
      });
      const m = L.marker([lat, lng], { icon }).bindPopup(`Nacht ${s.night}${s.name ? ": " + s.name : ""}`).addTo(group);
      markersByIdRef.current.set(keyFor(lat, lng), m);
    });

    waypoints.forEach((w, i) => {
      const lat = w.lat ? Number(w.lat) : null;
      const lng = w.lng ? Number(w.lng) : null;
      if (!lat || !lng) return;
      const icon = L.divIcon({
        html: `<div style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#f59e0b;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3);color:#fff;font-size:10px;font-weight:800;">${i + 1}</div>`,
        iconSize: [20, 20], className: "",
      });
      const m = L.marker([lat, lng], { icon }).bindPopup(w.name || "Wegpunkt").addTo(group);
      markersByIdRef.current.set(keyFor(lat, lng), m);
    });
  }, [ready, parking, JSON.stringify(overnightStops), JSON.stringify(waypoints)]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: "1px" }} className="bg-forest-100">
      {!ready && <div style={{ width: "100%", height: "100%" }} />}
    </div>
  );
});

export default InteractivePlanningMap;
