import { XMLParser } from 'fast-xml-parser';

export interface GpxPoint {
  lat: number;
  lng: number;
  ele?: number;
  time?: string;
}

export interface GpxData {
  points: GpxPoint[];
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  distanceKm: number;
  elevationUp: number;
  elevationDown: number;
}

function haversineDistance(a: GpxPoint, b: GpxPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function parseGpx(xmlString: string): GpxData {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const result = parser.parse(xmlString);

  const gpx = result.gpx;
  if (!gpx) throw new Error('Ungültige GPX-Datei');

  // Track-Punkte extrahieren
  let rawPoints: any[] = [];

  if (gpx.trk) {
    const trk = Array.isArray(gpx.trk) ? gpx.trk[0] : gpx.trk;
    const trkseg = Array.isArray(trk.trkseg) ? trk.trkseg[0] : trk.trkseg;
    rawPoints = Array.isArray(trkseg.trkpt) ? trkseg.trkpt : [trkseg.trkpt];
  } else if (gpx.rte) {
    const rte = Array.isArray(gpx.rte) ? gpx.rte[0] : gpx.rte;
    rawPoints = Array.isArray(rte.rtept) ? rte.rtept : [rte.rtept];
  }

  if (rawPoints.length === 0) throw new Error('Keine Track-Punkte gefunden');

  const points: GpxPoint[] = rawPoints.map((p: any) => ({
    lat: parseFloat(p['@_lat']),
    lng: parseFloat(p['@_lon']),
    ele: p.ele ? parseFloat(p.ele) : undefined,
    time: p.time || undefined,
  }));

  // Distanz berechnen
  let distanceKm = 0;
  for (let i = 1; i < points.length; i++) {
    distanceKm += haversineDistance(points[i - 1], points[i]);
  }

  // Höhenmeter berechnen
  let elevationUp = 0;
  let elevationDown = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].ele;
    const curr = points[i].ele;
    if (prev !== undefined && curr !== undefined) {
      const diff = curr - prev;
      if (diff > 0) elevationUp += diff;
      else elevationDown += Math.abs(diff);
    }
  }

  return {
    points,
    startLat: points[0].lat,
    startLng: points[0].lng,
    endLat: points[points.length - 1].lat,
    endLng: points[points.length - 1].lng,
    distanceKm: Math.round(distanceKm * 10) / 10,
    elevationUp: Math.round(elevationUp),
    elevationDown: Math.round(elevationDown),
  };
}