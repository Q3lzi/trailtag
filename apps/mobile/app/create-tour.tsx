import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform, ScrollView } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { apiFetch } from '../lib/api';

async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem('token');
  return await SecureStore.getItemAsync('token');
}

const ACTIVITIES = [
  { key: 'WANDERN', label: '🥾 Wandern' },
  { key: 'BERGTOUR', label: '🏔️ Bergtour' },
  { key: 'KLETTERN', label: '🧗 Klettern' },
  { key: 'TRAILRUNNING', label: '🏃 Trailrunning' },
  { key: 'MOUNTAINBIKE', label: '🚵 Mountainbike' },
  { key: 'RADSPORT', label: '🚴 Radsport' },
  { key: 'SKI_SNOWBOARD', label: '🎿 Ski/Snowboard' },
  { key: 'SKITOUR', label: '⛷️ Skitour' },
  { key: 'KLETTERSTEIG', label: '🪝 Klettersteig' },
  { key: 'KANU_KAJAK', label: '🛶 Kanu/Kajak' },
  { key: 'PARAGLIDING', label: '🪂 Paragliding' },
  { key: 'ANDERE', label: '🏕️ Andere' },
];

const DIFFICULTIES = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
const QUICK_HOURS = ['2', '4', '6', '8', '10', '12'];

