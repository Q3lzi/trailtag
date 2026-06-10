import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, Linking } from 'react-native';
import { useState, useEffect, useRef } from 'react';
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

export default function TourDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tour, setTour] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const mapInitialized = useRef(false);
  const timeLeft = useCountdown(tour?.eta ?? null);

  useEffect(() => {
    loadTour();
    const interval = setInterval(loadTour, 60000);
    return () => clearInterval(interval);
  }, [id]);

  // Karte nur neu zeichnen wenn neue Punkte kommen
  useEffect(() => {
    if (!tour || Platform.OS !== 'web') return;
    const points = tour.locations?.length > 0
      ? tour.locations.map((l: any) => [l.lat, l.lng])
      : tour.startLat ? [[tour.startLat, tour.startLng]] : [];
    if (points.length === 0) return;
    const lastLat = tour.lastLat ?? tour.startLat;
    const lastLng = tour.lastLng ?? tour.startLng;

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
      // Bestehende Karte entfernen
      if ((container as any)._leaflet_id) {
        (L.default as any).map(container).remove();
        (container as any)._leaflet_id = undefined;
      }

      const map = L.default.map(container, { zoomControl: true });

      L.default.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO'
      }).addTo(map);

      if (points.length > 1) {
        const poly = L.default.polyline(points as [number, number][], {
          color: '#2D6A4F', weight: 4, opacity: 0.9
        }).addTo(map);
        L.default.circleMarker(points[0] as [number, number], {
          radius: 8, fillColor: '#2D6A4F', color: '#fff', weight: 2, fillOpacity: 1
        }).bindPopup('🟢 Start').addTo(map);
        map.fitBounds(poly.getBounds(), { padding: [20, 20] });
      } else {
        map.setView([lastLat, lastLng], 13);
      }

      L.default.circleMarker([lastLat, lastLng] as [number, number], {
        radius: 10, fillColor: '#e63946', color: '#fff', weight: 3, fillOpacity: 1
      }).bindPopup('📍 Letzter Standort').addTo(map).openPopup();
    });
  }, [tour?.locations?.length, tour?.lastLat, tour?.lastLng]);

  async function loadTour() {
    try {
      const token = await getToken();
      const data = await apiFetch(`/tours/${id}`, {}, token ?? undefined);
      setTour(data);
    } catch (err) {
      console.log('Fehler beim Laden');
    } finally {
      setLoading(false);
    }
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
    } catch (err: any) {
      showAlert('Fehler', err.message);
    }
  }

  if (loading) return (
    <View style={styles.loading}>
      <Text style={styles.loadingEmoji}>🏔️</Text>
      <Text style={styles.loadingText}>Lädt...</Text>
    </View>
  );

  if (!tour) return (
    <View style={styles.loading}>
      <Text style={styles.loadingEmoji}>❌</Text>
      <Text style={styles.loadingText}>Tour nicht gefunden</Text>
    </View>
  );

  const isOverdue = tour.eta && new Date(tour.eta).getTime() < Date.now();
  const isActive = tour.status === 'ACTIVE' || tour.status === 'ALARM';
  const activity = ACTIVITY_LABELS[tour.activity] ?? { label: tour.activity, emoji: '🏕️' };
  const qrUrl = tour.vehicle
    ? `https://trailtag-production.up.railway.app/r/${tour.vehicle.qrToken}`
    : null;
  const locationCount = tour.locations?.length ?? 0;
  const minutesSinceUpdate = tour.locationUpdatedAt
    ? Math.floor((Date.now() - new Date(tour.locationUpdatedAt).getTime()) / 60000)
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={[styles.header, isOverdue ? styles.headerRed : isActive ? styles.headerGreen : styles.headerGray]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Zurück</Text>
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <Text style={styles.headerEmoji}>{activity.emoji}</Text>
          <View style={styles.headerInfo}>
            <Text style={styles.title}>{activity.label}</Text>
            {tour.routeName && <Text style={styles.subtitle}>{tour.routeName}</Text>}
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, isOverdue ? styles.dotRed : isActive ? styles.dotGreen : styles.dotGray]} />
              <Text style={styles.statusText}>
                {isOverdue ? 'ÜBERFÄLLIG' : isActive ? 'AKTIV' : tour.status}
              </Text>
            </View>
          </View>
        </View>

        {isActive && (
          <View style={styles.countdownBox}>
            <Text style={styles.countdownLabel}>{isOverdue ? '🚨 Überfällig seit' : '⏱️ Verbleibend'}</Text>
            <Text style={styles.countdown}>{timeLeft}</Text>
            <Text style={styles.countdownSub}>
              Rückkehr: {new Date(tour.eta).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        )}
      </View>

      {/* Karte */}
      {(tour.startLat || tour.lastLat) && Platform.OS === 'web' && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>📍 ROUTE & STANDORT</Text>
            {locationCount > 0 && (
              <Text style={styles.sectionMeta}>{locationCount} Punkte</Text>
            )}
          </View>
          <View style={styles.mapCard}>
            <div id="tour-map" style={{ width: '100%', height: 280, borderRadius: 12, overflow: 'hidden' } as any} />
            {tour.locationUpdatedAt && (
              <View style={[styles.locationBadge, minutesSinceUpdate && minutesSinceUpdate > 30 ? styles.locationBadgeStale : styles.locationBadgeFresh]}>
                <Text style={styles.locationBadgeText}>
                  {minutesSinceUpdate && minutesSinceUpdate > 30 ? '⚠️' : '✅'} Standort vor {minutesSinceUpdate} Min. aktualisiert
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Stats */}
      {(tour.distanceKm || tour.elevationUp || tour.difficulty || tour.persons > 1) && (
        <View style={styles.section}>
          <View style={styles.statsRow}>
            {tour.distanceKm && (
              <View style={styles.statCard}>
                <Text style={styles.statVal}>{tour.distanceKm}</Text>
                <Text style={styles.statLbl}>km</Text>
              </View>
            )}
            {tour.elevationUp && (
              <View style={styles.statCard}>
                <Text style={styles.statVal}>{tour.elevationUp}</Text>
                <Text style={styles.statLbl}>hm ⬆️</Text>
              </View>
            )}
            {tour.difficulty && (
              <View style={styles.statCard}>
                <Text style={styles.statVal}>{tour.difficulty}</Text>
                <Text style={styles.statLbl}>SAC</Text>
              </View>
            )}
            {tour.persons > 1 && (
              <View style={styles.statCard}>
                <Text style={styles.statVal}>{tour.persons}</Text>
                <Text style={styles.statLbl}>Personen</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Details */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>DETAILS</Text>
        <View style={styles.card}>
          {tour.startedAt && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLbl}>⏰ Gestartet</Text>
              <Text style={styles.infoVal}>{new Date(tour.startedAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          )}
          {tour.eta && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLbl}>🏁 Geplante Rückkehr</Text>
              <Text style={styles.infoVal}>{new Date(tour.eta).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          )}
          {tour.parkingLocation && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLbl}>🚗 Parkplatz</Text>
              <Text style={styles.infoVal}>{tour.parkingLocation}</Text>
            </View>
          )}
          {tour.checkedOutAt && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLbl}>✅ Ausgecheckt</Text>
              <Text style={styles.infoVal}>{new Date(tour.checkedOutAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          )}
          {tour.notes && (
            <View style={[styles.infoRow, { flexDirection: 'column', alignItems: 'flex-start' }]}>
              <Text style={styles.infoLbl}>📋 Notizen</Text>
              <Text style={[styles.infoVal, { textAlign: 'left', marginTop: 4 }]}>{tour.notes}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Fahrzeug & Portal */}
      {qrUrl && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>FAHRZEUG</Text>
          <TouchableOpacity style={styles.portalCard} onPress={() => {
            if (Platform.OS === 'web') {
              window.open(qrUrl, '_blank');
            } else {
              Linking.openURL(qrUrl);
            }
          }}>
            <View style={styles.portalLeft}>
              <Text style={styles.portalTitle}>🔗 Erstretter-Portal öffnen</Text>
              <Text style={styles.portalSub}>{tour.vehicle?.plate} · {tour.vehicle?.make} {tour.vehicle?.model}</Text>
            </View>
            <Text style={styles.portalArrow}>→</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Checkout */}
      {isActive && (
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.checkoutBtn, isOverdue && styles.checkoutBtnRed]}
            onPress={handleCheckout}
          >
            <Text style={styles.checkoutText}>✅ Ich bin sicher zurück</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8faf8', gap: 12 },
  loadingEmoji: { fontSize: 48 },
  loadingText: { fontSize: 16, color: '#888' },
  container: { flex: 1, backgroundColor: '#f8faf8' },
  content: { paddingBottom: 100 },
  header: { paddingTop: 56, paddingBottom: 28, paddingHorizontal: 24 },
  headerGreen: { backgroundColor: '#1a3d2b' },
  headerRed: { backgroundColor: '#7f1d1d' },
  headerGray: { backgroundColor: '#2d3748' },
  backBtn: { marginBottom: 20 },
  backText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '600' },
  headerContent: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  headerEmoji: { fontSize: 48 },
  headerInfo: { flex: 1 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotGreen: { backgroundColor: '#4ade80' },
  dotRed: { backgroundColor: '#f87171' },
  dotGray: { backgroundColor: '#aaa' },
  statusText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },
  countdownBox: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16, padding: 16 },
  countdownLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 1, marginBottom: 4 },
  countdown: { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  countdownSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#aaa', letterSpacing: 1, marginBottom: 10 },
  sectionMeta: { fontSize: 11, color: '#bbb' },
  mapCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  locationBadge: { padding: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  locationBadgeFresh: { backgroundColor: '#f0faf4' },
  locationBadgeStale: { backgroundColor: '#fff8f0' },
  locationBadgeText: { fontSize: 12, fontWeight: '600', color: '#555' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  statVal: { fontSize: 24, fontWeight: '900', color: '#2D6A4F' },
  statLbl: { fontSize: 11, color: '#aaa', marginTop: 4, fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  infoLbl: { fontSize: 13, color: '#888', flex: 1 },
  infoVal: { fontSize: 13, fontWeight: '600', color: '#333', flex: 1, textAlign: 'right' },
  portalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1.5, borderColor: '#d1fae5', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  portalLeft: { gap: 4 },
  portalTitle: { fontSize: 15, fontWeight: '700', color: '#2D6A4F' },
  portalSub: { fontSize: 12, color: '#aaa' },
  portalArrow: { fontSize: 20, color: '#2D6A4F', fontWeight: '700' },
  checkoutBtn: { backgroundColor: '#2D6A4F', padding: 20, borderRadius: 18, alignItems: 'center' },
  checkoutBtnRed: { backgroundColor: '#dc2626' },
  checkoutText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});