"use client";

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";

export type RouteMapHandle = {
  /** Pans/zooms the existing map to a point — used so detail-page lists can
   *  jump to a marker instead of opening a separate external map. */
  flyTo: (lat: number, lng: number, zoom?: number) => void;
};

type RouteMapProps = {
  locations: { lat: number; lng: number; timestamp: string }[];
  startLat?: number | null;
  startLng?: number | null;
  /** Optional planned route from an uploaded GPX file — drawn as a thinner,
   *  lighter line distinct from the live GPS-tracking polyline. */
  plannedRoute?: { lat: number; lng: number }[];
  waypoints?: { name?: string; lat: number; lng: number }[];
  overnightStops?: { night: number; name?: string; lat?: number | null; lng?: number | null }[];
  parking?: { lat: number | null; lng: number | null; name?: string | null } | null;
};

const RouteMap = forwardRef<RouteMapHandle, RouteMapProps>(function RouteMap(
  { locations, startLat, startLng, plannedRoute, waypoints, overnightStops, parking },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const plannedLineRef = useRef<any>(null);
  const lastMarkerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useImperativeHandle(ref, () => ({
    flyTo(lat: number, lng: number, zoom = 15) {
      mapRef.current?.flyTo([lat, lng], zoom, { duration: 0.6 });
    },
  }));

  // Initial setup — runs once per mount (not per location update).
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
      leafletRef.current = L.default;

      const points = locations.map((l) => [l.lat, l.lng] as [number, number]);
      const plannedPoints = (plannedRoute ?? []).map((p) => [p.lat, p.lng] as [number, number]);
      const waypointPoints = (waypoints ?? []).filter((w) => w.lat && w.lng).map((w) => [w.lat, w.lng] as [number, number]);
      if (parking?.lat && parking?.lng) waypointPoints.push([parking.lat, parking.lng]);
      const allBoundsPoints = [...(points.length > 0 ? points : plannedPoints), ...waypointPoints];
      const center =
        points[points.length - 1] ??
        plannedPoints[0] ??
        (startLat && startLng ? ([startLat, startLng] as [number, number]) : [46.8182, 8.2275]);

      const map = L.default.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
        center,
        zoom: allBoundsPoints.length > 0 ? 13 : 7,
      });
      mapRef.current = map;

      L.default
        .tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
          maxZoom: 18,
          subdomains: "abc",
        })
        .addTo(map);

      // Planned route from GPX, drawn first so the live track sits on top.
      if (plannedPoints.length > 1) {
        plannedLineRef.current = L.default
          .polyline(plannedPoints, { color: "#357a5c", weight: 3, opacity: 0.55, dashArray: "6 6" })
          .addTo(map);
      }

      // Waypoints from GPX / manually added
      (waypoints ?? []).forEach((wp) => {
        if (!wp.lat || !wp.lng) return;
        L.default
          .circleMarker([wp.lat, wp.lng], { radius: 6, fillColor: "#f59e0b", color: "#fff", weight: 2, fillOpacity: 1 })
          .bindPopup(wp.name || "Wegpunkt")
          .addTo(map);
      });

      // Parking location, if set
      if (parking?.lat && parking?.lng) {
        L.default
          .circleMarker([parking.lat, parking.lng], { radius: 8, fillColor: "#0d2410", color: "#fff", weight: 2, fillOpacity: 1 })
          .bindPopup(parking.name || "Parkplatz")
          .addTo(map);
      }

      // Overnight stops, shown as a moon marker
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

      if (startLat && startLng) {
        L.default
          .circleMarker([startLat, startLng], {
            radius: 8, fillColor: "#2c694e", color: "#fff", weight: 2, fillOpacity: 1,
          })
          .bindPopup("Start")
          .addTo(map);
      }

      if (points.length > 1) {
        polylineRef.current = L.default
          .polyline(points, { color: "#2c694e", weight: 3, opacity: 0.8 })
          .addTo(map);
      }

      if (points.length > 0) {
        const last = points[points.length - 1];
        lastMarkerRef.current = L.default
          .circleMarker(last, { radius: 9, fillColor: "#ba1a1a", color: "#fff", weight: 3, fillOpacity: 1 })
          .bindPopup("Letzter Standort")
          .addTo(map);
      }

      if (allBoundsPoints.length > 1) {
        map.fitBounds(L.default.latLngBounds(allBoundsPoints), { padding: [30, 30] });
      }

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
    // Intentionally only re-run on mount — live location updates are handled
    // by the effect below without tearing down the whole map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live updates: when new GPS points arrive (via the realtime WebSocket
  // upstream), redraw just the polyline and last-position marker instead of
  // recreating the entire map — avoids flicker and keeps the user's current
  // pan/zoom if they moved the map themselves.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !ready) return;

    const points = locations.map((l) => [l.lat, l.lng] as [number, number]);
    if (points.length === 0) return;

    if (points.length > 1) {
      if (polylineRef.current) {
        polylineRef.current.setLatLngs(points);
      } else {
        polylineRef.current = L.polyline(points, { color: "#2c694e", weight: 3, opacity: 0.8 }).addTo(map);
      }
    }

    const last = points[points.length - 1];
    if (lastMarkerRef.current) {
      lastMarkerRef.current.setLatLng(last);
    } else {
      lastMarkerRef.current = L.circleMarker(last, {
        radius: 9, fillColor: "#ba1a1a", color: "#fff", weight: 3, fillOpacity: 1,
      }).bindPopup("Letzter Standort").addTo(map);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(locations), ready]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: "1px" }} className="bg-forest-100">
      {!ready && <div style={{ width: "100%", height: "100%" }} />}
    </div>
  );
});

export default RouteMap;
