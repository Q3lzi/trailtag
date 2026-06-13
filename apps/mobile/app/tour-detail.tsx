import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, Linking } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { apiFetch } from '../lib/api';
import { getToken } from '../lib/storage';
import { showAlert, showConfirm } from '../lib/alert';
import { cancelAllNotifications } from '../lib/notifications';
import { stopLocationTracking } from '../lib/tracking';
import { ArrowLeft, Timer, Wind, Thermometer, RefreshCw, CheckCircle, AlertTriangle, Link, MapPin, Navigation, Activity, Mountain, Clock, Users, Car } from 'lucide-react-native';

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
    const startTime = Date.now();
    const endTime = new Date(eta).getTime();
    const totalDuration = endTime - startTime;
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
      if (code >= 95) warnings.push(`Gewitter um ${h}:00 Uhr`);
      else if (code >= 80) warnings.push(`Starke Schauer um ${h}:00 Uhr`);
      if (snow > 0.5) warnings.push(`Schneefall um ${h}:00 Uhr (${snow.toFixed(1)} cm)`);
      if (wind > 60) warnings.push(`Starker Wind um ${h}:00 Uhr (${wind} km/h)`);
      if (temp < 0) warnings.push(`Frost um ${h}:00 Uhr (${temp}°C)`);
      if (precip > 70 && code >= 61) warnings.push(`Hohe Regenwahrscheinlichkeit um ${h}:00 Uhr`);
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

