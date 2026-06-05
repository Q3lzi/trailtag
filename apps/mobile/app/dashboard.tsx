import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { apiFetch } from '../lib/api';
import { showAlert, showConfirm } from '../lib/alert';
import { getToken, removeToken } from '../lib/storage';

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

const ACTIVITY_LABELS: Record<string, string> = {
  WANDERN: '🥾 Wandern', BERGTOUR: '🏔️ Bergtour', KLETTERN: '🧗 Klettern',
  TRAILRUNNING: '🏃 Trailrunning', MOUNTAINBIKE: '🚵 Mountainbike',
  RADSPORT: '🚴 Radsport', SKI_SNOWBOARD: '🎿 Ski/Snowboard',
  SKITOUR: '⛷️ Skitour', KLETTERSTEIG: '🪝 Klettersteig',
  KANU_KAJAK: '🛶 Kanu/Kajak', PARAGLIDING: '🪂 Paragliding', ANDERE: '🏕️ Andere'
};

export default function DashboardScreen() {
  const [activeTour, setActiveTour] = useState<any>(null);
  const [vehicle, setVehicle] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const timeLeft = useCountdown(activeTour?.eta ?? null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const token = await getToken();
      const [tours, vehicles, profile] = await Promise.all([
        apiFetch('/tours', {}, token ?? undefined),
        apiFetch('/vehicles', {}, token ?? undefined),
        apiFetch('/profile', {}, token ?? undefined),
      ]);
      const active = tours.find((t: any) => t.status === 'ACTIVE');
      setActiveTour(active ?? null);
      if (vehicles.length > 0) setVehicle(vehicles[0]);
      setUser(profile);
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
    await apiFetch(`/tours/${activeTour.id}/checkout`, { method: 'POST' }, token ?? undefined);
    setActiveTour(null);
  } catch (err: any) {
    showAlert('Fehler', err.message);
  }
}

