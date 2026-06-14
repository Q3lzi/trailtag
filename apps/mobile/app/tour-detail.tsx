import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, Linking, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { apiFetch } from '../lib/api';
import { getToken } from '../lib/storage';
import { showAlert, showConfirm } from '../lib/alert';
import { cancelAllNotifications } from '../lib/notifications';
import { startLocationTracking, stopLocationTracking } from '../lib/tracking';
import { ArrowLeft, Timer, Wind, Thermometer, RefreshCw, CheckCircle, AlertTriangle, Link, Navigation, Activity, Mountain, Users, MessageCircle, Moon, MapPin as MapPinIcon, Phone } from 'lucide-react-native';

const ACTIVITY_COLORS: Record<string, string> = {
  WANDERN: '#1a3d2b', BERGTOUR: '#0f2027', KLETTERN: '#1a1a2e',
  TRAILRUNNING: '#1a2e1a', MOUNTAINBIKE: '#1f2d1f', RADSPORT: '#162616',
  SKI_SNOWBOARD: '#0d1b2a', SKITOUR: '#0d1b2a', KLETTERSTEIG: '#1a1a2e',
  KANU_KAJAK: '#0d2137', PARAGLIDING: '#0d1f3c', ANDERE: '#1a2e1a',
};

const ACTIVITY_LABELS: Record<string, string> = {
  WANDERN: 'Wandern', BERGTOUR: 'Bergtour', KLETTERN: 'Klettern',
  TRAILRUNNING: 'Trailrunning', MOUNTAINBIKE: 'Mountainbike', RADSPORT: 'Radsport',
  SKI_SNOWBOARD: 'Ski / Snowboard', SKITOUR: 'Skitour', KLETTERSTEIG: 'Klettersteig',
  KANU_KAJAK: 'Kanu / Kajak', PARAGLIDING: 'Paragliding', ANDERE: 'Andere',
};

const WMO_CODES: Record<number, { text: string }> = {
  0: { text: 'Klar' }, 1: { text: 'Überwiegend klar' }, 2: { text: 'Teilweise bewölkt' },
  3: { text: 'Bewölkt' }, 45: { text: 'Nebel' }, 61: { text: 'Leichter Regen' },
  63: { text: 'Regen' }, 71: { text: 'Schneefall' }, 80: { text: 'Schauer' }, 95: { text: 'Gewitter' },
};

function useCountdown(eta: string | null) {
  const [timeLeft, setTimeLeft] = useState('--:--:--');
  const [isOverdue, setIsOverdue] = useState(false);
  const [progress, setProgress] = useState(1);
  useEffect(() => {
    if (!eta) return;
    const endTime = new Date(eta).getTime();
    const totalDuration = endTime - Date.now();
    const interval = setInterval(() => {
      const diff = endTime - Date.now();
      if (diff <= 0) { setTimeLeft('ÜBERFÄLLIG'); setIsOverdue(true); setProgress(0); return; }
      setIsOverdue(false);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
      setProgress(Math.max(0, diff / totalDuration));
    }, 1000);
    return () => clearInterval(interval);
  }, [eta]);
  return { timeLeft, isOverdue, progress };
}