export default function TourDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tour, setTour] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState<any>(null);
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number, time: string} | null>(null);
  const leafletMapRef = useRef<any>(null);
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
    if (!leafletMapRef.current) return;
    import('leaflet').then((L) => {
      leafletMapRef.current.setView([selectedLocation.lat, selectedLocation.lng], 15, { animate: true });
      L.default.circleMarker([selectedLocation.lat, selectedLocation.lng] as [number, number], {
        radius: 12, fillColor: '#f59e0b', color: '#fff', weight: 3, fillOpacity: 0.9
      }).bindPopup(selectedLocation.time).addTo(leafletMapRef.current).openPopup();
    });
  }, [selectedLocation]);

  useEffect(() => {
    if (!tour || Platform.OS !== 'web') return;
    const lat = tour.lastLat ?? tour.startLat;
    const lng = tour.lastLng ?? tour.startLng;
    if (!lat || !lng) return;
    const timer = setTimeout(() => {
      const container = document.getElementById('tour-map');
      if (!container) return;
      const points = tour.gpxTrack?.points?.length > 0
        ? tour.gpxTrack.points.map((p: any) => [p.lat, p.lng])
        : tour.locations?.length > 0 ? tour.locations.map((l: any) => [l.lat, l.lng]) : [[lat, lng]];
      const trackingPoints = tour.locations?.length > 0 ? tour.locations.map((l: any) => [l.lat, l.lng]) : null;
      if (!document.getElementById('leaflet-css-detail')) {
        const link = document.createElement('link'); link.id = 'leaflet-css-detail'; link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link);
      }
      import('leaflet').then((L) => {
        if ((container as any)._leaflet_id) { container.innerHTML = ''; delete (container as any)._leaflet_id; }
        const map = L.default.map(container);
        leafletMapRef.current = map;
        L.default.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution: '© OpenStreetMap © CARTO' }).addTo(map);
        if (points.length > 1) {
          const poly = L.default.polyline(points as [number, number][], { color: '#4ade80', weight: 4, opacity: 0.9 }).addTo(map);
          L.default.circleMarker(points[0] as [number, number], { radius: 8, fillColor: '#4ade80', color: '#fff', weight: 2, fillOpacity: 1 }).bindPopup('Start').addTo(map);
          map.fitBounds(poly.getBounds(), { padding: [24, 24] });
        } else { map.setView([lat, lng], 13); }
        if (trackingPoints && trackingPoints.length > 1 && tour.gpxTrack?.points?.length > 0) {
          L.default.polyline(trackingPoints as [number, number][], { color: '#f59e0b', weight: 3, opacity: 0.8, dashArray: '5,5' }).addTo(map);
        }
        L.default.circleMarker([lat, lng] as [number, number], { radius: 10, fillColor: '#dc2626', color: '#fff', weight: 3, fillOpacity: 1 }).bindPopup('Letzter Standort').addTo(map).openPopup();
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [tour?.locations?.length, tour?.lastLat, tour?.lastLng, tour?.gpxTrack]);

  async function loadTour() {
    try { const token = await getToken(); const data = await apiFetch(`/tours/${id}`, {}, token ?? undefined); setTour(data); }
    catch { } finally { setLoading(false); }
  }

  async function handleCheckout() {
    const confirmed = await showConfirm('Bist du sicher zurück?');
    if (!confirmed) return;
    try {
      const token = await getToken();
      await apiFetch(`/tours/${tour.id}/checkout`, { method: 'POST' }, token ?? undefined);
      await stopLocationTracking(); await cancelAllNotifications();
      router.replace('/dashboard');
    } catch (err: any) { showAlert('Fehler', err.message); }
  }

  if (loading) return (
    <View style={styles.loading}>
      <Mountain size={36} color="#2c694e" />
      <Text style={styles.loadingText}>Lädt...</Text>
    </View>
  );
  if (!tour) return <View style={styles.loading}><Text style={styles.loadingText}>Tour nicht gefunden</Text></View>;

  const isActive = tour.status === 'ACTIVE' || tour.status === 'ALARM';
  const activityLabel = ACTIVITY_LABELS[tour.activity] ?? tour.activity;
  const heroColor = isOverdue ? '#7f1d1d' : (ACTIVITY_COLORS[tour.activity] ?? '#1a2e1a');
  const qrUrl = tour.vehicle ? `https://trailtag-production.up.railway.app/r/${tour.vehicle.qrToken}` : null;
  const locationCount = tour.locations?.length ?? 0;
  const minutesSinceUpdate = tour.locationUpdatedAt ? Math.floor((Date.now() - new Date(tour.locationUpdatedAt).getTime()) / 60000) : null;
  const weatherInfo = weather ? (WMO_CODES[weather.code] ?? { text: 'Unbekannt' }) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Hero Header */}
      <View style={[styles.hero, { backgroundColor: heroColor }]}>
        {/* Top Bar */}
        <View style={styles.heroTopBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={18} color="rgba(255,255,255,0.8)" strokeWidth={2} />
            <Text style={styles.backText}>Zurück</Text>
          </TouchableOpacity>
          <View style={[styles.statusPill, isOverdue ? styles.statusPillRed : isActive ? styles.statusPillGreen : styles.statusPillGray]}>
            <View style={[styles.statusDot, isOverdue ? styles.dotRed : isActive ? styles.dotGreen : styles.dotGray]} />
            <Text style={styles.statusPillText}>{isOverdue ? 'ALARM' : isActive ? 'AKTIV' : 'ABGESCHLOSSEN'}</Text>
          </View>
        </View>

        {/* Activity + Route */}
        <Text style={styles.heroActivity}>{activityLabel}</Text>
        {tour.routeName && <Text style={styles.heroRoute}>{tour.routeName}</Text>}

        {/* Stats Pills */}
        <View style={styles.heroPills}>
          {tour.distanceKm && <View style={styles.heroPill}><Navigation size={11} color="rgba(255,255,255,0.7)" /><Text style={styles.heroPillText}>{tour.distanceKm} km</Text></View>}
          {tour.elevationUp && <View style={styles.heroPill}><Activity size={11} color="rgba(255,255,255,0.7)" /><Text style={styles.heroPillText}>{tour.elevationUp} hm</Text></View>}
          {tour.difficulty && <View style={styles.heroPill}><Mountain size={11} color="rgba(255,255,255,0.7)" /><Text style={styles.heroPillText}>{tour.difficulty} SAC</Text></View>}
          {tour.persons > 1 && <View style={styles.heroPill}><Users size={11} color="rgba(255,255,255,0.7)" /><Text style={styles.heroPillText}>{tour.persons} Personen</Text></View>}
        </View>

        {/* Countdown */}
        {isActive && (
          <View style={styles.heroCountdown}>
            {/* Progress Bar */}
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: isOverdue ? '#f87171' : '#4ade80' }]} />
            </View>
            <Text style={styles.heroCountdownLabel}>{isOverdue ? 'ÜBERFÄLLIG SEIT' : 'VERBLEIBENDE ZEIT'}</Text>
            <Text style={[styles.heroCountdownTime, isOverdue && { color: '#f87171' }]}>{timeLeft}</Text>
            <Text style={styles.heroCountdownSub}>
              Rückkehr: {new Date(tour.eta).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        )}

        {/* Weather in Hero */}
        {weather && weatherInfo && (
          <View style={styles.heroWeather}>
            <Text style={styles.heroWeatherTemp}>{weather.temp}°C</Text>
            <Text style={styles.heroWeatherDesc}>{weatherInfo.text} · {weather.wind} km/h Wind</Text>
          </View>
        )}
      </View>

      {/* Safety Controls */}
      {(isActive || qrUrl) && (
        <View style={styles.safetySection}>
          {isActive && (
            <TouchableOpacity style={[styles.checkoutBtn, isOverdue && styles.checkoutBtnRed]} onPress={handleCheckout}>
              <CheckCircle size={18} color="#fff" strokeWidth={2.5} />
              <Text style={styles.checkoutText}>Ich bin sicher zurück</Text>
            </TouchableOpacity>
          )}
          {qrUrl && (
            <TouchableOpacity style={styles.portalBtn} onPress={() => Platform.OS === 'web' ? window.open(qrUrl!, '_blank') : Linking.openURL(qrUrl!)}>
              <Link size={15} color="#2c694e" strokeWidth={2} />
              <Text style={styles.portalBtnText}>Erstretter-Portal öffnen</Text>
            </TouchableOpacity>
          )}
          {isActive && (
            <Text style={styles.safetyNote}>
              "Sicher zurück" informiert deine Notfallkontakte und stoppt den Alarm-Timer.
            </Text>
          )}
        </View>
      )}

      {/* Wetter Warnungen */}
      {weather?.warnings?.length > 0 && (
        <View style={styles.section}>
          <View style={styles.warningCard}>
            <View style={styles.warningHeader}>
              <AlertTriangle size={15} color="#92400e" strokeWidth={2} />
              <Text style={styles.warningTitle}>Wetterwarnungen für die nächsten 6 Stunden</Text>
            </View>
            {weather.warnings.map((w: string, i: number) => (
              <Text key={i} style={styles.warningItem}>— {w}</Text>
            ))}
          </View>
        </View>
      )}

      {/* Karte */}
      {(tour.startLat || tour.lastLat) && Platform.OS === 'web' && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Route & Standort</Text>
            <View style={styles.syncBadge}>
              {isActive && <RefreshCw size={11} color="#2c694e" strokeWidth={2} />}
              <Text style={[styles.syncText, minutesSinceUpdate !== null && minutesSinceUpdate > 30 ? { color: '#ba1a1a' } : {}]}>
                {locationCount > 0 ? `${locationCount} Punkte` : 'Startpunkt'}{minutesSinceUpdate !== null ? ` · vor ${minutesSinceUpdate} Min.` : ''}
              </Text>
            </View>
          </View>
          <View style={styles.mapContainer}>
            <div id="tour-map" style={{ width: '100%', height: 320 } as any} />
          </View>
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
              <View style={styles.weatherDetails}>
                <View style={styles.weatherDetailRow}><Wind size={13} color="#747871" /><Text style={styles.weatherDetailText}>{weather.wind} km/h</Text></View>
                <View style={styles.weatherDetailRow}><Thermometer size={13} color="#747871" /><Text style={styles.weatherDetailText}>{weather.feelsLike}°C gefühlt</Text></View>
                <View style={styles.weatherDetailRow}><Activity size={13} color="#747871" /><Text style={styles.weatherDetailText}>{weather.humidity}% Luftfeuchte</Text></View>
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
            <View style={styles.syncBadge}>
              <RefreshCw size={11} color="#2c694e" strokeWidth={2} />
              <Text style={styles.syncText}>SYNCING</Text>
            </View>
          )}
        </View>
        <View style={styles.timeline}>
          {tour.startedAt && (
            <TouchableOpacity style={styles.tlEntry} onPress={() => tour.startLat && setSelectedLocation({ lat: tour.startLat, lng: tour.startLng, time: new Date(tour.startedAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }) })}>
              <View style={styles.tlLeft}><View style={[styles.tlDot, { backgroundColor: '#2c694e' }]} /><View style={styles.tlLine} /></View>
              <View style={styles.tlCard}>
                <View style={styles.tlCardTop}><Text style={styles.tlCardTitle}>START</Text><Text style={styles.tlCardTime}>{new Date(tour.startedAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</Text></View>
                {tour.parkingLocation && <Text style={styles.tlCardDesc}>{tour.parkingLocation}</Text>}
                {tour.startLat && <Text style={styles.tlCardLink}>Auf Karte zeigen →</Text>}
              </View>
            </TouchableOpacity>
          )}

          {tour.locations?.filter((_: any, i: number) => i % 10 === 0 && i > 0).map((loc: any, idx: number) => (
            <TouchableOpacity key={loc.id} style={styles.tlEntry} onPress={() => setSelectedLocation({ lat: loc.lat, lng: loc.lng, time: new Date(loc.timestamp).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }) })}>
              <View style={styles.tlLeft}><View style={[styles.tlDot, { backgroundColor: '#c3c8bf', width: 8, height: 8 }]} /><View style={styles.tlLine} /></View>
              <View style={[styles.tlCard, { backgroundColor: 'transparent', borderColor: 'transparent', paddingTop: 0 }]}>
                <View style={styles.tlCardTop}><Text style={[styles.tlCardTitle, { color: '#747871' }]}>TRACKING-PUNKT {idx + 1}</Text><Text style={styles.tlCardTime}>{new Date(loc.timestamp).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</Text></View>
                <Text style={styles.tlCardLink}>Auf Karte zeigen →</Text>
              </View>
            </TouchableOpacity>
          ))}

          {tour.locationUpdatedAt && (
            <TouchableOpacity style={styles.tlEntry} onPress={() => tour.lastLat && setSelectedLocation({ lat: tour.lastLat, lng: tour.lastLng, time: new Date(tour.locationUpdatedAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }) })}>
              <View style={styles.tlLeft}><View style={[styles.tlDot, { backgroundColor: '#f59e0b' }]} /><View style={styles.tlLine} /></View>
              <View style={styles.tlCard}>
                <View style={styles.tlCardTop}><Text style={styles.tlCardTitle}>LETZTER STANDORT</Text><Text style={styles.tlCardTime}>{new Date(tour.locationUpdatedAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</Text></View>
                <Text style={styles.tlCardDesc}>{minutesSinceUpdate !== null ? `vor ${minutesSinceUpdate} Minuten` : ''}{minutesSinceUpdate !== null && minutesSinceUpdate > 30 ? ' — Möglicherweise kein Signal' : ' — Aktuell'}</Text>
                {tour.lastLat && <Text style={styles.tlCardLink}>Auf Karte zeigen →</Text>}
              </View>
            </TouchableOpacity>
          )}

          {tour.eta && (
            <View style={styles.tlEntry}>
              <View style={styles.tlLeft}><View style={[styles.tlDot, { backgroundColor: isOverdue ? '#dc2626' : '#2c694e' }]} /></View>
              <View style={styles.tlCard}>
                <View style={styles.tlCardTop}>
                  <Text style={[styles.tlCardTitle, isOverdue && { color: '#dc2626' }]}>GEPLANTE RÜCKKEHR</Text>
                  <Text style={[styles.tlCardTime, isOverdue && { color: '#dc2626', fontWeight: '800' }]}>{new Date(tour.eta).toLocaleString('de-CH', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</Text>
                </View>
              </View>
            </View>
          )}

          {tour.checkedOutAt && (
            <View style={styles.tlEntry}>
              <View style={styles.tlLeft}><View style={[styles.tlDot, { backgroundColor: '#2c694e' }]} /></View>
              <View style={styles.tlCard}>
                <View style={styles.tlCardTop}><Text style={styles.tlCardTitle}>AUSGECHECKT ✓</Text><Text style={styles.tlCardTime}>{new Date(tour.checkedOutAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</Text></View>
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
          {tour.parkingLocation && <View style={styles.detailRow}><Text style={styles.detailKey}>Parkplatz / Start</Text><Text style={styles.detailVal}>{tour.parkingLocation}</Text></View>}
          {tour.vehicle && <View style={styles.detailRow}><Text style={styles.detailKey}>Fahrzeug</Text><Text style={styles.detailVal}>{tour.vehicle.plate} · {tour.vehicle.make} {tour.vehicle.model}</Text></View>}
          {tour.startedAt && <View style={styles.detailRow}><Text style={styles.detailKey}>Gestartet</Text><Text style={styles.detailVal}>{new Date(tour.startedAt).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</Text></View>}
          {tour.eta && <View style={styles.detailRow}><Text style={styles.detailKey}>Geplante Rückkehr</Text><Text style={[styles.detailVal, isOverdue && { color: '#dc2626' }]}>{new Date(tour.eta).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</Text></View>}
          {tour.notes && (
            <View style={[styles.detailRow, { flexDirection: 'column', gap: 4 }]}>
              <Text style={styles.detailKey}>Notizen für Rettungskräfte</Text>
              <Text style={[styles.detailVal, { textAlign: 'left' }]}>{tour.notes}</Text>
            </View>
          )}
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa', gap: 12 },
  loadingText: { fontSize: 14, color: '#747871' },
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { paddingBottom: 120 },

  // Hero
  hero: { paddingTop: 52, paddingBottom: 24, paddingHorizontal: 20 },
  heroTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
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
  heroActivity: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginBottom: 4 },
  heroRoute: { fontSize: 15, color: 'rgba(255,255,255,0.6)', marginBottom: 16 },
  heroPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  heroPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100 },
  heroPillText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  heroCountdown: { backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: 18, marginBottom: 16, overflow: 'hidden' },
  progressBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.1)' },
  progressFill: { height: 3 },
  heroCountdownLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5, marginBottom: 6, marginTop: 4 },
  heroCountdownTime: { fontSize: 42, fontWeight: '900', color: '#fff', letterSpacing: -1, marginBottom: 4 },
  heroCountdownSub: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  heroWeather: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroWeatherTemp: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  heroWeatherDesc: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },

  // Safety Controls
  safetySection: { paddingHorizontal: 20, paddingTop: 20, gap: 10 },
  checkoutBtn: { backgroundColor: '#061907', borderRadius: 4, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  checkoutBtnRed: { backgroundColor: '#dc2626' },
  checkoutText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  portalBtn: { backgroundColor: '#fff', borderRadius: 4, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#e1e3e4' },
  portalBtnText: { color: '#2c694e', fontWeight: '700', fontSize: 14 },
  safetyNote: { fontSize: 12, color: '#747871', textAlign: 'center', lineHeight: 16 },

  // Sections
  section: { paddingHorizontal: 20, paddingTop: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#061907', letterSpacing: -0.3, marginBottom: 12 },
  syncBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  syncText: { fontSize: 11, fontWeight: '700', color: '#2c694e' },

  // Warning
  warningCard: { backgroundColor: '#fff8e1', borderRadius: 4, padding: 16, borderLeftWidth: 3, borderLeftColor: '#f59e0b' },
  warningHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  warningTitle: { fontSize: 13, fontWeight: '700', color: '#92400e', flex: 1 },
  warningItem: { fontSize: 13, color: '#92400e', marginBottom: 5, lineHeight: 18 },

  // Map
  mapContainer: { backgroundColor: '#e1e3e4', borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: '#e1e3e4' },

  // Card
  card: { backgroundColor: '#fff', borderRadius: 4, padding: 16, borderWidth: 1, borderColor: '#e1e3e4' },

  // Weather
  weatherRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  weatherTemp: { fontSize: 36, fontWeight: '900', color: '#061907', letterSpacing: -1 },
  weatherDesc: { fontSize: 13, color: '#747871', marginTop: 2 },
  weatherDetails: { gap: 8, alignItems: 'flex-end' },
  weatherDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weatherDetailText: { fontSize: 12, color: '#747871' },

  // Timeline
  timeline: { gap: 0 },
  tlEntry: { flexDirection: 'row', gap: 0, minHeight: 70 },
  tlLeft: { width: 28, alignItems: 'center', paddingTop: 4 },
  tlDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#f8f9fa', zIndex: 1 },
  tlLine: { flex: 1, width: 2, backgroundColor: '#e1e3e4', marginTop: 4 },
  tlCard: { flex: 1, backgroundColor: '#fff', borderRadius: 4, padding: 14, borderWidth: 1, borderColor: '#e1e3e4', marginLeft: 8, marginBottom: 10 },
  tlCardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  tlCardTitle: { fontSize: 11, fontWeight: '700', color: '#061907', letterSpacing: 0.5 },
  tlCardTime: { fontSize: 11, color: '#747871', fontWeight: '500' },
  tlCardDesc: { fontSize: 12, color: '#747871', lineHeight: 16 },
  tlCardLink: { fontSize: 12, color: '#2c694e', fontWeight: '700', marginTop: 4 },

  // Details
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f5' },
  detailKey: { fontSize: 13, color: '#747871' },
  detailVal: { fontSize: 13, fontWeight: '600', color: '#191c1d', flex: 1, textAlign: 'right' },
});