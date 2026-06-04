import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiFetch } from '../lib/api';

async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem('token');
  return await SecureStore.getItemAsync('token');
}

const ACTIVITY_LABELS: Record<string, string> = {
  WANDERN: '🥾 Wandern', BERGTOUR: '🏔️ Bergtour', KLETTERN: '🧗 Klettern',
  TRAILRUNNING: '🏃 Trailrunning', MOUNTAINBIKE: '🚵 Mountainbike',
  RADSPORT: '🚴 Radsport', SKI_SNOWBOARD: '🎿 Ski/Snowboard',
  SKITOUR: '⛷️ Skitour', KLETTERSTEIG: '🪝 Klettersteig',
  KANU_KAJAK: '🛶 Kanu/Kajak', PARAGLIDING: '🪂 Paragliding', ANDERE: '🏕️ Andere'
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  COMPLETED: { label: '✅ Abgeschlossen', color: '#2D6A4F' },
  ACTIVE: { label: '🟢 Aktiv', color: '#2D6A4F' },
  ALARM: { label: '🚨 Alarm', color: '#C53030' },
  PLANNED: { label: '📅 Geplant', color: '#666' },
};

export default function ToursScreen() {
  const [tours, setTours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    loadTours();
  }, []);

  async function loadTours() {
    try {
      const token = await getToken();
      const data = await apiFetch('/tours', {}, token ?? undefined);
      setTours(data);
    } catch (err) {
      console.log('Fehler beim Laden');
    } finally {
      setLoading(false);
    }
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

  if (loading) return <View style={styles.container}><Text>Lädt...</Text></View>;

  const completed = tours.filter(t => t.status === 'COMPLETED');
  const active = tours.filter(t => t.status === 'ACTIVE');
  const alarm = tours.filter(t => t.status === 'ALARM');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>📋 Meine Touren</Text>

      {/* Statistiken */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{tours.length}</Text>
          <Text style={styles.statLbl}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{completed.length}</Text>
          <Text style={styles.statLbl}>Abgeschlossen</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: '#C53030' }]}>{alarm.length}</Text>
          <Text style={styles.statLbl}>Alarm</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>
            {Math.round(tours.reduce((sum, t) => sum + (t.distanceKm ?? 0), 0))}
          </Text>
          <Text style={styles.statLbl}>km total</Text>
        </View>
      </View>

      {tours.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>🏔️</Text>
          <Text style={styles.emptyText}>Noch keine Touren</Text>
        </View>
      )}

      {tours.map(tour => {
        const isExpanded = expanded === tour.id;
        const status = STATUS_LABELS[tour.status] ?? { label: tour.status, color: '#666' };

        return (
          <TouchableOpacity
            key={tour.id}
            style={styles.tourCard}
            onPress={() => setExpanded(isExpanded ? null : tour.id)}
          >
            {/* Header */}
            <View style={styles.tourHeader}>
              <View style={styles.tourHeaderLeft}>
                <Text style={styles.tourActivity}>
                  {ACTIVITY_LABELS[tour.activity] ?? tour.activity}
                </Text>
                {tour.routeName && <Text style={styles.tourRoute}>{tour.routeName}</Text>}
              </View>
              <View style={styles.tourHeaderRight}>
                <Text style={[styles.tourStatus, { color: status.color }]}>{status.label}</Text>
                <Text style={styles.tourDate}>{formatDate(tour.createdAt)}</Text>
              </View>
            </View>

            {/* Kurzinfos */}
            <View style={styles.tourStats}>
              {tour.distanceKm && <Text style={styles.tourStat}>📏 {tour.distanceKm} km</Text>}
              {tour.elevationUp && <Text style={styles.tourStat}>⬆️ {tour.elevationUp} hm</Text>}
              {tour.difficulty && <Text style={styles.tourStat}>🎯 {tour.difficulty}</Text>}
              {tour.persons > 1 && <Text style={styles.tourStat}>👥 {tour.persons}</Text>}
            </View>

            {/* Erweiterte Details */}
            {isExpanded && (
              <View style={styles.tourDetails}>
                <View style={styles.divider} />
                {tour.startedAt && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Gestartet</Text>
                    <Text style={styles.detailValue}>{formatDate(tour.startedAt)} {new Date(tour.startedAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                )}
                {tour.checkedOutAt && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Zurück</Text>
                    <Text style={styles.detailValue}>{formatDate(tour.checkedOutAt)} {new Date(tour.checkedOutAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                )}
                {tour.startedAt && tour.checkedOutAt && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Dauer</Text>
                    <Text style={styles.detailValue}>{formatDuration(tour.startedAt, tour.checkedOutAt)}</Text>
                  </View>
                )}
                {tour.parkingLocation && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Parkplatz</Text>
                    <Text style={styles.detailValue}>{tour.parkingLocation}</Text>
                  </View>
                )}
                {tour.notes && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Notizen</Text>
                    <Text style={styles.detailValue}>{tour.notes}</Text>
                  </View>
                )}
              </View>
            )}

            <Text style={styles.expandHint}>{isExpanded ? '▲ weniger' : '▼ mehr'}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 60, paddingBottom: 60 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 24 },
  statsCard: { backgroundColor: '#2D6A4F', borderRadius: 16, padding: 20, flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24 },
  statItem: { alignItems: 'center' },
  statNum: { fontSize: 24, fontWeight: '800', color: '#fff' },
  statLbl: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  emptyCard: { alignItems: 'center', padding: 48 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#999' },
  tourCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  tourHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  tourHeaderLeft: { flex: 1 },
  tourHeaderRight: { alignItems: 'flex-end' },
  tourActivity: { fontSize: 16, fontWeight: '700' },
  tourRoute: { fontSize: 13, color: '#666', marginTop: 2 },
  tourStatus: { fontSize: 12, fontWeight: '600' },
  tourDate: { fontSize: 11, color: '#999', marginTop: 2 },
  tourStats: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  tourStat: { fontSize: 13, color: '#555' },
  tourDetails: { marginTop: 8 },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  detailLabel: { fontSize: 13, color: '#999' },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#333', flex: 1, textAlign: 'right' },
  expandHint: { fontSize: 11, color: '#ccc', textAlign: 'center', marginTop: 12 },
});