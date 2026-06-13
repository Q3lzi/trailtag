// Enhanced GPX Parser — extracts everything possible
export function parseGpx(gpxContent: string) {
  // Route name: try metadata/name first, then trk/name
  const metaNameMatch = gpxContent.match(/<metadata[^>]*>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>/i);
  const trkNameMatch = gpxContent.match(/<trk[^>]*>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>/i);
  const routeName = (metaNameMatch?.[1] || trkNameMatch?.[1] || '').trim().replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>') || null;

  // Track points
  const trkptRegex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/gi;
  const points: { lat: number; lng: number; ele: number | null; time: string | null }[] = [];
  let match;
  while ((match = trkptRegex.exec(gpxContent)) !== null) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    const inner = match[3];
    const eleMatch = inner.match(/<ele[^>]*>([\s\S]*?)<\/ele>/i);
    const timeMatch = inner.match(/<time[^>]*>([\s\S]*?)<\/time>/i);
    points.push({
      lat,
      lng,
      ele: eleMatch ? parseFloat(eleMatch[1]) : null,
      time: timeMatch ? timeMatch[1].trim() : null,
    });
  }

  // Waypoints (wpt tags)
  const wptRegex = /<wpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/wpt>/gi;
  const waypoints: { lat: number; lng: number; name: string; sym: string | null; ele: number | null }[] = [];
  while ((match = wptRegex.exec(gpxContent)) !== null) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    const inner = match[3];
    const nameMatch = inner.match(/<name[^>]*>([\s\S]*?)<\/name>/i);
    const symMatch = inner.match(/<sym[^>]*>([\s\S]*?)<\/sym>/i);
    const eleMatch = inner.match(/<ele[^>]*>([\s\S]*?)<\/ele>/i);
    waypoints.push({
      lat,
      lng,
      name: (nameMatch?.[1] || '').trim().replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'),
      sym: symMatch ? symMatch[1].trim() : null,
      ele: eleMatch ? parseFloat(eleMatch[1]) : null,
    });
  }

  if (points.length === 0) throw new Error('Keine Trackpunkte in GPX gefunden');

  // Distance calculation (Haversine)
  let totalDistance = 0;
  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    const R = 6371;
    const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
    const dLon = ((p2.lng - p1.lng) * Math.PI) / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(p1.lat*Math.PI/180) * Math.cos(p2.lat*Math.PI/180) * Math.sin(dLon/2)**2;
    totalDistance += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Elevation gain/loss
  let elevationUp = 0, elevationDown = 0;
  for (let i = 1; i < points.length; i++) {
    const e1 = points[i-1].ele, e2 = points[i].ele;
    if (e1 != null && e2 != null) {
      const diff = e2 - e1;
      if (diff > 0) elevationUp += diff;
      else elevationDown += Math.abs(diff);
    }
  }

  // Duration from timestamps
  let durationMinutes: number | null = null;
  const firstTime = points.find(p => p.time)?.time;
  const lastTime = [...points].reverse().find(p => p.time)?.time;
  if (firstTime && lastTime) {
    durationMinutes = Math.round((new Date(lastTime).getTime() - new Date(firstTime).getTime()) / 60000);
  }

  // Elevation stats
  const elevations = points.map(p => p.ele).filter((e): e is number => e != null);
  const minEle = elevations.length ? Math.round(Math.min(...elevations)) : null;
  const maxEle = elevations.length ? Math.round(Math.max(...elevations)) : null;

  // Bounding box
  const lats = points.map(p => p.lat);
  const lngs = points.map(p => p.lng);

  // Description string (like WP version shows)
  const durationStr = durationMinutes ? `~${Math.floor(durationMinutes/60)}h ${durationMinutes%60}min` : null;
  const summaryLine = [
    routeName,
    `${totalDistance.toFixed(1)} km`,
    elevationUp > 0 ? `↑ ${Math.round(elevationUp)} m` : null,
    elevationDown > 0 ? `↓ ${Math.round(elevationDown)} m` : null,
    durationStr,
    `${points.length} Punkte`,
  ].filter(Boolean).join(' · ');

  return {
    routeName,
    points,
    waypoints,
    pointCount: points.length,
    waypointCount: waypoints.length,
    distanceKm: parseFloat(totalDistance.toFixed(1)),
    elevationUp: Math.round(elevationUp),
    elevationDown: Math.round(elevationDown),
    durationMinutes,
    minEle,
    maxEle,
    startLat: points[0].lat,
    startLng: points[0].lng,
    endLat: points[points.length-1].lat,
    endLng: points[points.length-1].lng,
    bounds: {
      minLat: Math.min(...lats), maxLat: Math.max(...lats),
      minLng: Math.min(...lngs), maxLng: Math.max(...lngs),
    },
    summaryLine,
    startTime: firstTime,
    endTime: lastTime,
  };
}