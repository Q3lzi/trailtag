import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, Linking } from 'react-native';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { apiFetch } from '../lib/api';
import { getToken } from '../lib/storage';
import { showAlert, showConfirm } from '../lib/alert';
import { cancelAllNotifications } from '../lib/notifications';
import { stopLocationTracking } from '../lib/tracking';

const ACTIVITY_LABELS: Record<string, { label: string; emoji: string }> = {
  WANDERN:      { label: 'Wandern',      emoji: '🥾' },
  BERGTOUR:     { label: 'Bergtour',     emoji: '🏔️' },
  KLETTERN:     { label: 'Klettern',     emoji: '🧗' },
  TRAILRUNNING: { label: 'Trailrunning', emoji: '🏃' },
  MOUNTAINBIKE: { label: 'Mountainbike', emoji: '🚵' },
  RADSPORT:     { label: 'Radsport',     emoji: '🚴' },
  SKI_SNOWBOARD:{ label: 'Ski/Snowboard',emoji: '🎿' },
  SKITOUR:      { label: 'Skitour',      emoji: '⛷️' },
  KLETTERSTEIG: { label: 'Klettersteig', emoji: '🪝' },
  KANU_KAJAK:   { label: 'Kanu/Kajak',   emoji: '🛶' },
  PARAGLIDING:  { label: 'Paragliding',  emoji: '🪂' },
  ANDERE:       { label: 'Andere',       emoji: '🏕️' },
};

const WMO_CODES: Record<number, { text: string; emoji: string }> = {
  0: { text: 'Klar', emoji: '☀️' },
  1: { text: 'Überwiegend klar', emoji: '🌤️' },
  2: { text: 'Teilweise bewölkt', emoji: '⛅' },
  3: { text: 'Bewölkt', emoji: '☁️' },
  45: { text: 'Nebel', emoji: '🌫️' },
  48: { text: 'Gefrierender Nebel', emoji: '🌫️' },
  51: { text: 'Leichter Nieselregen', emoji: '🌦️' },
  53: { text: 'Nieselregen', emoji: '🌦️' },
  55: { text: 'Starker Nieselregen', emoji: '🌧️' },
  61: { text: 'Leichter Regen', emoji: '🌧️' },
  63: { text: 'Regen', emoji: '🌧️' },
  65: { text: 'Starker Regen', emoji: '🌧️' },
  71: { text: 'Leichter Schneefall', emoji: '🌨️' },
  73: { text: 'Schneefall', emoji: '❄️' },
  75: { text: 'Starker Schneefall', emoji: '❄️' },
  80: { text: 'Leichte Schauer', emoji: '🌦️' },
  81: { text: 'Schauer', emoji: '🌧️' },
  82: { text: 'Starke Schauer', emoji: '⛈️' },
  95: { text: 'Gewitter', emoji: '⛈️' },
  96: { text: 'Gewitter mit Hagel', emoji: '⛈️' },
  99: { text: 'Starkes Gewitter', emoji: '⛈️' },
};