export default function CreateTourScreen() {
  const [activity, setActivity] = useState('');
  const [routeName, setRouteName] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [persons, setPersons] = useState('1');
  const [distanceKm, setDistanceKm] = useState('');
  const [elevationUp, setElevationUp] = useState('');
  const [etaHours, setEtaHours] = useState('');
  const [parkingLocation, setParkingLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'ok' | 'denied'>('idle');

  async function getLocation() {
    if (Platform.OS === 'web') {
      setLocationStatus('loading');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationStatus('ok');
        },
        () => setLocationStatus('denied')
      );
      return;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { setLocationStatus('denied'); return; }

    setLocationStatus('loading');
    const pos = await Location.getCurrentPositionAsync({});
    setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    setLocationStatus('ok');
  }

  async function handleStart() {
    if (!activity) { Alert.alert('Fehler', 'Bitte Aktivität wählen.'); return; }
    if (!etaHours) { Alert.alert('Fehler', 'Bitte geplante Dauer eingeben.'); return; }

    setLoading(true);
    try {
      const token = await getToken();
      const eta = new Date(Date.now() + parseFloat(etaHours) * 60 * 60 * 1000).toISOString();

      const tour = await apiFetch('/tours', {
        method: 'POST',
        body: JSON.stringify({
          activity,
          routeName: routeName || null,
          difficulty: difficulty || null,
          persons: parseInt(persons),
          distanceKm: distanceKm ? parseFloat(distanceKm) : null,
          elevationUp: elevationUp ? parseInt(elevationUp) : null,
          parkingLocation: parkingLocation || null,
          notes: notes || null,
          startLat: location?.lat ?? null,
          startLng: location?.lng ?? null,
        }),
      }, token ?? undefined);

      await apiFetch(`/tours/${tour.id}/start`, {
        method: 'POST',
        body: JSON.stringify({ eta }),
      }, token ?? undefined);

      Alert.alert('🏔️ Tour gestartet!', `Geplante Rückkehr in ${etaHours}h. Viel Erfolg!`);
      router.replace('/dashboard');
    } catch (err: any) {
      Alert.alert('Fehler', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Tour starten</Text>

      {/* Aktivität */}
      <Text style={styles.sectionTitle}>① Aktivität wählen</Text>
      <View style={styles.grid}>
        {ACTIVITIES.map(a => (
          <TouchableOpacity
            key={a.key}
            style={[styles.activityBtn, activity === a.key && styles.activityBtnActive]}
            onPress={() => setActivity(a.key)}
          >
            <Text style={[styles.activityText, activity === a.key && styles.activityTextActive]}>
              {a.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Grundinfos */}
      <Text style={styles.sectionTitle}>② Grundinformationen</Text>
      <Text style={styles.label}>Routenname</Text>
      <TextInput style={styles.input} placeholder="z.B. Säntis via Schwägalp" value={routeName} onChangeText={setRouteName} />

      <Text style={styles.label}>Anzahl Personen</Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.counterBtn} onPress={() => setPersons(p => String(Math.max(1, parseInt(p) - 1)))}>
          <Text style={styles.counterText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.counterValue}>{persons}</Text>
        <TouchableOpacity style={styles.counterBtn} onPress={() => setPersons(p => String(parseInt(p) + 1))}>
          <Text style={styles.counterText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Zeit */}
      <Text style={styles.sectionTitle}>③ Geplante Dauer</Text>
      <View style={styles.quickRow}>
        {QUICK_HOURS.map(h => (
          <TouchableOpacity
            key={h}
            style={[styles.quickBtn, etaHours === h && styles.quickBtnActive]}
            onPress={() => setEtaHours(h)}
          >
            <Text style={[styles.quickText, etaHours === h && styles.quickTextActive]}>+{h}h</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Schwierigkeit */}
      <Text style={styles.sectionTitle}>④ Schwierigkeit (SAC)</Text>
      <View style={styles.quickRow}>
        {DIFFICULTIES.map(d => (
          <TouchableOpacity
            key={d}
            style={[styles.quickBtn, difficulty === d && styles.quickBtnActive]}
            onPress={() => setDifficulty(d)}
          >
            <Text style={[styles.quickText, difficulty === d && styles.quickTextActive]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* GPS */}
      <Text style={styles.sectionTitle}>⑤ Startpunkt (GPS)</Text>
      <TouchableOpacity style={styles.gpsBtn} onPress={getLocation}>
        <Text style={styles.gpsBtnText}>
          {locationStatus === 'idle' && '📍 Standort ermitteln'}
          {locationStatus === 'loading' && '⏳ Ermittle Standort...'}
          {locationStatus === 'ok' && `✅ ${location?.lat.toFixed(4)}, ${location?.lng.toFixed(4)}`}
          {locationStatus === 'denied' && '❌ Zugriff verweigert'}
        </Text>
      </TouchableOpacity>

      {/* Details */}
      <Text style={styles.sectionTitle}>⑥ Details (optional)</Text>
      <Text style={styles.label}>Distanz (km)</Text>
      <TextInput style={styles.input} placeholder="z.B. 12" value={distanceKm} onChangeText={setDistanceKm} keyboardType="numeric" />

      <Text style={styles.label}>Höhenmeter</Text>
      <TextInput style={styles.input} placeholder="z.B. 800" value={elevationUp} onChangeText={setElevationUp} keyboardType="numeric" />

      <Text style={styles.label}>Parkplatz / Startort</Text>
      <TextInput style={styles.input} placeholder="z.B. Wanderparkplatz Schwägalp" value={parkingLocation} onChangeText={setParkingLocation} />

      <Text style={styles.label}>Notizen für Rettungskräfte</Text>
      <TextInput style={[styles.input, styles.textArea]} placeholder="z.B. Roter Rucksack, Hund dabei" value={notes} onChangeText={setNotes} multiline numberOfLines={3} />

      <TouchableOpacity style={styles.button} onPress={handleStart} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Startet...' : '🏔️ Tour starten'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 60, paddingBottom: 60 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#2D6A4F', marginTop: 24, marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 16, marginBottom: 16, fontSize: 16 },
  textArea: { height: 80, textAlignVertical: 'top' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  activityBtn: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#f9f9f9' },
  activityBtnActive: { borderColor: '#2D6A4F', backgroundColor: '#D8F3DC' },
  activityText: { fontSize: 13, color: '#444' },
  activityTextActive: { color: '#2D6A4F', fontWeight: '700' },
  quickRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  quickBtn: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  quickBtnActive: { borderColor: '#2D6A4F', backgroundColor: '#2D6A4F' },
  quickText: { fontSize: 14, color: '#444' },
  quickTextActive: { color: '#fff', fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  counterBtn: { backgroundColor: '#2D6A4F', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  counterText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  counterValue: { fontSize: 20, fontWeight: 'bold', minWidth: 30, textAlign: 'center' },
  gpsBtn: { borderWidth: 1, borderColor: '#2D6A4F', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 8 },
  gpsBtnText: { color: '#2D6A4F', fontWeight: '600', fontSize: 15 },
  button: { backgroundColor: '#2D6A4F', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});