async function fetchWeather(lat: number, lng: number) {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weathercode,windspeed_10m,relative_humidity_2m,apparent_temperature&hourly=temperature_2m,weathercode,windspeed_10m,precipitation_probability,snowfall&wind_speed_unit=kmh&timezone=Europe/Zurich&forecast_days=1`);
    const data = await res.json();
    const currentHour = new Date().getHours();
    const nextHours = Array.from({ length: 6 }, (_, i) => currentHour + i + 1).filter(h => h < 24);
    const warnings: string[] = [];
    for (const h of nextHours) {
      const code = data.hourly.weathercode[h];
      const wind = data.hourly.windspeed_10m[h];
      const snow = data.hourly.snowfall[h];
      const precip = data.hourly.precipitation_probability[h];
      const temp = data.hourly.temperature_2m[h];
      if (code >= 95) warnings.push(`Gewitter um ${h}:00`);
      else if (code >= 80) warnings.push(`Starke Schauer um ${h}:00`);
      if (snow > 0.5) warnings.push(`Schneefall um ${h}:00 (${snow.toFixed(1)} cm)`);
      if (wind > 60) warnings.push(`Starker Wind um ${h}:00 (${wind} km/h)`);
      if (temp < 0) warnings.push(`Frost um ${h}:00 (${temp}°C)`);
      if (precip > 70 && code >= 61) warnings.push(`Hohe Regenwahrscheinlichkeit um ${h}:00`);
    }
    return {
      temp: Math.round(data.current.temperature_2m),
      feelsLike: Math.round(data.current.apparent_temperature),
      code: data.current.weathercode,
      wind: Math.round(data.current.windspeed_10m),
      humidity: data.current.relative_humidity_2m,
      warnings: [...new Set(warnings)],
    };
  } catch { return null; }
}

function ElevationChart({ points }: { points: any[] }) {
  if (Platform.OS !== 'web') return null;
  const filtered = points.filter((p: any) => p.ele != null);
  if (filtered.length < 2) return null;
  const eles = filtered.map((p: any) => p.ele);
  const minEle = Math.min(...eles);
  const maxEle = Math.max(...eles);
  const range = maxEle - minEle || 1;
  const svgW = Math.max(600, filtered.length * 1.5);
  const h = 100, pad = 10;
  const pts = filtered.map((p: any, i: number) => {
    const x = pad + (i / (filtered.length - 1)) * (svgW - pad * 2);
    const y = h - pad - ((p.ele - minEle) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  const area = `${pad},${h - pad} ${pts} ${svgW - pad},${h - pad}`;
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: '#747871', letterSpacing: 1, marginBottom: 8 }}>HÖHENPROFIL</Text>
      <View style={{ backgroundColor: '#fff', borderRadius: 4, borderWidth: 1, borderColor: '#e1e3e4', overflow: 'hidden' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <svg viewBox={`0 0 ${svgW} ${h}`} style={{ width: svgW, height: 100 } as any}>
            <defs>
              <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2c694e" stopOpacity="0.3"/>
                <stop offset="100%" stopColor="#2c694e" stopOpacity="0.02"/>
              </linearGradient>
            </defs>
            <polygon points={area} fill="url(#eg)"/>
            <polyline points={pts} fill="none" stroke="#2c694e" strokeWidth="2"/>
            <text x={pad + 2} y={pad + 12} fontSize="10" fill="#747871">{Math.round(maxEle)} m</text>
            <text x={pad + 2} y={h - 4} fontSize="10" fill="#747871">{Math.round(minEle)} m</text>
          </svg>
        </ScrollView>
      </View>
    </View>
  );
}

export default function TourDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [tour, setTour] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState<any>(null);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [extendLoading, setExtendLoading] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number, time: string} | null>(null);
  const leafletMapRef = useRef<any>(null);
  const mapSectionRef = useRef<any>(null);
  const scrollViewRef = useRef<any>(null);
  const { timeLeft, isOverdue, progress } = useCountdown(tour?.eta ?? null);

  useEffect(() => {
    loadTour();
    const interval = setInterval(loadTour, 60000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    if (!tour) return;
    const lat = tour.lastLat ?? tour.startLat;
    const lng = tour.lastLng ?? tour.startLng;
    if (lat && lng) fetchWeather(lat, lng).then(setWeather);
  }, [tour?.lastLat, tour?.lastLng]);

  useEffect(() => {
    if (!selectedLocation || Platform.OS !== 'web') return;
    // Scroll to map section
    if (scrollViewRef.current && mapSectionRef.current) {
      mapSectionRef.current.measureLayout(
        scrollViewRef.current,
        (_x: number, y: number) => { scrollViewRef.current?.scrollTo({ y: y - 20, animated: true }); },
        () => {}
      );
    }
    // Wait for map to be ready
    const trySetView = (attempts = 0) => {
      if (!leafletMapRef.current) {
        if (attempts < 10) setTimeout(() => trySetView(attempts + 1), 200);
        return;
      }
      import('leaflet').then((L) => {
        if (!leafletMapRef.current) return;
        try {
          leafletMapRef.current.setView([selectedLocation.lat, selectedLocation.lng], 15, { animate: true });
          L.default.circleMarker([selectedLocation.lat, selectedLocation.lng] as [number, number], {
            radius: 14, fillColor: '#f59e0b', color: '#fff', weight: 3, fillOpacity: 0.9
          }).bindPopup(selectedLocation.time).addTo(leafletMapRef.current).openPopup();
        } catch {}
      });
    };
    trySetView();
  }, [selectedLocation]);

  function initLeafletMap(tourData: any) {
    if (Platform.OS !== 'web') return;
    // Use retry mechanism — map container might not be ready yet
    let attempts = 0;
    const tryInit = () => {
      attempts++;
      const container = document.getElementById('tour-map');
      if (!container || !container.parentElement) {
        if (attempts < 10) setTimeout(tryInit, 300);
        return;
      }
      if (!document.getElementById('leaflet-css-detail')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css-detail'; link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      import('leaflet').then((L) => {
        // Full destroy and rebuild
        if (leafletMapRef.current) {
          try { leafletMapRef.current.remove(); } catch {}
          leafletMapRef.current = null;
        }
        if ((container as any)._leaflet_id) {
          container.innerHTML = '';
          delete (container as any)._leaflet_id;
        }
        // Check if container has been laid out
        if (container.clientWidth === 0 && attempts < 15) {
          setTimeout(tryInit, 300);
          return;
        }
        const lat = tourData.lastLat ?? tourData.startLat ?? tourData.gpxTrack?.points?.[0]?.lat;
        const lng = tourData.lastLng ?? tourData.startLng ?? tourData.gpxTrack?.points?.[0]?.lng;
        if (!lat || !lng) return;
        const map = L.default.map(container, { zoomControl: true });
        leafletMapRef.current = map;
        L.default.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution: '© OpenStreetMap © CARTO' }).addTo(map);
        const gpxPoints = tourData.gpxTrack?.points?.length > 0 ? tourData.gpxTrack.points.map((p: any) => [p.lat, p.lng]) : null;
        const trackPoints = tourData.locations?.length > 0 ? tourData.locations.map((l: any) => [l.lat, l.lng]) : null;
        const displayPoints = gpxPoints ?? trackPoints ?? null;
        if (displayPoints && displayPoints.length > 1) {
          L.default.polyline(displayPoints as [number, number][], { color: '#2c694e', weight: 4, opacity: 0.9 }).addTo(map);
          L.default.circleMarker(displayPoints[0] as [number, number], { radius: 7, fillColor: '#2c694e', color: '#fff', weight: 2, fillOpacity: 1 }).bindPopup('Start').addTo(map);
          if (gpxPoints && trackPoints && trackPoints.length > 1) {
            L.default.polyline(trackPoints as [number, number][], { color: '#f59e0b', weight: 3, opacity: 0.8, dashArray: '5,5' }).addTo(map);
          }
          if (lat && lng) L.default.circleMarker([lat, lng] as [number, number], { radius: 10, fillColor: '#dc2626', color: '#fff', weight: 3, fillOpacity: 1 }).bindPopup('Letzter Standort').addTo(map);
          // GPX Waypoints
          if (tourData.gpxTrack?.waypoints) {
            tourData.gpxTrack.waypoints.forEach((wp: any) => {
              if (wp.lat && wp.lng) L.default.circleMarker([wp.lat, wp.lng] as [number, number], { radius: 7, fillColor: '#f59e0b', color: '#fff', weight: 2, fillOpacity: 1 }).bindPopup(wp.name || 'Wegpunkt').addTo(map);
            });
          }
          // GPS tracking points as small orange dots
          if (tourData.locations?.length > 0) {
            tourData.locations.forEach((loc: any, i: number) => {
              // Show every point but small dots to not clutter
              L.default.circleMarker([loc.lat, loc.lng] as [number, number], {
                radius: 4, fillColor: '#f59e0b', color: '#fff', weight: 1.5, fillOpacity: 0.9,
              }).bindPopup(new Date(loc.timestamp).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })).addTo(map);
            });
          }
          const allPts = [...displayPoints, ...(lat && lng ? [[lat, lng]] : [])] as [number, number][];
          // Tight zoom to show the actual trail path
          map.fitBounds(L.default.latLngBounds(allPts), { padding: [20, 20], maxZoom: 17 });
        } else {
          map.setView([lat, lng], 17);  // Close zoom when only one point
          L.default.circleMarker([lat, lng] as [number, number], { radius: 10, fillColor: '#dc2626', color: '#fff', weight: 3, fillOpacity: 1 }).bindPopup('Letzter Standort').addTo(map);
        }
        setTimeout(() => { try { map.invalidateSize(); } catch {} }, 150);
      });
    };
    setTimeout(tryInit, 400);
  }

  // Trigger map init whenever tour data changes or on first mount
  useEffect(() => {
    if (!tour || Platform.OS !== 'web') return;
    // Delay to ensure DOM is ready after React render
    const t = setTimeout(() => initLeafletMap(tour), 50);
    return () => clearTimeout(t);
  }, [tour?.id, tour?.locations?.length, tour?.lastLat, tour?.lastLng]);

  async function loadTour() {
    try {
      const token = await getToken();
      const data = await apiFetch(`/tours/${id}`, {}, token ?? undefined);
      setTour(data);
      // Auto-restart tracking if tour is active (all platforms)
      if (data.status === 'ACTIVE' || data.status === 'ALARM') {
        startLocationTracking(data.id).catch(() => {});
      }
      // Reinit map with fresh data
      if (Platform.OS === 'web') setTimeout(() => initLeafletMap(data), 100);
    } catch { } finally { setLoading(false); }
  }

  async function handleCheckout() {
    const confirmed = await showConfirm('Bist du sicher zurück?');
    if (!confirmed) return;
    try {
      const token = await getToken();
      await apiFetch(`/tours/${tour.id}/checkout`, { method: 'POST' }, token ?? undefined);
      await stopLocationTracking();
      await cancelAllNotifications();
      router.replace('/dashboard');
    } catch (err: any) { showAlert('Fehler', err.message); }
  }

    function handleLocationSelect(loc: {lat: number, lng: number, time: string}) {
      setSelectedLocation(loc);
      if (Platform.OS === 'web') {
        setTimeout(() => {
          const mapEl = document.getElementById('tour-map');
          if (mapEl) {
            mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    }

  function sharePortalLink() {
    if (!qrUrl) return;
    const routeName = tour.routeName ?? '';
    const eta = tour.eta ? new Date(tour.eta).toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'}) : '--:--';
    const msg = '\u{1F3D4}\uFE0F Tour' + (routeName ? ': ' + routeName : '') + '\nR\u00FCckkehr: ' + eta + '\n\nSafety-Status:\n' + qrUrl;
    if (Platform.OS === 'web') { (window as any).open('sms:?body=' + encodeURIComponent(msg), '_blank'); }
    else { Share.share({ message: msg }); }
  }

  if (loading) return (
    <View style={styles.loading}>
      <Mountain size={36} color="#2c694e" />
      <Text style={styles.loadingText}>Lädt...</Text>
    </View>
  );
  if (!tour) return <View style={styles.loading}><Text style={styles.loadingText}>Tour nicht gefunden</Text></View>;

  const isActive = tour.status === 'ACTIVE' || tour.status === 'ALARM';
  const isPlanned = tour.status === 'PLANNED';
  // Only show as overdue if tour is actually started
  const effectiveIsOverdue = isOverdue && isActive;
  const activityLabel = ACTIVITY_LABELS[tour.activity] ?? tour.activity;
  const heroColor = effectiveIsOverdue ? '#7f1d1d' : (ACTIVITY_COLORS[tour.activity] ?? '#1a2e1a');
  const qrUrl = tour.vehicle ? `https://trailtag-production.up.railway.app/r/${tour.vehicle.qrToken}` : null;
  const locationCount = tour.locations?.length ?? 0;
  const minutesSinceUpdate = tour.locationUpdatedAt ? Math.floor((Date.now() - new Date(tour.locationUpdatedAt).getTime()) / 60000) : null;
  const weatherInfo = weather ? (WMO_CODES[weather.code] ?? { text: 'Unbekannt' }) : null;

  return (
    <ScrollView ref={scrollViewRef} style={styles.container} contentContainerStyle={styles.content}>

      {/* ═══ HERO ═══ */}
      <View style={[styles.hero, { backgroundColor: isActive && effectiveIsOverdue ? '#7f1d1d' : (ACTIVITY_COLORS[tour?.activity] ?? '#1a2e1a'), paddingTop: insets.top + 16 }]}>

        {/* SVG Bergpanorama */}
        {Platform.OS === 'web' && (
          <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice"
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.12 } as any}>
            <polygon points="0,180 50,90 100,130 160,50 220,100 280,40 340,85 400,55 400,260 0,260" fill="white"/>
            <polygon points="0,220 70,140 130,170 190,100 250,150 310,80 370,120 400,100 400,260 0,260" fill="white" opacity="0.6"/>
            <polygon points="160,50 175,68 182,60 188,68 202,52 194,72 174,72" fill="white"/>
            <polygon points="280,40 292,57 298,50 304,57 316,42 308,62 288,62" fill="white"/>
          </svg>
        )}

