import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, Linking } from 'react-native';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { apiFetch } from '../lib/api';
import { getToken } from '../lib/storage';
import { showAlert, showConfirm } from '../lib/alert';
import { cancelAllNotifications } from '../lib/notifications';
import { stopLocationTracking } from '../lib/tracking';
import GpxMap from '../components/GpxMap';

const ACTIVITY_LABELS: Record<string, string> = {
  WANDERN: '🥾 Wandern', BERGTOUR: '🏔️ Bergtour', KLETTERN: '🧗 Klettern',
  TRAILRUNNING: '🏃 Trailrunning', MOUNTAINBIKE: '🚵 Mountainbike',
  RADSPORT: '🚴 Radsport', SKI_SNOWBOARD: '🎿 Ski/Snowboard',
  SKITOUR: '⛷️ Skitour', KLETTERSTEIG: '🪝 Klettersteig',
  KANU_KAJAK: '🛶 Kanu/Kajak', PARAGLIDING: '🪂 Paragliding', ANDERE: '🏕️ Andere'
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
  const timeLeft = useCountdown(tour?.eta ?? null);

  useEffect(() => {
    loadTour();
    // Auto-refresh alle 30 Sekunden
    const interval = setInterval(loadTour, 30000);
    return () => clearInterval(interval);
  }, [id]);

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
    </View>
  );

  if (!tour) return (
    <View style={styles.loading}>
      <Text style={styles.loadingEmoji}>❌</Text>
    </View>
  );

  const isOverdue = tour.eta && new Date(tour.eta).getTime() < Date.now();
  const isActive = tour.status === 'ACTIVE' || tour.status === 'ALARM';
  const trackPoints = tour.locations?.length > 0
    ? tour.locations.map((l: any) => ({ lat: l.lat, lng: l.lng, ele: l.ele }))
    : tour.startLat ? [{ lat: tour.startLat, lng: tour.startLng }] : [];

  const qrUrl = tour.vehicle ? `https://trailtag-production.up.railway.app/r/${tour.vehicle.qrToken}` : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={[styles.header, isOverdue ? styles.headerRed : styles.headerGreen]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Zurück</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{ACTIVITY_LABELS[tour.activity] ?? tour.activity}</Text>
        {tour.routeName && <Text style={styles.subtitle}>{tour.routeName}</Text>}
        {isActive && (
          <View style={styles.countdownBox}>
            <Text style={styles.countdownLabel}>{isOverdue ? '🚨 ÜBERFÄLLIG' : '⏱️ Verbleibend'}</Text>
            <Text style={styles.countdown}>{timeLeft}</Text>
          </View>
        )}
      </View>

      {/* Karte */}
      {trackPoints.length > 0 && Platform.OS === 'web' && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ROUTE & STANDORT</Text>
          <GpxMap points={trackPoints} />
          {tour.locationUpdatedAt && (
            <Text style={styles.locationMeta}>
              📍 Letzter Standort: {new Date(tour.locationUpdatedAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}
              {' · '}{tour.locations?.length ?? 0} Punkte
            </Text>
          )}
        </View>
      )}

      {/* Tour Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>TOUR DETAILS</Text>
        <View style={styles.card}>
          <View style={styles.statsRow}>
            {tour.distanceKm && (
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{tour.distanceKm}</Text>
                <Text style={styles.statLbl}>km</Text>
              </View>
            )}
            {tour.elevationUp && (
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{tour.elevationUp}</Text>
                <Text style={styles.statLbl}>hm ⬆️</Text>
              </View>
            )}
            {tour.difficulty && (
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{tour.difficulty}</Text>
                <Text style={styles.statLbl}>SAC</Text>
              </View>
            )}
            {tour.persons > 1 && (
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{tour.persons}</Text>
                <Text style={styles.statLbl}>Personen</Text>
              </View>
            )}
          </View>
          <View style={styles.divider} />
          {tour.startedAt && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLbl}>Gestartet</Text>
              <Text style={styles.infoVal}>{new Date(tour.startedAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          )}
          {tour.eta && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLbl}>Geplante Rückkehr</Text>
              <Text style={styles.infoVal}>{new Date(tour.eta).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          )}
          {tour.parkingLocation && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLbl}>Parkplatz</Text>
              <Text style={styles.infoVal}>{tour.parkingLocation}</Text>
            </View>
          )}
          {tour.notes && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLbl}>Notizen</Text>
              <Text style={styles.infoVal}>{tour.notes}</Text>
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
            <View>
              <Text style={styles.portalTitle}>🔗 Erstretter-Portal öffnen</Text>
              <Text style={styles.portalSub}>{tour.vehicle?.plate} · {tour.vehicle?.make} {tour.vehicle?.model}</Text>
            </View>
            <Text style={styles.portalArrow}>→</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Checkout Button */}
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
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8faf8' },
  loadingEmoji: { fontSize: 48 },
  container: { flex: 1, backgroundColor: '#f8faf8' },
  content: { paddingBottom: 100 },
  header: { paddingTop: 56, paddingBottom: 28, paddingHorizontal: 24 },
  headerGreen: { backgroundColor: '#1a3d2b' },
  headerRed: { backgroundColor: '#7f1d1d' },
  backBtn: { marginBottom: 16 },
  backText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  countdownBox: { marginTop: 16, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12 },
  countdownLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 1 },
  countdown: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -1, marginTop: 4 },
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#aaa', letterSpacing: 1, marginBottom: 12 },
  locationMeta: { fontSize: 12, color: '#888', marginTop: 8 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  statsRow: { flexDirection: 'row', gap: 24, marginBottom: 16 },
  statBox: { alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: '800', color: '#2D6A4F' },
  statLbl: { fontSize: 11, color: '#aaa', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  infoLbl: { fontSize: 13, color: '#aaa' },
  infoVal: { fontSize: 13, fontWeight: '600', color: '#333', flex: 1, textAlign: 'right' },
  portalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e8f5e9' },
  portalTitle: { fontSize: 14, fontWeight: '700', color: '#2D6A4F' },
  portalSub: { fontSize: 12, color: '#aaa', marginTop: 2 },
  portalArrow: { fontSize: 18, color: '#2D6A4F', fontWeight: '700' },
  checkoutBtn: { backgroundColor: '#2D6A4F', padding: 18, borderRadius: 18, alignItems: 'center' },
  checkoutBtnRed: { backgroundColor: '#dc2626' },
  checkoutText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});