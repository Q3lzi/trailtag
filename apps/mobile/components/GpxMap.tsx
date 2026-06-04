import { useEffect, useRef } from 'react';

interface Props {
  points: { lat: number; lng: number; ele?: number }[];
}

export default function GpxMap({ points }: Props) {
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || points.length === 0) return;

    // Leaflet CSS laden
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    import('leaflet').then((L) => {
      // Alten Map zerstören falls vorhanden
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const latlngs: [number, number][] = points.map(p => [p.lat, p.lng]);

      const map = L.default.map(containerRef.current!, { zoomControl: true });
      mapRef.current = map;

      L.default.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map);

      // Route zeichnen
      const polyline = L.default.polyline(latlngs, {
        color: '#2D6A4F',
        weight: 4,
        opacity: 0.9,
      }).addTo(map);

      // Startpunkt
      L.default.circleMarker(latlngs[0], {
        radius: 8, fillColor: '#2D6A4F', color: '#fff', weight: 2, fillOpacity: 1
      }).bindPopup('🟢 Start').addTo(map);

      // Endpunkt
      L.default.circleMarker(latlngs[latlngs.length - 1], {
        radius: 8, fillColor: '#e63946', color: '#fff', weight: 2, fillOpacity: 1
      }).bindPopup('🔴 Ziel').addTo(map);

      // Zoom auf Route
      map.fitBounds(polyline.getBounds(), { padding: [20, 20] });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [points]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: 300, borderRadius: 12, overflow: 'hidden', marginTop: 12 }}
    />
  );
}