{Platform.OS === 'web' && (
  <div style={{
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
    background: `linear-gradient(to bottom, transparent 0%, transparent 30%, rgba(248,249,250,0.2) 55%, rgba(248,249,250,0.6) 75%, rgba(248,249,250,0.9) 90%, #f8f9fa 100%)`,
  } as any} />
)}

        {/* Top Bar */}
        <View style={styles.heroTopBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => {
            if (Platform.OS === 'web') { window.history.back(); } else { router.back(); }
          }}>
            <ArrowLeft size={18} color="rgba(255,255,255,0.8)" strokeWidth={2} />
            <Text style={styles.backText}>Zurück</Text>
          </TouchableOpacity>
          <View style={[styles.statusPill, effectiveIsOverdue ? styles.statusPillRed : isActive ? styles.statusPillGreen : styles.statusPillGray]}>
            <View style={[styles.statusDot, effectiveIsOverdue ? styles.dotRed : isActive ? styles.dotGreen : styles.dotGray]} />
            <Text style={styles.statusPillText}>{effectiveIsOverdue ? 'ALARM' : isActive ? 'AKTIV' : isPlanned ? 'GEPLANT' : 'ABGESCHLOSSEN'}</Text>
          </View>
        </View>

        {/* Widgets Row — Countdown + Wetter */}
        <View style={styles.heroWidgets}>
          {isActive && (
            <View style={styles.countdownWidget}>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: effectiveIsOverdue ? '#f87171' : '#4ade80' }]} />
              </View>
              <View style={styles.cwRow}>
                <Timer size={11} color="#434841" strokeWidth={2} />
                <Text style={styles.cwLabel}>{effectiveIsOverdue ? 'ÜBERFÄLLIG' : isPlanned ? 'GEPLANTE RÜCKKEHR' : 'NEXT CHECK-IN'}</Text>
                {batteryLevel !== null && (
                  <Text style={{ fontSize: 10, color: batteryLevel < 20 ? '#dc2626' : 'rgba(6,25,7,0.5)', fontWeight: '700', marginTop: 2 }}>
                    {batteryLevel < 20 ? '🪫' : batteryLevel < 50 ? '🔋' : '🔋'} {batteryLevel}% Akku
                  </Text>
                )}
              </View>
              <Text style={[styles.cwTime, isOverdue && { color: '#ba1a1a' }]}>{timeLeft}</Text>
              {isOverdue && (
                <View style={styles.cwAlert}>
                  <AlertTriangle size={10} color="#ba1a1a" />
                  <Text style={styles.cwAlertText}>Alarm ausgelöst</Text>
                </View>
              )}
            </View>
          )}
          {weather && weatherInfo && (
            <View style={styles.weatherWidget}>
              <View style={styles.wwRow}>
                <Text style={styles.wwLabel}>PROGNOSE</Text>
                {isActive && minutesSinceUpdate !== null && minutesSinceUpdate < 30 && (
                  <View style={styles.livePill}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                )}
              </View>
              <Text style={styles.wwTemp}>{weather.temp}°C</Text>
              <Text style={styles.wwDesc}>{weatherInfo.text}</Text>
              <Text style={styles.wwWind}>{weather.wind} km/h Wind</Text>
              {weather.warnings?.length > 0 && (
                <View style={styles.cwAlert}>
                  <AlertTriangle size={10} color="#f87171" />
                  <Text style={[styles.cwAlertText, { color: '#f87171' }]}>Warnung aktiv</Text>
                </View>
              )}
            </View>
          )}
        </View>

       {/* Titel gross, Aktivität klein */}
        <Text style={styles.heroTitle}>{tour.routeName ?? activityLabel}</Text>
        {tour.routeName && <Text style={styles.heroSubtitle}>{activityLabel.toUpperCase()}</Text>}

      </View>
      {/* ═══ END HERO ═══ */}

      {/* Stats Block — überlappt Hero */}
      <View style={{ paddingHorizontal: 20, marginTop: -20 }}>
        <View style={styles.statsGrid}>
          {tour.distanceKm && (
            <View style={styles.statCell}>
              <Text style={styles.statCellKey}>DISTANZ</Text>
              <Text style={styles.statCellVal}>{tour.distanceKm} <Text style={styles.statCellUnit}>km</Text></Text>
            </View>
          )}
          {tour.elevationUp && (
            <View style={styles.statCell}>
              <Text style={styles.statCellKey}>HÖHENMETER</Text>
              <Text style={styles.statCellVal}>+{tour.elevationUp} <Text style={styles.statCellUnit}>m</Text></Text>
            </View>
          )}
          {tour.difficulty && (
            <View style={styles.statCell}>
              <Text style={styles.statCellKey}>SCHWIERIGKEIT</Text>
              <Text style={styles.statCellVal}>{tour.difficulty} <Text style={styles.statCellUnit}>SAC</Text></Text>
            </View>
          )}
          {tour.locations?.length > 0 && tour.locations[tour.locations.length - 1]?.ele ? (
            <View style={styles.statCell}>
              <Text style={styles.statCellKey}>AKTUELLE HÖHE</Text>
              <Text style={styles.statCellVal}>{Math.round(tour.locations[tour.locations.length - 1].ele)} <Text style={styles.statCellUnit}>m</Text></Text>
            </View>
          ) : tour.elevationUp ? (
            <View style={styles.statCell}>
              <Text style={styles.statCellKey}>HÖHENMETER</Text>
              <Text style={styles.statCellVal}>+{tour.elevationUp} <Text style={styles.statCellUnit}>m</Text></Text>
            </View>
          ) : tour.startedAt ? (
            <View style={styles.statCell}>
              <Text style={styles.statCellKey}>GESTARTET</Text>
              <Text style={styles.statCellVal}>{new Date(tour.startedAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })} <Text style={styles.statCellUnit}>Uhr</Text></Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Safety Controls */}
      {(isActive || isPlanned || qrUrl) && (
        <View style={styles.safetyCard}>
          <Text style={styles.safetyLabel}>SAFETY CONTROLS</Text>
          {isPlanned && (
            <TouchableOpacity style={styles.checkoutBtn} onPress={async () => {
              try {
                const token = await getToken();
                await apiFetch(`/tours/${tour.id}/start`, { method: 'POST', body: JSON.stringify({ eta: tour.eta }) }, token ?? undefined);
                setTour((t: any) => ({ ...t, status: 'ACTIVE', startedAt: new Date().toISOString() }));
                await startLocationTracking(tour.id);
              } catch (err: any) { showAlert('Tour starten', err.message ?? 'Fehler'); }
            }}>
              <CheckCircle size={18} color="#fff" strokeWidth={2.5} />
              <Text style={styles.checkoutText}>Tour jetzt starten</Text>
            </TouchableOpacity>
          )}
          {isActive && (
            <TouchableOpacity style={[styles.checkoutBtn, effectiveIsOverdue && styles.checkoutBtnRed]} onPress={handleCheckout}>
              <CheckCircle size={18} color="#fff" strokeWidth={2.5} />
              <Text style={styles.checkoutText}>Ich bin sicher zurück</Text>
            </TouchableOpacity>
          )}
          {qrUrl && (
            <View style={{gap:8}}>
              <TouchableOpacity style={styles.portalBtn} onPress={() => Platform.OS === 'web' ? window.open(qrUrl!, '_blank') : Linking.openURL(qrUrl!)}>
                <Link size={14} color="#dc2626" strokeWidth={2} />
                <Text style={styles.portalBtnText}>Erstretter-Portal öffnen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.portalBtn,{borderColor:'#aeeecb',backgroundColor:'#f0faf4'}]} onPress={sharePortalLink}>
                <MessageCircle size={14} color="#2c694e" strokeWidth={2} />
                <Text style={[styles.portalBtnText,{color:'#2c694e'}]}>Safety-Link per iMessage teilen</Text>
              </TouchableOpacity>
            </View>
          )}
          {isActive && (<>
            <View style={{flexDirection:'row',gap:8,marginTop:8}}>
              {[30,60,120].map(m=>(
                <TouchableOpacity key={m} style={styles.extendBtn} disabled={extendLoading}
                  onPress={async()=>{setExtendLoading(true);try{const t=await getToken();const r=await apiFetch('/tours/'+tour.id+'/extend',{method:'POST',body:JSON.stringify({minutes:m})},t??undefined);setTour((x:any)=>({...x,eta:r.tour.eta,status:'ACTIVE'}));}catch(e:any){showAlert('Fehler',e.message);}finally{setExtendLoading(false);}}}>
                  <Text style={styles.extendBtnTxt}>+{m>=60?m/60+'h':m+'min'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.safetyNote}>„Sicher zurück“ informiert deine Notfallkontakte und stoppt den Alarm-Timer.</Text>
          </>)}
        </View>
      )}

      {/* Wetter Warnungen */}
      {weather?.warnings?.length > 0 && (
        <View style={styles.section}>
          <View style={styles.warningCard}>
            <View style={styles.warningRow}>
              <AlertTriangle size={14} color="#92400e" strokeWidth={2} />
              <Text style={styles.warningTitle}>Wetterwarnungen (nächste 6h)</Text>
            </View>
            {weather.warnings.map((w: string, i: number) => (
              <Text key={i} style={styles.warningItem}>— {w}</Text>
            ))}
          </View>
        </View>
      )}

      {/* Karte */}
      {(tour.startLat || tour.lastLat || tour.gpxTrack?.points?.length > 0) && (
        <View style={styles.section} ref={mapSectionRef}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Route & Standort</Text>
            <Text style={[styles.metaText, minutesSinceUpdate !== null && minutesSinceUpdate > 30 ? { color: '#ba1a1a' } : {}]}>
              {locationCount > 0 ? `${locationCount} GPS-Punkte` : 'Startpunkt'}
              {minutesSinceUpdate !== null ? ` · vor ${minutesSinceUpdate} Min.` : ''}
            </Text>
          </View>
          <View style={styles.mapContainer}>
            {Platform.OS === 'web' ? (
              <div id="tour-map" style={{ width: '100%', height: 340 } as any} />
            ) : (() => {
              const lat = tour.lastLat ?? tour.startLat ?? tour.gpxTrack?.points?.[0]?.lat;
              const lng = tour.lastLng ?? tour.startLng ?? tour.gpxTrack?.points?.[0]?.lng;
              if (!lat || !lng) return <View style={{height:300,backgroundColor:'#f3f4f5',alignItems:'center',justifyContent:'center'}}><Text style={{color:'#747871',fontSize:13}}>Kein Standort</Text></View>;
              try {
                const M = require('react-native-maps');
                const NM = M.default; const NP = M.Polyline; const NK = M.Marker;
                const gc = tour.gpxTrack?.points?.map((p:any)=>({latitude:p.lat,longitude:p.lng}))??[];
                const tc = tour.locations?.map((l:any)=>({latitude:l.lat,longitude:l.lng}))??[];
                const wc = tour.gpxTrack?.waypoints?.filter((w:any)=>w.lat&&w.lng)??[];
                return (<NM style={{width:'100%',height:300}} initialRegion={{latitude:lat,longitude:lng,latitudeDelta:0.05,longitudeDelta:0.05}} mapType="terrain">
                  {gc.length>1&&<NP coordinates={gc} strokeColor="#2c694e" strokeWidth={3}/>}
                  {tc.length>1&&<NP coordinates={tc} strokeColor="#f59e0b" strokeWidth={2} lineDashPattern={[5,5]}/>}
                  {tour.startLat&&<NK coordinate={{latitude:tour.startLat,longitude:tour.startLng}} pinColor="#2c694e" title="Start"/>}
                  <NK coordinate={{latitude:lat,longitude:lng}} pinColor="#dc2626" title="Letzter Standort"/>
                  {wc.map((w:any,i:number)=><NK key={i} coordinate={{latitude:w.lat,longitude:w.lng}} pinColor="#f59e0b" title={w.name??'Wegpunkt'}/>)}
                </NM>);
              } catch { return <View style={{height:300,backgroundColor:'#f3f4f5',alignItems:'center',justifyContent:'center'}}><Text style={{color:'#747871',fontSize:13}}>Karte nicht verfügbar</Text></View>; }
            })()}
          </View>
          {tour.gpxTrack?.points?.length > 0 && (
            <ElevationChart points={tour.gpxTrack.points} />
          )}
        </View>
      )}

      {/* Wetter Details */}
      {weather && weatherInfo && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Wetter am Standort</Text>
          <View style={styles.card}>
            <View style={styles.weatherRow}>
              <View>
                <Text style={styles.weatherTemp}>{weather.temp}°C</Text>
                <Text style={styles.weatherDesc}>{weatherInfo.text}</Text>
              </View>
              <View style={styles.weatherCols}>
                <View style={styles.weatherCol}><Wind size={12} color="#747871" /><Text style={styles.weatherColText}>{weather.wind} km/h</Text></View>
                <View style={styles.weatherCol}><Thermometer size={12} color="#747871" /><Text style={styles.weatherColText}>{weather.feelsLike}°C gefühlt</Text></View>
                <View style={styles.weatherCol}><Activity size={12} color="#747871" /><Text style={styles.weatherColText}>{weather.humidity}%</Text></View>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Live Tracking Log */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Live Tracking Log</Text>
          {isActive && (
  <TouchableOpacity
    style={styles.syncBadge}
    onPress={async () => {
      try {
        if (Platform.OS === 'web') {
          if (!navigator.geolocation) return;
          navigator.geolocation.getCurrentPosition(async (pos) => {
            const token = await getToken();
            await apiFetch(`/tours/${tour.id}/location`, {
              method: 'POST',
              body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, ele: pos.coords.altitude }),
            }, token ?? undefined);
            loadTour();
          }, undefined, { enableHighAccuracy: true });
        } else {
          // iOS/Android — get current position and send
          const Location = require('expo-location');
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') { showAlert('Fehler', 'Standortberechtigung fehlt'); return; }
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const token = await getToken();
          await apiFetch(`/tours/${tour.id}/location`, {
            method: 'POST',
            body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, ele: pos.coords.altitude }),
          }, token ?? undefined);
          loadTour();
        }
      } catch (err: any) { showAlert('Fehler', err.message ?? 'Sync fehlgeschlagen'); }
    }}
  >
    <RefreshCw size={11} color="#2c694e" strokeWidth={2} />
    <Text style={styles.syncText}>SYNC</Text>
  </TouchableOpacity>
)}
        </View>
        <View style={styles.timeline}>
          {tour.startedAt && (
            <TouchableOpacity style={styles.tlEntry} onPress={() => tour.startLat && handleLocationSelect({ lat: tour.startLat, lng: tour.startLng, time: new Date(tour.startedAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }) })}>
              <View style={styles.tlLeft}><View style={[styles.tlDot, { backgroundColor: '#2c694e' }]} /><View style={styles.tlLine} /></View>
              <View style={styles.tlCard}>
                <View style={styles.tlTop}><Text style={styles.tlTitle}>START</Text><Text style={styles.tlTime}>{new Date(tour.startedAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</Text></View>
                {tour.parkingLocation && <Text style={styles.tlDesc}>{tour.parkingLocation}</Text>}
                {tour.startLat && <Text style={styles.tlLink}>↗ Auf Karte zeigen</Text>}
              </View>
            </TouchableOpacity>
          )}

          {(() => {
            // Newest first — reverse so latest GPS points show at top
            const locs = [...(tour.locations ?? [])].reverse();
            const shown = showAllLogs ? locs : locs.slice(0, 3);
            return (<>
              {shown.map((loc: any, idx: number) => (
                <TouchableOpacity key={loc.id ?? idx} style={styles.tlEntry}
                  onPress={() => handleLocationSelect({ lat: loc.lat, lng: loc.lng, time: new Date(loc.timestamp).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }) })}>
                  <View style={styles.tlLeft}>
                    <View style={[styles.tlDot, styles.tlDotMid, { backgroundColor: '#f59e0b' }]} />
                    <View style={[styles.tlLine, { backgroundColor: '#f3f4f5' }]} />
                  </View>
                  <View style={[styles.tlCard, styles.tlCardMid]}>
                    <View style={styles.tlTop}>
                      <Text style={[styles.tlTitle, { color: '#747871', fontSize: 10 }]}>GPS PUNKT</Text>
                      <Text style={styles.tlTime}>{new Date(loc.timestamp).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                      {loc.ele ? <Text style={styles.tlDesc}>⛰ {Math.round(loc.ele)} m</Text> : null}
                      <Text style={[styles.tlDesc, { color: '#c3c8bf' }]}>{loc.lat?.toFixed(4)}, {loc.lng?.toFixed(4)}</Text>
                    </View>
                    <Text style={styles.tlLink}>↗ Auf Karte zeigen</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {locs.length > 3 && (
                <TouchableOpacity style={styles.showAllBtn} onPress={() => setShowAllLogs(v => !v)}>
                  <Text style={styles.showAllTxt}>
                    {showAllLogs ? '▲ Weniger anzeigen' : `▼ Alle ${locs.length} GPS-Punkte anzeigen`}
                  </Text>
                </TouchableOpacity>
              )}
            </>);
          })()}

          {tour.locationUpdatedAt && (
            <TouchableOpacity style={styles.tlEntry} onPress={() => tour.lastLat && handleLocationSelect({ lat: tour.lastLat, lng: tour.lastLng, time: new Date(tour.locationUpdatedAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }) })}>
              <View style={styles.tlLeft}><View style={[styles.tlDot, { backgroundColor: '#f59e0b' }]} /><View style={styles.tlLine} /></View>
              <View style={styles.tlCard}>
                <View style={styles.tlTop}><Text style={styles.tlTitle}>LETZTER STANDORT</Text><Text style={styles.tlTime}>{new Date(tour.locationUpdatedAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</Text></View>
                <Text style={styles.tlDesc}>{minutesSinceUpdate !== null ? `vor ${minutesSinceUpdate} Minuten` : ''}{minutesSinceUpdate !== null && minutesSinceUpdate > 30 ? ' — Möglicherweise kein Signal' : ' — Aktuell'}</Text>
                {tour.lastLat && <Text style={styles.tlLink}>↗ Auf Karte zeigen</Text>}
              </View>
            </TouchableOpacity>
          )}

          {tour.eta && (
            <View style={styles.tlEntry}>
              <View style={styles.tlLeft}><View style={[styles.tlDot, { backgroundColor: isOverdue ? '#dc2626' : '#2c694e' }]} /></View>
              <View style={styles.tlCard}>
                <View style={styles.tlTop}>
                  <Text style={[styles.tlTitle, isOverdue && { color: '#dc2626' }]}>GEPLANTE RÜCKKEHR</Text>
                  <Text style={[styles.tlTime, isOverdue && { color: '#dc2626', fontWeight: '800' }]}>{new Date(tour.eta).toLocaleString('de-CH', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</Text>
                </View>
              </View>
            </View>
          )}

          {tour.checkedOutAt && (
            <View style={styles.tlEntry}>
              <View style={styles.tlLeft}><View style={[styles.tlDot, { backgroundColor: '#2c694e' }]} /></View>
              <View style={styles.tlCard}>
                <View style={styles.tlTop}><Text style={styles.tlTitle}>AUSGECHECKT ✓</Text><Text style={styles.tlTime}>{new Date(tour.checkedOutAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</Text></View>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Tour Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tour-Details</Text>
        <View style={styles.card}>
          <View style={styles.detailRow}><Text style={styles.detailKey}>Aktivität</Text><Text style={styles.detailVal}>{activityLabel}</Text></View>
          {tour.persons && <View style={styles.detailRow}><Text style={styles.detailKey}>Personen</Text><Text style={styles.detailVal}>{tour.persons}</Text></View>}
          {tour.parkingLocation && <View style={styles.detailRow}><Text style={styles.detailKey}>Parkplatz</Text><Text style={styles.detailVal}>{tour.parkingLocation}</Text></View>}
          {tour.vehicle && <View style={styles.detailRow}><Text style={styles.detailKey}>Fahrzeug</Text><Text style={styles.detailVal}>{tour.vehicle.plate} · {tour.vehicle.make} {tour.vehicle.model}</Text></View>}
          {tour.startedAt && <View style={styles.detailRow}><Text style={styles.detailKey}>Gestartet</Text><Text style={styles.detailVal}>{new Date(tour.startedAt).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</Text></View>}
          {tour.eta && <View style={styles.detailRow}><Text style={styles.detailKey}>Geplante Rückkehr</Text><Text style={[styles.detailVal, isOverdue && { color: '#dc2626' }]}>{new Date(tour.eta).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</Text></View>}
          {tour.notes && (
            <View style={[styles.detailRow, { flexDirection: 'column', gap: 4 }]}>
              <Text style={styles.detailKey}>Notizen für Rettungskräfte</Text>
              <Text style={[styles.detailVal, { textAlign: 'center', color: '#747871', fontStyle: 'italic' }]}>{tour.notes}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Übernachtungen */}
      {tour.overnightStops?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Übernachtungen</Text>
          {tour.overnightStops.map((stop: any, i: number) => (
            <View key={i} style={[styles.card, { marginBottom: 10 }]}>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f5' }}>
                <Moon size={16} color="#2c694e" strokeWidth={2} />
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#061907' }}>Nacht {stop.night}</Text>
                {stop.type ? (
                  <View style={{ backgroundColor: '#f0faf4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, marginLeft: 'auto' }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#2c694e' }}>
                      {stop.type === 'huette' ? 'SAC Hütte' : stop.type === 'zelt' ? 'Zelt/Biwak' : stop.type === 'camping' ? 'Camping' : stop.type === 'hotel' ? 'Hotel/B&B' : stop.type === 'schutz' ? 'Schutzhütte' : stop.type === 'privat' ? 'Privat' : stop.type}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={{ padding: 14 }}>
                {stop.name ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Unterkunft</Text>
                    <Text style={[styles.detailVal, { fontWeight: '800' }]}>{stop.name}</Text>
                  </View>
                ) : null}
                {stop.address ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Adresse</Text>
                    <Text style={styles.detailVal}>{stop.address}</Text>
                  </View>
                ) : null}
                {stop.reserved ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Reservierung</Text>
                    <Text style={[styles.detailVal, { color: '#2c694e' }]}>✓ Bestätigt</Text>
                  </View>
                ) : null}
                {stop.contactName ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Kontakt</Text>
                    <Text style={styles.detailVal}>{stop.contactName}</Text>
                  </View>
                ) : null}
                {stop.contactPhone ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Telefon</Text>
                    <TouchableOpacity onPress={() => Linking.openURL(`tel:${stop.contactPhone}`)}>
                      <Text style={[styles.detailVal, { color: '#2c694e' }]}>{stop.contactPhone}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {stop.notes ? (
                  <View style={[styles.detailRow, { flexDirection: 'column', gap: 4 }]}>
                    <Text style={styles.detailKey}>Notizen</Text>
                    <Text style={[styles.detailVal, { textAlign: 'left' }]}>{stop.notes}</Text>
                  </View>
                ) : null}

                {/* Map Links */}
                {(stop.lat && stop.lng) ? (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity style={styles.overnightMapBtn}
                      onPress={() => {
                        const url = `https://maps.google.com/?q=${stop.lat},${stop.lng}`;
                        if (Platform.OS === 'web') { (window as any).open(url, '_blank'); }
                        else { Linking.openURL(url); }
                      }}>
                      <MapPinIcon size={13} color="#2c694e" strokeWidth={2} />
                      <Text style={styles.overnightMapBtnTxt}>In Maps öffnen</Text>
                    </TouchableOpacity>
                    {stop.contactPhone ? (
                      <TouchableOpacity style={[styles.overnightMapBtn, { borderColor: '#aeeecb' }]}
                        onPress={() => Linking.openURL(`tel:${stop.contactPhone}`)}>
                        <Phone size={13} color="#2c694e" strokeWidth={2} />
                        <Text style={styles.overnightMapBtnTxt}>Anrufen</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa', gap: 12 },
  loadingText: { fontSize: 14, color: '#747871' },
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { paddingBottom: 120 },

  // Hero
  hero: { paddingTop: 28, paddingBottom: 30, paddingHorizontal: 20, overflow: 'hidden', position: 'relative' as any },
  heroTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100 },
  statusPillGreen: { backgroundColor: 'rgba(74,222,128,0.15)' },
  statusPillRed: { backgroundColor: 'rgba(248,113,113,0.15)' },
  statusPillGray: { backgroundColor: 'rgba(255,255,255,0.1)' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  dotGreen: { backgroundColor: '#4ade80' },
  dotRed: { backgroundColor: '#f87171' },
  dotGray: { backgroundColor: '#94a3b8' },
  statusPillText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.8 },

  // Widgets
  heroWidgets: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  countdownWidget: { flex: 1.5, backgroundColor: 'rgba(255,255,255,0.93)', borderRadius: 6, padding: 12, overflow: 'hidden' as any },
  progressBg: { position: 'absolute' as any, top: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(0,0,0,0.08)' },
  progressFill: { height: 3 },
  cwRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2, marginTop: 4 },
  cwLabel: { fontSize: 9, fontWeight: '700', color: '#434841', letterSpacing: 0.8 },
  cwTime: { fontSize: 22, fontWeight: '900', color: '#061907', letterSpacing: -0.5, marginBottom: 2 },
  cwAlert: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  cwAlertText: { fontSize: 10, fontWeight: '700', color: '#ba1a1a' },
  weatherWidget: { flex: 1, backgroundColor: 'rgba(255,255,255,0.93)', borderRadius: 6, padding: 12 },
  wwRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  wwLabel: { fontSize: 9, fontWeight: '700', color: '#434841', letterSpacing: 0.8 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(44,105,78,0.15)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 100 },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#2c694e' },
  liveText: { fontSize: 8, fontWeight: '800', color: '#2c694e', letterSpacing: 0.5 },
  wwTemp: { fontSize: 22, fontWeight: '900', color: '#061907', letterSpacing: -0.5, marginBottom: 1 },
  wwDesc: { fontSize: 10, color: '#747871' },
  wwWind: { fontSize: 10, color: '#747871', marginTop: 1 },

  // Titel
  heroTitle: { fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: -0.8, marginBottom: 4 },
  heroSubtitle: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5, marginBottom: 16 },

  // Stats Grid überlappend
  statsOverlap: { marginHorizontal: 0, marginTop: 20, paddingHorizontal: 20 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e1e3e4', borderRadius: 4, overflow: 'hidden' },
  statCell: { width: '50%', padding: 14, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#e1e3e4' },
  statCellKey: { fontSize: 9, fontWeight: '700', color: '#747871', letterSpacing: 1, marginBottom: 4 },
  statCellVal: { fontSize: 20, fontWeight: '800', color: '#061907' },
  statCellUnit: { fontSize: 11, fontWeight: '400', color: '#747871' },

  // Safety
  safetyCard: { marginHorizontal: 20, marginTop: 16, backgroundColor: '#edeeef', borderRadius: 6, padding: 16, borderWidth: 1, borderColor: '#e1e3e4' },
  safetyLabel: { fontSize: 10, fontWeight: '700', color: '#747871', letterSpacing: 1, marginBottom: 12 },
  checkoutBtn: { backgroundColor: '#061907', borderRadius: 4, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 },
  checkoutBtnRed: { backgroundColor: '#dc2626' },
  extendBtn: { flex:1,borderRadius:6,borderWidth:1.5,borderColor:'#e1e3e4',paddingVertical:10,alignItems:'center',backgroundColor:'#f8f9fa' },
  extendBtnTxt: { fontSize:13,fontWeight:'700',color:'#434841' },
  showAllBtn: { marginTop:6,paddingVertical:10,alignItems:'center',borderRadius:6,backgroundColor:'#f3f4f5',marginLeft:24 },
  showAllTxt: { fontSize:12,fontWeight:'700',color:'#2c694e' },
  detailSub: { fontSize:11,color:'#747871',marginTop:1 },
  overnightMapBtn: { flexDirection:'row',alignItems:'center',gap:5,flex:1,backgroundColor:'#f0faf4',borderRadius:6,paddingVertical:9,paddingHorizontal:12,borderWidth:1,borderColor:'#e1e3e4',justifyContent:'center' },
  overnightMapBtnTxt: { fontSize:12,fontWeight:'700',color:'#2c694e' },
  sectionLabel: { fontSize:10,fontWeight:'700',color:'#747871',letterSpacing:1,marginBottom:10 },
  checkoutText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  portalBtn: { backgroundColor: '#fff', borderRadius: 4, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#fca5a5', marginBottom: 8 },
  portalBtnText: { color: '#dc2626', fontWeight: '700', fontSize: 13 },
  safetyNote: { fontSize: 11, color: '#747871', textAlign: 'center', lineHeight: 15 },

  // Sections
  section: { paddingHorizontal: 20, paddingTop: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#061907', letterSpacing: -0.3, marginBottom: 10 },
  metaText: { fontSize: 11, fontWeight: '600', color: '#2c694e' },
  syncBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  syncText: { fontSize: 11, fontWeight: '700', color: '#2c694e' },

  // Warning
  warningCard: { backgroundColor: '#fff8e1', borderRadius: 4, padding: 14, borderLeftWidth: 3, borderLeftColor: '#f59e0b' },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  warningTitle: { fontSize: 13, fontWeight: '700', color: '#92400e', flex: 1 },
  warningItem: { fontSize: 12, color: '#92400e', marginBottom: 4, lineHeight: 17 },

  // Map
  mapContainer: { backgroundColor: '#e1e3e4', borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: '#e1e3e4' },

  // Card
  card: { backgroundColor: '#fff', borderRadius: 4, padding: 16, borderWidth: 1, borderColor: '#e1e3e4' },
  weatherRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weatherTemp: { fontSize: 34, fontWeight: '900', color: '#061907', letterSpacing: -1 },
  weatherDesc: { fontSize: 13, color: '#747871', marginTop: 2 },
  weatherCols: { gap: 6, alignItems: 'flex-end' },
  weatherCol: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  weatherColText: { fontSize: 12, color: '#747871' },

  // Timeline
  timeline: { gap: 0 },
  tlEntry: { flexDirection: 'row', minHeight: 56 },
  tlLeft: { width: 26, alignItems: 'center', paddingTop: 2 },
  tlDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#f8f9fa', zIndex: 1 },
  tlLine: { flex: 1, width: 2, backgroundColor: '#e1e3e4', marginTop: 2 },
  tlCard: { flex: 1, backgroundColor: '#fff', borderRadius: 4, padding: 12, borderWidth: 1, borderColor: '#e1e3e4', marginLeft: 8, marginBottom: 8 },
  tlTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  tlTitle: { fontSize: 11, fontWeight: '700', color: '#061907', letterSpacing: 0.5 },
  tlTime: { fontSize: 11, color: '#747871' },
  tlDesc: { fontSize: 12, color: '#747871', lineHeight: 16 },
  tlLink: { fontSize: 12, color: '#2c694e', fontWeight: '700', marginTop: 4 },

  // Details
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f5' },
  detailKey: { fontSize: 13, color: '#747871' },
  detailVal: { fontSize: 13, fontWeight: '600', color: '#191c1d', flex: 1, textAlign: 'right' },

});
