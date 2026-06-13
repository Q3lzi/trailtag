import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { getToken } from '../lib/storage';
import { router } from 'expo-router';
import { showAlert, showConfirm } from '../lib/alert';
import {
  Mountain, Navigation, Activity, Wind, Flag, User, BookOpen,
  Trash2, Copy, ChevronRight, TrendingUp, MapPin, Clock, ArrowUpRight
} from 'lucide-react-native';

const ACTIVITY_COLORS: Record<string, string> = {
  WANDERN:'#1a3d2b', BERGTOUR:'#0f2027', KLETTERN:'#1a1a2e',
  TRAILRUNNING:'#1a2e1a', MOUNTAINBIKE:'#1f2d1f', RADSPORT:'#162616',
  SKI_SNOWBOARD:'#0d1b2a', SKITOUR:'#0d1b2a', KLETTERSTEIG:'#1a1a2e',
  KANU_KAJAK:'#0d2137', PARAGLIDING:'#0d1f3c', ANDERE:'#1a2e1a',
};
const ACTIVITY_ICONS: Record<string, any> = {
  WANDERN:Mountain, BERGTOUR:Mountain, KLETTERN:Activity, KLETTERSTEIG:Flag,
  TRAILRUNNING:Activity, MOUNTAINBIKE:Navigation, RADSPORT:Navigation,
  SKI_SNOWBOARD:Wind, SKITOUR:Wind, KANU_KAJAK:Navigation, PARAGLIDING:Wind, ANDERE:Mountain,
};
const ACTIVITY_LABELS: Record<string, string> = {
  WANDERN:'Wandern', BERGTOUR:'Bergtour', KLETTERN:'Klettern', TRAILRUNNING:'Trailrunning',
  MOUNTAINBIKE:'Mountainbike', RADSPORT:'Radsport', SKI_SNOWBOARD:'Ski/Snowboard',
  SKITOUR:'Skitour', KLETTERSTEIG:'Klettersteig', KANU_KAJAK:'Kanu/Kajak',
  PARAGLIDING:'Paragliding', ANDERE:'Andere',
};
const STATUS: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  COMPLETED: { label: 'Abgeschlossen', color: '#2c694e', bg: '#f0faf4', dot: '#2c694e' },
  ACTIVE:    { label: 'Aktiv',         color: '#2c694e', bg: '#f0faf4', dot: '#4ade80' },
  ALARM:     { label: 'Alarm',         color: '#dc2626', bg: '#fef2f2', dot: '#dc2626' },
  PLANNED:   { label: 'Geplant',       color: '#747871', bg: '#f3f4f5', dot: '#c3c8bf' },
};

