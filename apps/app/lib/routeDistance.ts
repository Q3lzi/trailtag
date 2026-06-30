/**
 * Finds how far along a GPX route (in km) the nearest point to a given
 * lat/lng is — this is what turns "Wasserstelle" into "Wasserstelle bei
 * km 8.2", the kind of orientation someone actually needs when reading a
 * route plan rather than looking at a live map.
 */
export function distanceAlongRoute(
  point: { lat: number; lng: number },
  routePoints: { lat: number; lng: number }[]
): number | null {
  if (routePoints.length < 2) return null;

  let nearestIdx = 0;
  let nearestDist = Infinity;
  for (let i = 0; i < routePoints.length; i++) {
    const d = haversine(point, routePoints[i]);
    if (d < nearestDist) {
      nearestDist = d;
      nearestIdx = i;
    }
  }

  // Only treat it as "on the route" if reasonably close (2km) — otherwise
  // a wildly off-route point would still claim a misleading km marker.
  if (nearestDist > 2) return null;

  let cumulative = 0;
  for (let i = 1; i <= nearestIdx; i++) {
    cumulative += haversine(routePoints[i - 1], routePoints[i]);
  }
  return Math.round(cumulative * 10) / 10;
}

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}