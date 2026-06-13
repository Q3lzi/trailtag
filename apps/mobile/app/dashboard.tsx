import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { apiFetch } from '../lib/api';
import { showAlert, showConfirm } from '../lib/alert';
import { getToken, removeToken } from '../lib/storage';
import { cancelAllNotifications } from '../lib/notifications';
import { stopLocationTracking } from '../lib/tracking';

function useCountdown(eta: string | null) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isOverdue, setIsOverdue] = useState(false);
  useEffect(() => {
    if (!eta) return;
    const interval = setInterval(() => {
      const diff = new Date(eta).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Überfällig!'); setIsOverdue(true); return; }
      setIsOverdue(false);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [eta]);
  return { timeLeft, isOverdue };
}

const ACTIVITY_LABELS: Record<string, { label: string; emoji: string }> = {
  WANDERN: { label: 'Wandern', emoji: '🥾' },
  BERGTOUR: { label: 'Bergtour', emoji: '🏔️' },
  KLETTERN: { label: 'Klettern', emoji: '🧗' },
  TRAILRUNNING: { label: 'Trailrunning', emoji: '🏃' },
  MOUNTAINBIKE: { label: 'Mountainbike', emoji: '🚵' },
  RADSPORT: { label: 'Radsport', emoji: '🚴' },
  SKI_SNOWBOARD: { label: 'Ski/Snowboard', emoji: '🎿' },
  SKITOUR: { label: 'Skitour', emoji: '⛷️' },
  KLETTERSTEIG: { label: 'Klettersteig', emoji: '🪝' },
  KANU_KAJAK: { label: 'Kanu/Kajak', emoji: '🛶' },
  PARAGLIDING: { label: 'Paragliding', emoji: '🪂' },
  ANDERE: { label: 'Andere', emoji: '🏕️' },
};

export default function DashboardScreen() {
  const [activeTour, setActiveTour] = useState<any>(null);
  const [vehicle, setVehicle] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { timeLeft, isOverdue } = useCountdown(activeTour?.eta ?? null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const token = await getToken();
      const [tours, vehicles, profile] = await Promise.all([
        apiFetch('/tours', {}, token ?? undefined),
        apiFetch('/vehicles', {}, token ?? undefined),
        apiFetch('/profile', {}, token ?? undefined),
      ]);
      const active = tours.find((t: any) => t.status === 'ACTIVE' || t.status === 'ALARM');
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
      await stopLocationTracking();
      await cancelAllNotifications();
      setActiveTour(null);
    } catch (err: any) {
      showAlert('Fehler', err.message);
    }
  }

  async function handleLogout() {
    await removeToken();
    router.replace('/');
  }

  const qrUrl = vehicle ? `https://trailtag-production.up.railway.app/r/${vehicle.qrToken}` : null;
  const firstName = user?.name?.split(' ')[0] ?? '';
  const activity = activeTour ? (ACTIVITY_LABELS[activeTour.activity] ?? { label: activeTour.activity, emoji: '🏕️' }) : null;

  if (loading) return (
    <View style={styles.loading}>
      <Text style={{ fontSize: 48 }}>🏔️</Text>
    </View>
  );

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
          <View style={[styles.statusBanner, isOverdue ? styles.statusBannerRed : styles.statusBannerGreen]}>
            <View style={styles.statusBannerLeft}>
              <View style={[styles.statusDot, isOverdue ? styles.dotRed : styles.dotGreen]} />
              <Text style={styles.statusLabel}>{isOverdue ? 'ALARM — ÜBERFÄLLIG' : 'TOUR AKTIV'}</Text>
            </View>
            <Text style={styles.statusSync}>
              {activeTour.locationUpdatedAt
                ? `📡 ${Math.floor((Date.now() - new Date(activeTour.locationUpdatedAt).getTime()) / 60000)} Min.`
                : '📡 Kein Signal'}
            </Text>
          </View>

          {/* Countdown Hero */}
          <View style={[styles.countdownHero, isOverdue ? styles.countdownHeroRed : styles.countdownHeroGreen]}>
            <Text style={styles.countdownLabel}>
              {isOverdue ? '🚨 ÜBERFÄLLIG SEIT' : '⏱️ VERBLEIBENDE ZEIT'}
            </Text>
            <Text style={styles.countdownTime}>{timeLeft}</Text>
            <Text style={styles.countdownSub}>
              Rückkehr geplant: {new Date(activeTour.eta).toLocaleString('de-CH', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
            </Text>
            <TouchableOpacity
              style={[styles.checkoutBtn, isOverdue && styles.checkoutBtnRed]}
              onPress={handleCheckout}
            >
              <Text style={styles.checkoutText}>✅ Ich bin sicher zurück</Text>
            </TouchableOpacity>
          </View>

          {/* Tour Info Card */}
          <TouchableOpacity
            style={styles.tourCard}
            onPress={() => router.push(`/tour-detail?id=${activeTour.id}`)}
            activeOpacity={0.7}
          >
            <Text style={styles.cardLabel}>AKTIVE TOUR</Text>
            <View style={styles.tourCardTop}>
              <Text style={styles.tourEmoji}>{activity?.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.tourName}>{activity?.label}</Text>
                {activeTour.routeName && <Text style={styles.tourRoute}>{activeTour.routeName}</Text>}
              </View>
              <Text style={styles.tourArrow}>→</Text>
            </View>

            {(activeTour.distanceKm || activeTour.elevationUp || activeTour.difficulty) && (
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
              </View>
            )}

            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLbl}>⏰ Gestartet</Text>
              <Text style={styles.infoVal}>{new Date(activeTour.startedAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
            {activeTour.parkingLocation && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLbl}>🚗 Parkplatz</Text>
                <Text style={styles.infoVal}>{activeTour.parkingLocation}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Rescue Portal */}
          {qrUrl && (
            <TouchableOpacity
              style={styles.portalCard}
              onPress={() => Platform.OS === 'web' ? window.open(qrUrl!, '_blank') : Linking.openURL(qrUrl!)}
              activeOpacity={0.7}
            >
              <View style={styles.portalIcon}>
                <Text style={{ fontSize: 24 }}>🔗</Text>
              </View>
              <View style={styles.portalContent}>
                <Text style={styles.portalTitle}>Erstretter-Portal</Text>
                <Text style={styles.portalSub}>QR-Code am Fahrzeug scannen für Notfallinfos</Text>
              </View>
              <Text style={styles.portalArrow}>→</Text>
            </TouchableOpacity>
          )}
        </>
      ) : (
        <>
          {/* Keine Tour */}
          <View style={styles.noTourCard}>
            <Text style={styles.noTourEmoji}>🏔️</Text>
            <Text style={styles.noTourTitle}>Keine aktive Tour</Text>
            <Text style={styles.noTourSub}>Aktiviere den Safety-Timer bevor du losgehst</Text>
            <TouchableOpacity style={styles.startBtn} onPress={() => router.push('/create-tour')}>
              <Text style={styles.startBtnText}>Tour starten</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Links */}
          <Text style={styles.sectionTitle}>SCHNELLZUGRIFF</Text>
          <View style={styles.quickGrid}>
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
            <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/profile')}>
              <Text style={styles.quickIcon}>👤</Text>
              <Text style={styles.quickTitle}>Profil</Text>
              <Text style={styles.quickSub}>Notfallinfos</Text>
            </TouchableOpacity>
          </View>

          {/* Rescue Portal auch ohne aktive Tour */}
          {qrUrl && (
            <TouchableOpacity
              style={[styles.portalCard, { marginTop: 8 }]}
              onPress={() => Platform.OS === 'web' ? window.open(qrUrl!, '_blank') : Linking.openURL(qrUrl!)}
            >
              <View style={styles.portalIcon}>
                <Text style={{ fontSize: 24 }}>🔗</Text>
              </View>
              <View style={styles.portalContent}>
                <Text style={styles.portalTitle}>Erstretter-Portal</Text>
                <Text style={styles.portalSub}>{vehicle?.plate} · {vehicle?.make} {vehicle?.model}</Text>
              </View>
              <Text style={styles.portalArrow}>→</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8faf8' },
  container: { flex: 1, backgroundColor: '#f8faf8' },
  content: { paddingTop: 56, paddingBottom: 100, paddingHorizontal: 20 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greeting: { fontSize: 26, fontWeight: '800', color: '#111', letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: '#888', marginTop: 2 },
  logoutBtn: { paddingVertical: 6, paddingHorizontal: 14, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e0e0e0' },
  logoutText: { fontSize: 13, color: '#666', fontWeight: '600' },

  statusBanner: { borderRadius: 14, padding: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBannerGreen: { backgroundColor: '#d1fae5' },
  statusBannerRed: { backgroundColor: '#fee2e2' },
  statusBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotGreen: { backgroundColor: '#10b981' },
  dotRed: { backgroundColor: '#ef4444' },
  statusLabel: { fontSize: 12, fontWeight: '700', color: '#374151', letterSpacing: 0.5 },
  statusSync: { fontSize: 11, color: '#6b7280', fontWeight: '600' },

  countdownHero: { borderRadius: 24, padding: 28, marginBottom: 12, alignItems: 'center' },
  countdownHeroGreen: { backgroundColor: '#1a3d2b' },
  countdownHeroRed: { backgroundColor: '#7f1d1d' },
  countdownLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 1, marginBottom: 8 },
  countdownTime: { fontSize: 52, fontWeight: '900', color: '#fff', letterSpacing: -2, marginBottom: 8 },
  countdownSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 20 },
  checkoutBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 16, width: '100%', alignItems: 'center' },
  checkoutBtnRed: { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.4)' },
  checkoutText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  tourCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  cardLabel: { fontSize: 11, fontWeight: '700', color: '#aaa', letterSpacing: 1, marginBottom: 12 },
  tourCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  tourEmoji: { fontSize: 32 },
  tourName: { fontSize: 18, fontWeight: '800', color: '#111' },
  tourRoute: { fontSize: 13, color: '#888', marginTop: 2 },
  tourArrow: { fontSize: 20, color: '#2D6A4F', fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 24, marginBottom: 16 },
  statBox: { alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '800', color: '#2D6A4F' },
  statLbl: { fontSize: 11, color: '#aaa', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  infoLbl: { fontSize: 13, color: '#aaa' },
  infoVal: { fontSize: 13, fontWeight: '600', color: '#333' },

  portalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderColor: '#fecaca' },
  portalIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#fff5f5', alignItems: 'center', justifyContent: 'center' },
  portalContent: { flex: 1 },
  portalTitle: { fontSize: 15, fontWeight: '700', color: '#dc2626' },
  portalSub: { fontSize: 12, color: '#aaa', marginTop: 2 },
  portalArrow: { fontSize: 18, color: '#dc2626', fontWeight: '700' },

  noTourCard: { backgroundColor: '#fff', borderRadius: 24, padding: 36, alignItems: 'center', marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  noTourEmoji: { fontSize: 64, marginBottom: 16 },
  noTourTitle: { fontSize: 22, fontWeight: '800', color: '#111', marginBottom: 8 },
  noTourSub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  startBtn: { backgroundColor: '#1a2e1a', paddingVertical: 16, paddingHorizontal: 36, borderRadius: 16 },
  startBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#aaa', letterSpacing: 1, marginBottom: 12 },
  quickGrid: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  quickCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  quickIcon: { fontSize: 28, marginBottom: 8 },
  quickTitle: { fontSize: 13, fontWeight: '700', color: '#111', marginBottom: 2 },
  quickSub: { fontSize: 11, color: '#aaa' },
});