export default function ToursScreen() {
  const [tours, setTours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTours(); }, []);

  async function loadTours() {
    try {
      const token = await getToken();
      const data = await apiFetch('/tours', {}, token ?? undefined);
      setTours(data);
    } catch { }
    finally { setLoading(false); }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }
  function formatDuration(start: string, end: string) {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  }

  const completed = tours.filter(t => t.status === 'COMPLETED').length;
  const totalKm = Math.round(tours.reduce((s, t) => s + (t.distanceKm ?? 0), 0));
  const totalHm = Math.round(tours.reduce((s, t) => s + (t.elevationUp ?? 0), 0));

  if (loading) return (
    <View style={styles.loading}>
      <BookOpen size={32} color="#c3c8bf" strokeWidth={1.5} />
      <Text style={styles.loadingText}>Touren laden...</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <Text style={styles.title}>Archiv</Text>
          <Text style={styles.subtitle}>{tours.length} Touren erfasst</Text>
        </View>
        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{totalKm}</Text>
            <Text style={styles.statLbl}>km total</Text>
          </View>
          <View style={styles.statDiv} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{totalHm}</Text>
            <Text style={styles.statLbl}>hm total</Text>
          </View>
          <View style={styles.statDiv} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{completed}</Text>
            <Text style={styles.statLbl}>abgeschlossen</Text>
          </View>
        </View>
      </View>

      {tours.length === 0 ? (
        <View style={styles.empty}>
          <Mountain size={48} color="#c3c8bf" strokeWidth={1.2} />
          <Text style={styles.emptyTitle}>Noch keine Touren</Text>
          <Text style={styles.emptySub}>Starte deine erste Tour um sie hier zu sehen</Text>
        </View>
      ) : null}

      {/* Tour Liste */}
      <View style={styles.list}>
        {tours.map(tour => {
          const status = STATUS[tour.status] ?? STATUS.PLANNED;
          const actLabel = ACTIVITY_LABELS[tour.activity] ?? tour.activity;
          const ActIcon = ACTIVITY_ICONS[tour.activity] ?? Mountain;
          const heroColor = ACTIVITY_COLORS[tour.activity] ?? '#1a2e1a';

          return (
            <TouchableOpacity
              key={tour.id}
              style={styles.tourCard}
              onPress={() => router.push({ pathname: '/tour-detail', params: { id: tour.id } })}
              activeOpacity={0.85}
            >
              {/* Color bar + header */}
              <View style={[styles.tourHeader, { backgroundColor: heroColor }]}>
                <View style={styles.tourHeaderLeft}>
                  <ActIcon size={18} color="rgba(255,255,255,0.9)" strokeWidth={2} />
                  <Text style={styles.tourActivity}>{actLabel}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                  <View style={[styles.statusDot, { backgroundColor: status.dot }]} />
                  <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                </View>
              </View>

              {/* Body */}
              <View style={styles.tourBody}>
                <View style={styles.tourBodyTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tourName} numberOfLines={1}>
                      {tour.routeName || actLabel}
                    </Text>
                    <Text style={styles.tourDate}>
                      {formatDate(tour.createdAt)}
                      {tour.startedAt && tour.checkedOutAt
                        ? ` · ${formatDuration(tour.startedAt, tour.checkedOutAt)}`
                        : ''}
                    </Text>
                  </View>
                  <ChevronRight size={16} color="#c3c8bf" strokeWidth={2} />
                </View>

                {/* Stats */}
                {(tour.distanceKm || tour.elevationUp || tour.difficulty || tour.parkingLocation) ? (
                  <View style={styles.tourStats}>
                    {tour.distanceKm ? (
                      <View style={styles.tourStatItem}>
                        <Navigation size={11} color="#747871" strokeWidth={2} />
                        <Text style={styles.tourStatTxt}>{tour.distanceKm} km</Text>
                      </View>
                    ) : null}
                    {tour.elevationUp ? (
                      <View style={styles.tourStatItem}>
                        <TrendingUp size={11} color="#747871" strokeWidth={2} />
                        <Text style={styles.tourStatTxt}>{tour.elevationUp} hm</Text>
                      </View>
                    ) : null}
                    {tour.difficulty ? (
                      <View style={styles.tourStatItem}>
                        <Flag size={11} color="#747871" strokeWidth={2} />
                        <Text style={styles.tourStatTxt}>{tour.difficulty}</Text>
                      </View>
                    ) : null}
                    {tour.parkingLocation ? (
                      <View style={styles.tourStatItem}>
                        <MapPin size={11} color="#747871" strokeWidth={2} />
                        <Text style={styles.tourStatTxt} numberOfLines={1}>{tour.parkingLocation}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {/* Actions */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => router.push({
                      pathname: '/create-tour',
                      params: {
                        prefill: JSON.stringify({
                          activity: tour.activity,
                          routeName: tour.routeName,
                          difficulty: tour.difficulty,
                          persons: tour.persons,
                          distanceKm: tour.distanceKm,
                          elevationUp: tour.elevationUp,
                          parkingLocation: tour.parkingLocation,
                          vehicleId: tour.vehicleId,
                        })
                      }
                    })}
                  >
                    <Copy size={13} color="#2c694e" strokeWidth={2} />
                    <Text style={styles.actionBtnTxt}>Wiederverwenden</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnDanger]}
                    onPress={async () => {
                      const confirmed = await showConfirm('Tour wirklich löschen?');
                      if (!confirmed) return;
                      try {
                        const token = await getToken();
                        await apiFetch(`/tours/${tour.id}`, { method: 'DELETE' }, token ?? undefined);
                        setTours(prev => prev.filter(t => t.id !== tour.id));
                      } catch {
                        showAlert('Fehler', 'Tour konnte nicht gelöscht werden.');
                      }
                    }}
                  >
                    <Trash2 size={13} color="#dc2626" strokeWidth={2} />
                    <Text style={[styles.actionBtnTxt, { color: '#dc2626' }]}>Löschen</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa', gap: 12 },
  loadingText: { fontSize: 14, color: '#c3c8bf' },
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { paddingBottom: 110 },

  header: { backgroundColor: '#061907', paddingTop: 56, paddingBottom: 24, paddingHorizontal: 20 },
  headerInner: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 3 },
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: 16 },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  statLbl: { fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: '600', marginTop: 2 },
  statDiv: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.12)' },

  empty: { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#434841' },
  emptySub: { fontSize: 13, color: '#c3c8bf', textAlign: 'center', lineHeight: 18 },

  list: { padding: 16, gap: 10 },
  tourCard: { backgroundColor: '#fff', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#e1e3e4' },

  tourHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  tourHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  tourActivity: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.9)', letterSpacing: 0.3 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },

  tourBody: { padding: 14 },
  tourBodyTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  tourName: { fontSize: 15, fontWeight: '800', color: '#061907', letterSpacing: -0.2 },
  tourDate: { fontSize: 11, color: '#747871', marginTop: 2 },

  tourStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  tourStatItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tourStatTxt: { fontSize: 12, color: '#747871' },

  actionRow: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: '#f3f4f5', paddingTop: 12, marginTop: 4 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 6, backgroundColor: '#f0faf4', borderWidth: 1, borderColor: '#aeeecb' },
  actionBtnDanger: { backgroundColor: '#fff5f5', borderColor: '#fca5a5' },
  actionBtnTxt: { fontSize: 12, fontWeight: '700', color: '#2c694e' },
});
