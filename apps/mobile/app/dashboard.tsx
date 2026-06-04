import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { apiFetch } from '../lib/api';

async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem('token');
  return await SecureStore.getItemAsync('token');
}

function useCountdown(eta: string | null) {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    if (!eta) return;
    const interval = setInterval(() => {
      const diff = new Date(eta).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('⚠️ Überfällig!'); return; }
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
  const [loading, setLoading] = useState(true);
  const timeLeft = useCountdown(activeTour?.eta ?? null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const token = await getToken();
      const [tours, vehicles] = await Promise.all([
        apiFetch('/tours', {}, token ?? undefined),
        apiFetch('/vehicles', {}, token ?? undefined),
      ]);
      const active = tours.find((t: any) => t.status === 'ACTIVE');
      setActiveTour(active ?? null);
      if (vehicles.length > 0) setVehicle(vehicles[0]);
    } catch (err) {
      console.log('Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckout() {
    const confirmed = window.confirm('Bist du sicher zurück?');
    if (!confirmed) return;
    try {
      const token = await getToken();
      await apiFetch(`/tours/${activeTour.id}/checkout`, { method: 'POST' }, token ?? undefined);
      setActiveTour(null);
    } catch (err: any) {
      window.alert('Fehler: ' + err.message);
    }
  }

  async function handleLogout() {
    if (Platform.OS === 'web') localStorage.removeItem('token');
    else await SecureStore.deleteItemAsync('token');
    router.replace('/');
  }

  const isOverdue = activeTour?.eta && new Date(activeTour.eta).getTime() < Date.now();
  const qrUrl = vehicle ? `https://trailtag-production.up.railway.app/r/${vehicle.qrToken}` : null;

  if (loading) {
    return <View style={styles.container}><Text>Lädt...</Text></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🏔️ Trailtag</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <TouchableOpacity onPress={() => router.push('/profile')}>
            <Text style={styles.profileLink}>👤</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={styles.logout}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTour ? (
        <View>
          <View style={[styles.statusBanner, isOverdue ? styles.statusRed : styles.statusGreen]}>
            <Text style={styles.statusText}>{isOverdue ? '⚠️ Tour überfällig!' : '🟢 Tour aktiv'}</Text>
            <Text style={styles.countdown}>{timeLeft}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{ACTIVITY_LABELS[activeTour.activity] ?? activeTour.activity}</Text>
            {activeTour.routeName && <Text style={styles.routeName}>{activeTour.routeName}</Text>}

            <View style={styles.statsRow}>
              {activeTour.distanceKm && <View style={styles.stat}><Text style={styles.statValue}>{activeTour.distanceKm}</Text><Text style={styles.statLabel}>km</Text></View>}
              {activeTour.elevationUp && <View style={styles.stat}><Text style={styles.statValue}>{activeTour.elevationUp}</Text><Text style={styles.statLabel}>hm ⬆️</Text></View>}
              {activeTour.persons > 1 && <View style={styles.stat}><Text style={styles.statValue}>{activeTour.persons}</Text><Text style={styles.statLabel}>Personen</Text></View>}
              {activeTour.difficulty && <View style={styles.stat}><Text style={styles.statValue}>{activeTour.difficulty}</Text><Text style={styles.statLabel}>SAC</Text></View>}
            </View>

            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Gestartet</Text>
              <Text style={styles.infoValue}>{new Date(activeTour.startedAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Geplante Rückkehr</Text>
              <Text style={styles.infoValue}>{new Date(activeTour.eta).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
            {activeTour.parkingLocation && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Parkplatz</Text>
                <Text style={styles.infoValue}>{activeTour.parkingLocation}</Text>
              </View>
            )}
          </View>

          {qrUrl && (
            <View style={styles.qrCard}>
              <Text style={styles.qrText}>🔗 Erstretter-Portal aktiv</Text>
              <Text style={styles.qrSub}>{qrUrl}</Text>
            </View>
          )}

          <TouchableOpacity style={[styles.checkoutBtn, isOverdue && styles.checkoutBtnRed]} onPress={handleCheckout}>
            <Text style={styles.checkoutText}>✅ Ich bin zurück</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <View style={styles.noTourCard}>
            <Text style={styles.noTourEmoji}>🏔️</Text>
            <Text style={styles.noTourTitle}>Keine aktive Tour</Text>
            <Text style={styles.noTourSub}>Starte eine Tour um den Safety-Timer zu aktivieren</Text>
            <TouchableOpacity style={styles.startBtn} onPress={() => router.push('/create-tour')}>
              <Text style={styles.startBtnText}>+ Tour starten</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.vehicleCard} onPress={() => router.push('/vehicle')}>
            <Text style={styles.vehicleText}>{vehicle ? `🚗 ${vehicle.make} ${vehicle.model} · ${vehicle.plate}` : '🚗 Fahrzeug hinzufügen'}</Text>
            <Text style={styles.vehicleArrow}>›</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 60, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: 'bold' },
  logout: { color: '#999', fontSize: 14 },
  profileLink: { fontSize: 22 },
  statusBanner: { borderRadius: 16, padding: 20, marginBottom: 16, alignItems: 'center' },
  statusGreen: { backgroundColor: '#2D6A4F' },
  statusRed: { backgroundColor: '#C53030' },
  statusText: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  countdown: { color: '#fff', fontSize: 28, fontWeight: '800' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  routeName: { fontSize: 14, color: '#666', marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: '#2D6A4F' },
  statLabel: { fontSize: 11, color: '#999', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  infoLabel: { fontSize: 13, color: '#999' },
  infoValue: { fontSize: 13, fontWeight: '600', color: '#333' },
  qrCard: { backgroundColor: '#EBF5FB', borderRadius: 12, padding: 16, marginBottom: 16 },
  qrText: { fontSize: 14, fontWeight: '700', color: '#1A5276', marginBottom: 4 },
  qrSub: { fontSize: 11, color: '#2980B9' },
  checkoutBtn: { backgroundColor: '#2D6A4F', padding: 18, borderRadius: 16, alignItems: 'center' },
  checkoutBtnRed: { backgroundColor: '#C53030' },
  checkoutText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  noTourCard: { backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center', marginBottom: 16 },
  noTourEmoji: { fontSize: 48, marginBottom: 12 },
  noTourTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  noTourSub: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  startBtn: { backgroundColor: '#2D6A4F', padding: 16, borderRadius: 12, alignItems: 'center', width: '100%' },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  vehicleCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vehicleText: { fontSize: 14, fontWeight: '600', color: '#333' },
  vehicleArrow: { fontSize: 20, color: '#999' },
});