function useCountdown(eta: string | null) {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    if (!eta) return;
    const interval = setInterval(() => {
      const diff = new Date(eta).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Überfällig!'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, [eta]);
  return timeLeft;
}

async function fetchWeather(lat: number, lng: number) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weathercode,windspeed_10m,relative_humidity_2m,apparent_temperature&hourly=temperature_2m,weathercode,windspeed_10m,precipitation_probability,snowfall&wind_speed_unit=kmh&timezone=Europe/Zurich&forecast_days=1`
    );
    const data = await res.json();

    // Nächste 6 Stunden analysieren
    const now = new Date();
    const currentHour = now.getHours();
    const nextHours = Array.from({ length: 6 }, (_, i) => currentHour + i + 1).filter(h => h < 24);

    const warnings: string[] = [];

    for (const h of nextHours) {
      const code = data.hourly.weathercode[h];
      const wind = data.hourly.windspeed_10m[h];
      const snow = data.hourly.snowfall[h];
      const precip = data.hourly.precipitation_probability[h];
      const temp = data.hourly.temperature_2m[h];
      const timeStr = `${h}:00`;

      if (code >= 95) warnings.push(`⛈️ Gewitter um ${timeStr} Uhr`);
      else if (code >= 80) warnings.push(`🌧️ Starke Schauer um ${timeStr} Uhr`);
      if (snow > 0.5) warnings.push(`❄️ Schneefall um ${timeStr} Uhr (${snow.toFixed(1)} cm)`);
      if (wind > 60) warnings.push(`💨 Starker Wind um ${timeStr} Uhr (${wind} km/h)`);
      if (temp < 0) warnings.push(`🥶 Frost um ${timeStr} Uhr (${temp}°C)`);
      if (precip > 70 && code >= 61) warnings.push(`🌧️ Hohe Regenwahrscheinlichkeit um ${timeStr} Uhr (${precip}%)`);
    }

    // Deduplizieren
    const uniqueWarnings = [...new Set(warnings)];

    return {
      temp: Math.round(data.current.temperature_2m),
      feelsLike: Math.round(data.current.apparent_temperature),
      code: data.current.weathercode,
      wind: Math.round(data.current.windspeed_10m),
      humidity: data.current.relative_humidity_2m,
      warnings: uniqueWarnings,
    };
  } catch { return null; }
}

export default function TourDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tour, setTour] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState<any>(null);
  const timeLeft = useCountdown(tour?.eta ?? null);
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number, time: string} | null>(null);
  const mapRef = useRef<any>(null);

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
  import('leaflet').then((L) => {
    const container = document.getElementById('tour-map');
    if (!container || !(container as any)._leaflet_id) return;
    const map = (L.default as any).map(container);
    map.setView([selectedLocation.lat, selectedLocation.lng], 15, { animate: true });
    // Highlight Marker
    L.default.circleMarker([selectedLocation.lat, selectedLocation.lng] as [number, number], {
      radius: 14, fillColor: '#f59e0b', color: '#fff', weight: 3, fillOpacity: 0.9
    }).bindPopup(`📍 ${selectedLocation.time}`).addTo(map).openPopup();
  });
}, [selectedLocation]);

  useEffect(() => {
    if (!tour || Platform.OS !== 'web') return;
    const lat = tour.lastLat ?? tour.startLat;
    const lng = tour.lastLng ?? tour.startLng;
    if (!lat || !lng) return;

    const points = tour.locations?.length > 0
      ? tour.locations.map((l: any) => [l.lat, l.lng])
      : [[lat, lng]];

    const container = document.getElementById('tour-map');
    if (!container) return;

    if (!document.getElementById('leaflet-css-detail')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css-detail';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    import('leaflet').then((L) => {
      if ((container as any)._leaflet_id) {
        container.innerHTML = '';
        delete (container as any)._leaflet_id;
      }
      const map = L.default.map(container);
      L.default.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO'
      }).addTo(map);

      if (points.length > 1) {
        const poly = L.default.polyline(points as [number, number][], { color: '#2D6A4F', weight: 4, opacity: 0.9 }).addTo(map);
        L.default.circleMarker(points[0] as [number, number], { radius: 8, fillColor: '#2D6A4F', color: '#fff', weight: 2, fillOpacity: 1 }).bindPopup('🟢 Start').addTo(map);
        map.fitBounds(poly.getBounds(), { padding: [20, 20] });
      } else {
        map.setView([lat, lng], 13);
      }

      L.default.circleMarker([lat, lng] as [number, number], { radius: 10, fillColor: '#e63946', color: '#fff', weight: 3, fillOpacity: 1 })
        .bindPopup('📍 Letzter Standort').addTo(map).openPopup();
    });
  }, [tour?.locations?.length, tour?.lastLat, tour?.lastLng]);

  async function loadTour() {
    try {
      const token = await getToken();
      const data = await apiFetch(`/tours/${id}`, {}, token ?? undefined);
      setTour(data);
    } catch { console.log('Fehler'); }
    finally { setLoading(false); }
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

  if (loading) return <View style={styles.loading}><Text style={{ fontSize: 48 }}>🏔️</Text><Text style={styles.loadingText}>Lädt...</Text></View>;
  if (!tour) return <View style={styles.loading}><Text style={{ fontSize: 48 }}>❌</Text></View>;

  const isOverdue = tour.eta && new Date(tour.eta).getTime() < Date.now();
  const isActive = tour.status === 'ACTIVE' || tour.status === 'ALARM';
  const activity = ACTIVITY_LABELS[tour.activity] ?? { label: tour.activity, emoji: '🏕️' };
  const qrUrl = tour.vehicle ? `https://trailtag-production.up.railway.app/r/${tour.vehicle.qrToken}` : null;
  const locationCount = tour.locations?.length ?? 0;
  const minutesSinceUpdate = tour.locationUpdatedAt
    ? Math.floor((Date.now() - new Date(tour.locationUpdatedAt).getTime()) / 60000)
    : null;
  const weatherInfo = weather ? (WMO_CODES[weather.code] ?? { text: 'Unbekannt', emoji: '🌡️' }) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Header */}
      <View style={[styles.header, isOverdue ? styles.headerRed : isActive ? styles.headerGreen : styles.headerGray]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Zurück</Text>
        </TouchableOpacity>
        <View style={styles.headerTop}>
          <Text style={styles.headerEmoji}>{activity.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{activity.label}</Text>
            {tour.routeName && <Text style={styles.headerSub}>{tour.routeName}</Text>}
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, isOverdue ? styles.dotRed : isActive ? styles.dotGreen : styles.dotGray]} />
              <Text style={styles.statusText}>{isOverdue ? 'ÜBERFÄLLIG' : isActive ? 'AKTIV' : 'ABGESCHLOSSEN'}</Text>
            </View>
          </View>
          {/* Wetter */}
          {weather && weatherInfo && (
            <View style={styles.weatherBox}>
              <Text style={styles.weatherEmoji}>{weatherInfo.emoji}</Text>
              <Text style={styles.weatherTemp}>{weather.temp}°</Text>
              <Text style={styles.weatherDesc}>{weatherInfo.text}</Text>
            </View>
          )}
        </View>

        {/* Countdown */}
        {isActive && (
          <View style={styles.countdownBox}>
            <Text style={styles.countdownLabel}>{isOverdue ? '🚨 ÜBERFÄLLIG SEIT' : '⏱️ VERBLEIBEND'}</Text>
            <Text style={styles.countdown}>{timeLeft}</Text>
            <Text style={styles.countdownSub}>Rückkehr geplant: {new Date(tour.eta).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
        )}
      </View>

      {/* Karte */}
      {(tour.startLat || tour.lastLat) && Platform.OS === 'web' && (
        <View style={styles.mapSection}>
          <div id="tour-map" style={{ width: '100%', height: 320 } as any} />
          <View style={styles.mapFooter}>
            <Text style={styles.mapFooterText}>
              {locationCount > 0 ? `📍 ${locationCount} GPS-Punkte` : '📍 Startpunkt'}
              {minutesSinceUpdate !== null && (
                <Text style={[styles.mapFooterText, minutesSinceUpdate > 30 ? { color: '#e67e22' } : { color: '#2D6A4F' }]}>
                  {' · '}vor {minutesSinceUpdate} Min. aktualisiert {minutesSinceUpdate > 30 ? '⚠️' : '✅'}
                </Text>
              )}
            </Text>
          </View>
        </View>
      )}

      {/* Stats */}
      {(tour.distanceKm || tour.elevationUp || tour.difficulty || tour.persons > 1) && (
        <View style={styles.statsSection}>
          {tour.distanceKm && (
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>📏</Text>
              <Text style={styles.statVal}>{tour.distanceKm}</Text>
              <Text style={styles.statLbl}>km</Text>
            </View>
          )}
          {tour.elevationUp && (
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>⬆️</Text>
              <Text style={styles.statVal}>{tour.elevationUp}</Text>
              <Text style={styles.statLbl}>Höhenmeter</Text>
            </View>
          )}
          {tour.difficulty && (
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>🎯</Text>
              <Text style={styles.statVal}>{tour.difficulty}</Text>
              <Text style={styles.statLbl}>SAC Grad</Text>
            </View>
          )}
          {tour.persons > 1 && (
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>👥</Text>
              <Text style={styles.statVal}>{tour.persons}</Text>
              <Text style={styles.statLbl}>Personen</Text>
            </View>
          )}
        </View>
      )}
        {/* Wetter-Warnungen */}
        {weather?.warnings?.length > 0 && (
        <View style={styles.section}>
            <Text style={styles.sectionLabel}>⚠️ WETTERWARNUNGEN</Text>
            <View style={styles.warningsCard}>
            {weather.warnings.map((w: string, i: number) => (
                <View key={i} style={styles.warningRow}>
                <Text style={styles.warningText}>{w}</Text>
                </View>
            ))}
            <Text style={styles.warningHint}>Prüfe die Wetterentwicklung vor dem Aufstieg!</Text>
            </View>
        </View>
        )}
      {/* Wetter Details */}
      {weather && weatherInfo && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>WETTER AM STANDORT</Text>
          <View style={styles.weatherCard}>
            <View style={styles.weatherMain}>
              <Text style={styles.weatherBigEmoji}>{weatherInfo.emoji}</Text>
              <View>
                <Text style={styles.weatherBigTemp}>{weather.temp}°C</Text>
                <Text style={styles.weatherBigDesc}>{weatherInfo.text}</Text>
              </View>
            </View>
<View style={styles.weatherDetails}>
  <View style={styles.weatherDetail}>
    <Text style={styles.weatherDetailVal}>💨 {weather.wind} km/h</Text>
    <Text style={styles.weatherDetailLbl}>Wind</Text>
  </View>
  <View style={styles.weatherDetail}>
    <Text style={styles.weatherDetailVal}>💧 {weather.humidity}%</Text>
    <Text style={styles.weatherDetailLbl}>Luftfeuchtigkeit</Text>
  </View>
  <View style={styles.weatherDetail}>
    <Text style={styles.weatherDetailVal}>🌡️ {weather.feelsLike}°C</Text>
    <Text style={styles.weatherDetailLbl}>Gefühlt</Text>
  </View>
</View>
          </View>
        </View>
      )}

{/* Zeitverlauf */}
<View style={styles.section}>
  <Text style={styles.sectionLabel}>ZEITVERLAUF</Text>
  <View style={styles.card}>
    {tour.startedAt && (
      <TouchableOpacity
        style={styles.timeRow}
        onPress={() => tour.startLat && setSelectedLocation({
          lat: tour.startLat, lng: tour.startLng,
          time: new Date(tour.startedAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
        })}
      >
        <View style={[styles.timeDot, { backgroundColor: '#2D6A4F' }]} />
        <View style={styles.timeContent}>
          <Text style={styles.timeLabel}>🟢 Gestartet</Text>
          <Text style={styles.timeVal}>{new Date(tour.startedAt).toLocaleString('de-CH', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</Text>
        </View>
        {tour.startLat && <Text style={styles.timeArrow}>→</Text>}
      </TouchableOpacity>
    )}

    {/* Tracking Punkte — alle 10. Punkt anzeigen um nicht zu überladen */}
    {tour.locations?.filter((_: any, i: number) => i % 10 === 0 && i > 0).map((loc: any) => (
      <TouchableOpacity
        key={loc.id}
        style={styles.timeRow}
        onPress={() => setSelectedLocation({
          lat: loc.lat, lng: loc.lng,
          time: new Date(loc.timestamp).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
        })}
      >
        <View style={[styles.timeDot, { backgroundColor: '#94a3b8', width: 6, height: 6 }]} />
        <View style={styles.timeContent}>
          <Text style={styles.timeLabel}>📍 Tracking-Punkt</Text>
          <Text style={styles.timeVal}>{new Date(loc.timestamp).toLocaleString('de-CH', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</Text>
        </View>
        <Text style={styles.timeArrow}>→</Text>
      </TouchableOpacity>
    ))}

    {tour.locationUpdatedAt && (
      <TouchableOpacity
        style={styles.timeRow}
        onPress={() => tour.lastLat && setSelectedLocation({
          lat: tour.lastLat, lng: tour.lastLng,
          time: new Date(tour.locationUpdatedAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
        })}
      >
        <View style={[styles.timeDot, { backgroundColor: '#f59e0b' }]} />
        <View style={styles.timeContent}>
          <Text style={styles.timeLabel}>📡 Letzter Standort</Text>
          <Text style={styles.timeVal}>{new Date(tour.locationUpdatedAt).toLocaleString('de-CH', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</Text>
        </View>
        {tour.lastLat && <Text style={styles.timeArrow}>→</Text>}
      </TouchableOpacity>
    )}

    {tour.eta && (
      <View style={styles.timeRow}>
        <View style={[styles.timeDot, { backgroundColor: isOverdue ? '#e63946' : '#2D6A4F' }]} />
        <View style={styles.timeContent}>
          <Text style={styles.timeLabel}>🏁 Geplante Rückkehr</Text>
          <Text style={[styles.timeVal, isOverdue && { color: '#e63946', fontWeight: '800' }]}>
            {new Date(tour.eta).toLocaleString('de-CH', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
          </Text>
        </View>
      </View>
    )}

    {tour.checkedOutAt && (
      <View style={styles.timeRow}>
        <View style={[styles.timeDot, { backgroundColor: '#4ade80' }]} />
        <View style={styles.timeContent}>
          <Text style={styles.timeLabel}>✅ Ausgecheckt</Text>
          <Text style={styles.timeVal}>{new Date(tour.checkedOutAt).toLocaleString('de-CH', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</Text>
        </View>
      </View>
    )}
  </View>
</View>

      {/* Parkplatz & Notizen */}
      {(tour.parkingLocation || tour.notes) && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>INFOS FÜR RETTUNGSKRÄFTE</Text>
          <View style={styles.card}>
            {tour.parkingLocation && (
              <View style={styles.infoBlock}>
                <Text style={styles.infoBlockLabel}>🚗 Parkplatz / Startort</Text>
                <Text style={styles.infoBlockVal}>{tour.parkingLocation}</Text>
              </View>
            )}
            {tour.notes && (
              <View style={styles.infoBlock}>
                <Text style={styles.infoBlockLabel}>📋 Notizen</Text>
                <Text style={styles.infoBlockVal}>{tour.notes}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Aktionen */}
      {(isActive || qrUrl) && (
        <View style={styles.section}>
          <View style={styles.actionRow}>
            {qrUrl && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => {
                if (Platform.OS === 'web') { window.open(qrUrl, '_blank'); }
                else { Linking.openURL(qrUrl!); }
              }}>
                <Text style={styles.actionBtnEmoji}>🔗</Text>
                <Text style={styles.actionBtnText}>Portal</Text>
              </TouchableOpacity>
            )}
            {isActive && (
              <TouchableOpacity
                style={[styles.checkoutBtn, isOverdue && styles.checkoutBtnRed]}
                onPress={handleCheckout}
              >
                <Text style={styles.checkoutText}>✅ Ich bin sicher zurück</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8faf8', gap: 12 },
  loadingText: { fontSize: 16, color: '#888' },
  container: { flex: 1, backgroundColor: '#f8faf8' },
  content: { paddingBottom: 100 },

  header: { paddingTop: 56, paddingBottom: 24, paddingHorizontal: 20 },
  headerGreen: { backgroundColor: '#1a3d2b' },
  headerRed: { backgroundColor: '#7f1d1d' },
  headerGray: { backgroundColor: '#2d3748' },
  backBtn: { marginBottom: 16 },
  backText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '600' },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  headerEmoji: { fontSize: 44, marginTop: 2 },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 3, marginBottom: 6 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotGreen: { backgroundColor: '#4ade80' },
  dotRed: { backgroundColor: '#f87171' },
  dotGray: { backgroundColor: '#94a3b8' },
  statusText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 1 },
  weatherBox: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 10, minWidth: 72 },
  weatherEmoji: { fontSize: 24 },
  weatherTemp: { fontSize: 18, fontWeight: '800', color: '#fff', textAlign: 'center' },
  weatherDesc: { fontSize: 10, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 2 },
  countdownBox: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16, padding: 16 },
  countdownLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 1, marginBottom: 4 },
  countdown: { fontSize: 38, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  countdownSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },

  mapSection: { backgroundColor: '#fff', marginBottom: 4 },
  mapFooter: { padding: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  mapFooterText: { fontSize: 12, color: '#888', fontWeight: '500' },

  statsSection: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 16 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  statEmoji: { fontSize: 20, marginBottom: 6 },
  statVal: { fontSize: 22, fontWeight: '900', color: '#111' },
  statLbl: { fontSize: 11, color: '#aaa', marginTop: 3, fontWeight: '600', textAlign: 'center' },

  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#aaa', letterSpacing: 1, marginBottom: 10 },

  weatherCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  weatherMain: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  weatherBigEmoji: { fontSize: 48 },
  weatherBigTemp: { fontSize: 32, fontWeight: '900', color: '#111' },
  weatherBigDesc: { fontSize: 14, color: '#888', marginTop: 2 },
  weatherDetails: { flexDirection: 'row', gap: 20, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 16 },
  weatherDetail: { gap: 4 },
  weatherDetailVal: { fontSize: 15, fontWeight: '700', color: '#333' },
  weatherDetailLbl: { fontSize: 11, color: '#aaa' },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  timeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  timeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2D6A4F', marginTop: 4 },
  timeContent: { flex: 1 },
  timeLabel: { fontSize: 12, color: '#aaa', fontWeight: '600' },
  timeVal: { fontSize: 15, fontWeight: '700', color: '#111', marginTop: 2 },

  infoBlock: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  infoBlockLabel: { fontSize: 12, color: '#aaa', fontWeight: '600', marginBottom: 4 },
  infoBlockVal: { fontSize: 15, color: '#333', lineHeight: 22 },

  actionRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  actionBtn: { backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1.5, borderColor: '#e8f5e9', minWidth: 80 },
  actionBtnEmoji: { fontSize: 20, marginBottom: 4 },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: '#2D6A4F' },
  checkoutBtn: { flex: 1, backgroundColor: '#2D6A4F', padding: 18, borderRadius: 16, alignItems: 'center' },
  checkoutBtnRed: { backgroundColor: '#dc2626' },
  checkoutText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  warningsCard: { backgroundColor: '#fff8f0', borderRadius: 16, padding: 16, borderLeftWidth: 4, borderLeftColor: '#e67e22', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
warningRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#fde8cc' },
warningText: { fontSize: 14, fontWeight: '600', color: '#c0392b' },
warningHint: { fontSize: 12, color: '#e67e22', marginTop: 10, fontStyle: 'italic' },
timeArrow: { fontSize: 16, color: '#2D6A4F', fontWeight: '700', paddingLeft: 8 },
});