async function handleLogout() {
  await removeToken();
  router.replace('/');
}

  const isOverdue = activeTour?.eta && new Date(activeTour.eta).getTime() < Date.now();
  const qrUrl = vehicle ? `https://trailtag-production.up.railway.app/r/${vehicle.qrToken}` : null;
  const firstName = user?.name?.split(' ')[0] ?? '';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>🏔️</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hallo, {firstName} 👋</Text>
          <Text style={styles.headerSub}>Bleib sicher da draussen</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Ausloggen</Text>
        </TouchableOpacity>
      </View>

      {activeTour ? (
        <>
          {/* Status Banner */}
          <View style={[styles.statusCard, isOverdue ? styles.statusCardRed : styles.statusCardGreen]}>
            <View style={styles.statusTop}>
              <View style={[styles.statusDot, isOverdue ? styles.dotRed : styles.dotGreen]} />
              <Text style={styles.statusLabel}>{isOverdue ? 'Tour überfällig!' : 'Tour aktiv'}</Text>
            </View>
            <Text style={styles.countdown}>{timeLeft}</Text>
            <Text style={styles.countdownSub}>
              {isOverdue ? 'Alarm wurde ausgelöst' : `Rückkehr geplant: ${new Date(activeTour.eta).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}`}
            </Text>
          </View>

          {/* Tour Card */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>AKTIVE TOUR</Text>
            <Text style={styles.tourActivity}>{ACTIVITY_LABELS[activeTour.activity] ?? activeTour.activity}</Text>
            {activeTour.routeName && <Text style={styles.tourRoute}>{activeTour.routeName}</Text>}

            <View style={styles.statsRow}>
              {activeTour.distanceKm && (
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{activeTour.distanceKm}</Text>
                  <Text style={styles.statLbl}>km</Text>
                </View>
              )}
              {activeTour.elevationUp && (
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{activeTour.elevationUp}</Text>
                  <Text style={styles.statLbl}>hm ⬆️</Text>
                </View>
              )}
              {activeTour.difficulty && (
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{activeTour.difficulty}</Text>
                  <Text style={styles.statLbl}>SAC</Text>
                </View>
              )}
              {activeTour.persons > 1 && (
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{activeTour.persons}</Text>
                  <Text style={styles.statLbl}>Personen</Text>
                </View>
              )}
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLbl}>Gestartet</Text>
              <Text style={styles.infoVal}>{new Date(activeTour.startedAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
            {activeTour.parkingLocation && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLbl}>Parkplatz</Text>
                <Text style={styles.infoVal}>{activeTour.parkingLocation}</Text>
              </View>
            )}
          </View>

          {/* QR Portal */}
          {qrUrl && (
            <View style={styles.portalCard}>
              <View style={styles.portalLeft}>
                <Text style={styles.portalTitle}>🔗 Erstretter-Portal aktiv</Text>
                <Text style={styles.portalSub}>QR-Code am Auto befestigen</Text>
              </View>
              <View style={styles.portalDot} />
            </View>
          )}

          {/* Checkout */}
          <TouchableOpacity
            style={[styles.checkoutBtn, isOverdue && styles.checkoutBtnRed]}
            onPress={handleCheckout}
          >
            <Text style={styles.checkoutText}>✅ Ich bin sicher zurück</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {/* No Tour */}
          <View style={styles.noTourCard}>
            <Text style={styles.noTourEmoji}>🏔️</Text>
            <Text style={styles.noTourTitle}>Keine aktive Tour</Text>
            <Text style={styles.noTourSub}>Aktiviere den Safety-Timer bevor du losgehst</Text>
            <TouchableOpacity style={styles.startBtn} onPress={() => router.push('/create-tour')}>
              <Text style={styles.startBtnText}>Tour starten</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Links */}
          <Text style={styles.sectionTitle}>Schnellzugriff</Text>
          <View style={styles.quickLinks}>
            <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/vehicle')}>
              <Text style={styles.quickIcon}>🚗</Text>
              <Text style={styles.quickTitle}>{vehicle ? `${vehicle.make} ${vehicle.model}` : 'Fahrzeug'}</Text>
              <Text style={styles.quickSub}>{vehicle ? vehicle.plate : 'Hinzufügen'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/tours')}>
              <Text style={styles.quickIcon}>📋</Text>
              <Text style={styles.quickTitle}>Archiv</Text>
              <Text style={styles.quickSub}>Vergangene Touren</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8faf8' },
  loadingText: { fontSize: 48 },
  container: { flex: 1, backgroundColor: '#f8faf8' },
  content: { padding: 24, paddingTop: 56, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  greeting: { fontSize: 24, fontWeight: '800', color: '#111', letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: '#888', marginTop: 2 },
  logoutBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e0e0e0' },
  logoutText: { fontSize: 13, color: '#666', fontWeight: '600' },
  statusCard: { borderRadius: 20, padding: 24, marginBottom: 16 },
  statusCardGreen: { backgroundColor: '#1a3d2b' },
  statusCardRed: { backgroundColor: '#7f1d1d' },
  statusTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotGreen: { backgroundColor: '#4ade80' },
  dotRed: { backgroundColor: '#f87171' },
  statusLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  countdown: { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  countdownSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  cardLabel: { fontSize: 11, fontWeight: '700', color: '#aaa', letterSpacing: 1, marginBottom: 8 },
  tourActivity: { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 2 },
  tourRoute: { fontSize: 14, color: '#888', marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 20, marginBottom: 16 },
  statBox: { alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: '800', color: '#2D6A4F' },
  statLbl: { fontSize: 11, color: '#aaa', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  infoLbl: { fontSize: 13, color: '#aaa' },
  infoVal: { fontSize: 13, fontWeight: '600', color: '#333' },
  portalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e8f5e9' },
  portalLeft: { gap: 2 },
  portalTitle: { fontSize: 14, fontWeight: '700', color: '#2D6A4F' },
  portalSub: { fontSize: 12, color: '#aaa' },
  portalDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4ade80' },
  checkoutBtn: { backgroundColor: '#2D6A4F', padding: 18, borderRadius: 18, alignItems: 'center', marginTop: 4 },
  checkoutBtnRed: { backgroundColor: '#dc2626' },
  checkoutText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  noTourCard: { backgroundColor: '#fff', borderRadius: 20, padding: 32, alignItems: 'center', marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  noTourEmoji: { fontSize: 56, marginBottom: 16 },
  noTourTitle: { fontSize: 22, fontWeight: '800', color: '#111', marginBottom: 8 },
  noTourSub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  startBtn: { backgroundColor: '#2D6A4F', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 16 },
  startBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#aaa', letterSpacing: 0.5, marginBottom: 12, textTransform: 'uppercase' },
  quickLinks: { flexDirection: 'row', gap: 12 },
  quickCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 },
  quickIcon: { fontSize: 28, marginBottom: 8 },
  quickTitle: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 2 },
  quickSub: { fontSize: 12, color: '#aaa' },
});