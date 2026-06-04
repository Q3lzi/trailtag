import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiFetch } from '../lib/api';

async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem('token');
  return await SecureStore.getItemAsync('token');
}

const ACTIVITY_LABELS: Record<string, { emoji: string; name: string }> = {
  WANDERN: { emoji: '🥾', name: 'Wandern' }, BERGTOUR: { emoji: '🏔️', name: 'Bergtour' },
  KLETTERN: { emoji: '🧗', name: 'Klettern' }, TRAILRUNNING: { emoji: '🏃', name: 'Trailrunning' },
  MOUNTAINBIKE: { emoji: '🚵', name: 'Mountainbike' }, RADSPORT: { emoji: '🚴', name: 'Radsport' },
  SKI_SNOWBOARD: { emoji: '🎿', name: 'Ski/Snowboard' }, SKITOUR: { emoji: '⛷️', name: 'Skitour' },
  KLETTERSTEIG: { emoji: '🪝', name: 'Klettersteig' }, KANU_KAJAK: { emoji: '🛶', name: 'Kanu/Kajak' },
  PARAGLIDING: { emoji: '🪂', name: 'Paragliding' }, ANDERE: { emoji: '🏕️', name: 'Andere' }
};

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  COMPLETED: { label: 'Abgeschlossen', color: '#2D6A4F', bg: '#f0faf4' },
  ACTIVE: { label: 'Aktiv', color: '#2D6A4F', bg: '#f0faf4' },
  ALARM: { label: 'Alarm', color: '#dc2626', bg: '#fef2f2' },
  PLANNED: { label: 'Geplant', color: '#888', bg: '#f8f8f8' },
};

export default function ToursScreen() {
  const [tours, setTours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { loadTours(); }, []);

  async function loadTours() {
    try {
      const token = await getToken();
      const data = await apiFetch('/tours', {}, token ?? undefined);
      setTours(data);
    } catch (err) { console.log('Fehler'); }
    finally { setLoading(false); }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatDuration(start: string, end: string) {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  }

  const completed = tours.filter(t => t.status === 'COMPLETED').length;
  const alarm = tours.filter(t => t.status === 'ALARM').length;
  const totalKm = Math.round(tours.reduce((s, t) => s + (t.distanceKm ?? 0), 0));
  const totalHm = Math.round(tours.reduce((s, t) => s + (t.elevationUp ?? 0), 0));

  if (loading) return <View style={styles.loading}><Text style={styles.loadingEmoji}>📋</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Meine Touren</Text>
        <Text style={styles.subtitle}>{tours.length} Touren · {totalKm} km</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{tours.length}</Text>
          <Text style={styles.statLbl}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{completed}</Text>
          <Text style={styles.statLbl}>Abgeschlossen</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, alarm > 0 && { color: '#dc2626' }]}>{alarm}</Text>
          <Text style={styles.statLbl}>Alarm</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{totalHm}</Text>
          <Text style={styles.statLbl}>hm total</Text>
        </View>
      </View>

      {tours.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🏔️</Text>
          <Text style={styles.emptyText}>Noch keine Touren</Text>
        </View>
      )}

      {/* Tour Liste */}
      <View style={styles.list}>
        {tours.map(tour => {
          const isExpanded = expanded === tour.id;
          const status = STATUS[tour.status] ?? STATUS.PLANNED;
          const act = ACTIVITY_LABELS[tour.activity] ?? { emoji: '🏕️', name: tour.activity };

          return (
            <TouchableOpacity
              key={tour.id}
              style={styles.tourCard}
              onPress={() => setExpanded(isExpanded ? null : tour.id)}
              activeOpacity={0.7}
            >
              <View style={styles.tourTop}>
                <View style={styles.tourLeft}>
                  <View style={styles.tourEmojiBox}>
                    <Text style={styles.tourEmoji}>{act.emoji}</Text>
                  </View>
                  <View>
                    <Text style={styles.tourName}>{act.name}</Text>
                    {tour.routeName && <Text style={styles.tourRoute}>{tour.routeName}</Text>}
                  </View>
                </View>
                <View style={styles.tourRight}>
                  <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                  <Text style={styles.tourDate}>{formatDate(tour.createdAt)}</Text>
                </View>
              </View>

              {/* Stats */}
              <View style={styles.tourStats}>
                {tour.distanceKm && <Text style={styles.tourStat}>📏 {tour.distanceKm} km</Text>}
                {tour.elevationUp && <Text style={styles.tourStat}>⬆️ {tour.elevationUp} hm</Text>}
                {tour.difficulty && <Text style={styles.tourStat}>🎯 {tour.difficulty}</Text>}
                {tour.persons > 1 && <Text style={styles.tourStat}>👥 {tour.persons}</Text>}
              </View>

              {/* Details */}
              {isExpanded && (
                <View style={styles.tourDetails}>
                  <View style={styles.divider} />
                  {tour.startedAt && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLbl}>Gestartet</Text>
                      <Text style={styles.detailVal}>{formatDate(tour.startedAt)} {new Date(tour.startedAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                  )}
                  {tour.checkedOutAt && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLbl}>Zurück</Text>
                      <Text style={styles.detailVal}>{formatDate(tour.checkedOutAt)} {new Date(tour.checkedOutAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                  )}
                  {tour.startedAt && tour.checkedOutAt && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLbl}>Dauer</Text>
                      <Text style={styles.detailVal}>{formatDuration(tour.startedAt, tour.checkedOutAt)}</Text>
                    </View>
                  )}
                  {tour.parkingLocation && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLbl}>Parkplatz</Text>
                      <Text style={styles.detailVal}>{tour.parkingLocation}</Text>
                    </View>
                  )}
                  {tour.notes && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLbl}>Notizen</Text>
                      <Text style={styles.detailVal}>{tour.notes}</Text>
                    </View>
                  )}
                </View>
              )}

              <Text style={styles.expandHint}>{isExpanded ? '▲' : '▼'}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingEmoji: { fontSize: 48 },
  container: { flex: 1, backgroundColor: '#f8faf8' },
  content: { paddingBottom: 100 },
  header: { backgroundColor: '#1a2e1a', paddingTop: 56, paddingBottom: 28, paddingHorizontal: 24 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 8, padding: 16 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  statNum: { fontSize: 22, fontWeight: '800', color: '#111' },
  statLbl: { fontSize: 10, color: '#aaa', marginTop: 2, fontWeight: '600' },
  empty: { alignItems: 'center', padding: 48 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#999' },
  list: { paddingHorizontal: 16, gap: 8 },
  tourCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  tourTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  tourLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  tourEmojiBox: { width: 44, height: 44, backgroundColor: '#f8f8f8', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tourEmoji: { fontSize: 22 },
  tourName: { fontSize: 16, fontWeight: '700', color: '#111' },
  tourRoute: { fontSize: 12, color: '#aaa', marginTop: 2 },
  tourRight: { alignItems: 'flex-end', gap: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  statusText: { fontSize: 11, fontWeight: '700' },
  tourDate: { fontSize: 11, color: '#ccc' },
  tourStats: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  tourStat: { fontSize: 13, color: '#666' },
  tourDetails: { marginTop: 4 },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  detailLbl: { fontSize: 13, color: '#aaa' },
  detailVal: { fontSize: 13, fontWeight: '600', color: '#333', flex: 1, textAlign: 'right' },
  expandHint: { textAlign: 'center', color: '#ddd', fontSize: 12, marginTop: 12 },
});