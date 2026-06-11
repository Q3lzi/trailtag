import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { apiFetch } from '../lib/api';
import { getToken } from '../lib/storage';
import { showAlert } from '../lib/alert';
import { scheduleOverdueNotification } from '../lib/notifications';
import GpxMap from '../components/GpxMap';
import ElevationChart from '../components/ElevationChart';
import { startLocationTracking } from '../lib/tracking';
import * as DocumentPicker from 'expo-document-picker';

const ACTIVITIES = [
  { key: 'WANDERN', label: '🥾', name: 'Wandern' },
  { key: 'BERGTOUR', label: '🏔️', name: 'Bergtour' },
  { key: 'KLETTERN', label: '🧗', name: 'Klettern' },
  { key: 'TRAILRUNNING', label: '🏃', name: 'Trail' },
  { key: 'MOUNTAINBIKE', label: '🚵', name: 'MTB' },
  { key: 'RADSPORT', label: '🚴', name: 'Rad' },
  { key: 'SKI_SNOWBOARD', label: '🎿', name: 'Ski' },
  { key: 'SKITOUR', label: '⛷️', name: 'Skitour' },
  { key: 'KLETTERSTEIG', label: '🪝', name: 'Steig' },
  { key: 'KANU_KAJAK', label: '🛶', name: 'Kanu' },
  { key: 'PARAGLIDING', label: '🪂', name: 'Gliding' },
  { key: 'ANDERE', label: '🏕️', name: 'Andere' },
];

const DIFFICULTIES = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];

export default function CreateTourScreen() {
  const [activity, setActivity] = useState('');
  const [routeName, setRouteName] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [persons, setPersons] = useState('1');
  const [distanceKm, setDistanceKm] = useState('');
  const [elevationUp, setElevationUp] = useState('');
  const [etaTime, setEtaTime] = useState('');
  const [parkingLocation, setParkingLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'ok' | 'denied'>('idle');
  const [gpxData, setGpxData] = useState<any>(null);
  const [gpxLoading, setGpxLoading] = useState(false);
  const [gpxFileContent, setGpxFileContent] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);

  useEffect(() => {
    async function loadVehicles() {
      try {
        const token = await getToken();
        const data = await apiFetch('/vehicles', {}, token ?? undefined);
        setVehicles(data);
        if (data.length > 0) setVehicleId(data[0].id);
      } catch (err) { console.log('Kein Fahrzeug'); }
    }
    loadVehicles();
  }, []);

  async function handleGetLocation() {
    if (Platform.OS === 'web') {
      setLocationStatus('loading');
      navigator.geolocation.getCurrentPosition(
        (pos) => { setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocationStatus('ok'); },
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

async function handleGpxUpload(event?: any) {
  if (Platform.OS === 'web') {
    const file = event.target.files[0];
    if (!file) return;
    setGpxLoading(true);
    try {
      const text = await file.text();
      setGpxFileContent(text);
      const token = await getToken();
      const data = await apiFetch('/gpx/parse', { method: 'POST', body: JSON.stringify({ gpxContent: text }) }, token ?? undefined);
      setGpxData(data);
      if (data.distanceKm) setDistanceKm(String(data.distanceKm));
      if (data.elevationUp) setElevationUp(String(data.elevationUp));
      if (data.startLat) { setLocation({ lat: data.startLat, lng: data.startLng }); setLocationStatus('ok'); }
    } catch (err: any) {
      showAlert('Fehler', 'GPX-Datei konnte nicht gelesen werden.');
    } finally { setGpxLoading(false); }
  } else {
    // iOS/Android — Document Picker
    setGpxLoading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled) { setGpxLoading(false); return; }
      const file = result.assets[0];
      const response = await fetch(file.uri);
      const text = await response.text();
      setGpxFileContent(text);
      const token = await getToken();
      const data = await apiFetch('/gpx/parse', { method: 'POST', body: JSON.stringify({ gpxContent: text }) }, token ?? undefined);
      setGpxData(data);
      if (data.distanceKm) setDistanceKm(String(data.distanceKm));
      if (data.elevationUp) setElevationUp(String(data.elevationUp));
      if (data.startLat) { setLocation({ lat: data.startLat, lng: data.startLng }); setLocationStatus('ok'); }
    } catch (err: any) {
      showAlert('Fehler', 'GPX-Datei konnte nicht gelesen werden.');
    } finally { setGpxLoading(false); }
  }
}

  async function handleStart() {
    if (!activity) { showAlert('Fehler', 'Bitte Aktivität wählen.'); return; }
    if (!etaTime) { showAlert('Fehler', 'Bitte Rückkehrzeit eingeben.'); return; }
    if (!etaTime.includes(':')) { showAlert('Fehler', 'Format: HH:MM (z.B. 17:30)'); return; }
    setLoading(true);
    try {
      const token = await getToken();
      const [hoursStr, minsStr] = etaTime.split(':');
      const etaDate = new Date();
      etaDate.setHours(parseInt(hoursStr), parseInt(minsStr ?? '0'), 0, 0);
      if (etaDate.getTime() < Date.now()) etaDate.setDate(etaDate.getDate() + 1);
      const eta = etaDate.toISOString();
      const tour = await apiFetch('/tours', {
        method: 'POST',
        body: JSON.stringify({
          activity, routeName: routeName || null, difficulty: difficulty || null,
          persons: parseInt(persons), distanceKm: distanceKm ? parseFloat(distanceKm) : null,
          elevationUp: elevationUp ? parseInt(elevationUp) : null,
          parkingLocation: parkingLocation || null, notes: notes || null,
          startLat: location?.lat ?? null, startLng: location?.lng ?? null,
          vehicleId: vehicleId ?? null,
        }),
      }, token ?? undefined);
await apiFetch(`/tours/${tour.id}/start`, { method: 'POST', body: JSON.stringify({ eta }) }, token ?? undefined);

// GPX anhängen falls vorhanden
if (gpxData && gpxFileContent) {
  await apiFetch(`/gpx/attach/${tour.id}`, {
    method: 'POST',
    body: JSON.stringify({ gpxContent: gpxFileContent }),
  }, token ?? undefined);
}

await startLocationTracking(tour.id);
await scheduleOverdueNotification(etaDate);
router.replace('/dashboard');
} catch (err: any) {
  showAlert('Fehler', err.message);
} finally { setLoading(false); }

}

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Tour starten</Text>
        <Text style={styles.subtitle}>Aktiviere deinen Safety-Timer</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>AKTIVITÄT</Text>
        <View style={styles.activityGrid}>
          {ACTIVITIES.map(a => (
            <TouchableOpacity key={a.key} style={[styles.activityCard, activity === a.key && styles.activityCardActive]} onPress={() => setActivity(a.key)}>
              <Text style={styles.activityEmoji}>{a.label}</Text>
              <Text style={[styles.activityName, activity === a.key && styles.activityNameActive]}>{a.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>GEPLANTE RÜCKKEHR</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Uhrzeit der Rückkehr</Text>
<TextInput
  style={styles.input}
  placeholder="z.B. 1730 → 17:30"
  placeholderTextColor="#bbb"
  value={etaTime}
  onChangeText={(text) => {
    const digits = text.replace(/\D/g, '');
    if (digits.length <= 2) {
      setEtaTime(digits);
    } else if (digits.length <= 4) {
      setEtaTime(`${digits.slice(0, 2)}:${digits.slice(2)}`);
    }
  }}
  keyboardType="number-pad"
  maxLength={5}
/>
          <Text style={styles.etaHint}>⏱️ Der Safety-Timer läuft bis zu dieser Uhrzeit heute.</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>GRUNDINFORMATIONEN</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Routenname</Text>
          <TextInput style={styles.input} placeholder="z.B. Säntis via Schwägalp" placeholderTextColor="#bbb" value={routeName} onChangeText={setRouteName} />
          <Text style={styles.fieldLabel}>Personen</Text>
          <View style={styles.counterRow}>
            <TouchableOpacity style={styles.counterBtn} onPress={() => setPersons(p => String(Math.max(1, parseInt(p) - 1)))}>
              <Text style={styles.counterBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.counterVal}>{persons}</Text>
            <TouchableOpacity style={styles.counterBtn} onPress={() => setPersons(p => String(parseInt(p) + 1))}>
              <Text style={styles.counterBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>SCHWIERIGKEIT (SAC)</Text>
        <View style={styles.chipRow}>
          {DIFFICULTIES.map(d => (
            <TouchableOpacity key={d} style={[styles.chip, difficulty === d && styles.chipActive]} onPress={() => setDifficulty(d === difficulty ? '' : d)}>
              <Text style={[styles.chipText, difficulty === d && styles.chipTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {vehicles.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>FAHRZEUG</Text>
          <View style={styles.chipRow}>
            {vehicles.map(v => (
              <TouchableOpacity key={v.id} style={[styles.chip, vehicleId === v.id && styles.chipActive]} onPress={() => setVehicleId(v.id)}>
                <Text style={[styles.chipText, vehicleId === v.id && styles.chipTextActive]}>🚗 {v.make} {v.model}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.chip, vehicleId === null && styles.chipActive]} onPress={() => setVehicleId(null)}>
              <Text style={[styles.chipText, vehicleId === null && styles.chipTextActive]}>Kein Fahrzeug</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}


{/* GPX Upload */}
<View style={styles.section}>
  <Text style={styles.sectionLabel}>GPS-ROUTE (OPTIONAL)</Text>
  {Platform.OS === 'web' ? (
    <View style={styles.gpxZone}>
      <Text style={styles.gpxIcon}>🗺️</Text>
      <Text style={styles.gpxTitle}>{gpxLoading ? '⏳ Analysiere...' : 'GPX Datei wählen'}</Text>
      <Text style={styles.gpxSub}>Distanz + Höhenmeter automatisch · max. 5 MB</Text>
      <input type="file" accept=".gpx" style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer' } as any} onChange={handleGpxUpload} />
      {gpxData && (
        <View style={styles.gpxBadge}>
          <Text style={styles.gpxBadgeText}>✅ {gpxData.distanceKm} km · ⬆️ {gpxData.elevationUp} hm · {gpxData.points?.length} Punkte</Text>
        </View>
      )}
    </View>
  ) : (
    <TouchableOpacity style={[styles.gpxZone, gpxData && styles.gpxZoneDone]} onPress={() => handleGpxUpload()}>
      <Text style={styles.gpxIcon}>{gpxLoading ? '⏳' : gpxData ? '✅' : '🗺️'}</Text>
      <Text style={styles.gpxTitle}>
        {gpxLoading ? 'Analysiere...' : gpxData ? `${gpxData.distanceKm} km · ⬆️ ${gpxData.elevationUp} hm` : 'GPX Datei laden'}
      </Text>
      <Text style={styles.gpxSub}>{gpxData ? `${gpxData.points?.length} Punkte` : 'Aus Dateien öffnen'}</Text>
    </TouchableOpacity>
  )}
  {gpxData?.points?.length > 0 && Platform.OS === 'web' && (
    <View style={{ marginTop: 8 }}>
      <GpxMap points={gpxData.points} />
      <ElevationChart points={gpxData.points} />
    </View>
  )}
</View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>STARTPUNKT</Text>
        <TouchableOpacity style={[styles.gpsBtn, locationStatus === 'ok' && styles.gpsBtnOk]} onPress={handleGetLocation}>
          <Text style={styles.gpsBtnText}>
            {locationStatus === 'idle' && '📍 Standort ermitteln'}
            {locationStatus === 'loading' && '⏳ Ermittle...'}
            {locationStatus === 'ok' && `✅ ${location?.lat.toFixed(4)}, ${location?.lng.toFixed(4)}`}
            {locationStatus === 'denied' && '❌ Kein Zugriff'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>DETAILS (OPTIONAL)</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Distanz (km)</Text>
          <TextInput style={styles.input} placeholder="z.B. 12" placeholderTextColor="#bbb" value={distanceKm} onChangeText={setDistanceKm} keyboardType="numeric" />
          <Text style={styles.fieldLabel}>Höhenmeter</Text>
          <TextInput style={styles.input} placeholder="z.B. 800" placeholderTextColor="#bbb" value={elevationUp} onChangeText={setElevationUp} keyboardType="numeric" />
          <Text style={styles.fieldLabel}>Parkplatz / Startort</Text>
          <TextInput style={styles.input} placeholder="z.B. Wanderparkplatz Schwägalp" placeholderTextColor="#bbb" value={parkingLocation} onChangeText={setParkingLocation} />
          <Text style={styles.fieldLabel}>Notizen für Rettungskräfte</Text>
          <TextInput style={[styles.input, styles.textArea]} placeholder="z.B. Roter Rucksack, Hund dabei" placeholderTextColor="#bbb" value={notes} onChangeText={setNotes} multiline numberOfLines={3} />
        </View>
      </View>

      <TouchableOpacity style={[styles.startBtn, loading && styles.startBtnDisabled]} onPress={handleStart} disabled={loading}>
        <Text style={styles.startBtnText}>{loading ? 'Startet...' : 'Safety-Timer aktivieren'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faf8' },
  content: { paddingBottom: 100 },
  header: { backgroundColor: '#1a2e1a', paddingTop: 56, paddingBottom: 28, paddingHorizontal: 24 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  section: { paddingHorizontal: 24, paddingTop: 24 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#aaa', letterSpacing: 1, marginBottom: 12 },
  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  activityCard: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 12, width: 70, borderWidth: 1.5, borderColor: '#f0f0f0' },
  activityCardActive: { borderColor: '#2D6A4F', backgroundColor: '#f0faf4' },
  activityEmoji: { fontSize: 24, marginBottom: 4 },
  activityName: { fontSize: 11, color: '#888', fontWeight: '600' },
  activityNameActive: { color: '#2D6A4F' },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 100, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e8e8e8' },
  chipActive: { backgroundColor: '#1a2e1a', borderColor: '#1a2e1a' },
  chipText: { fontSize: 14, color: '#555', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#aaa', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  input: { backgroundColor: '#f8f8f8', borderRadius: 10, padding: 14, fontSize: 15, color: '#222', marginBottom: 8, borderWidth: 1, borderColor: '#f0f0f0' },
  etaHint: { fontSize: 12, color: '#aaa', marginTop: 4 },
  textArea: { height: 80, textAlignVertical: 'top' },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  counterBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a2e1a', alignItems: 'center', justifyContent: 'center' },
  counterBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  counterVal: { fontSize: 20, fontWeight: '800', color: '#111', minWidth: 24, textAlign: 'center' },
  gpxZone: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 2, borderColor: '#e8e8e8', borderStyle: 'dashed', position: 'relative', overflow: 'hidden' },
  gpxIcon: { fontSize: 32, marginBottom: 8 },
  gpxTitle: { fontSize: 15, fontWeight: '700', color: '#333' },
  gpxSub: { fontSize: 12, color: '#aaa', marginTop: 4 },
  gpxBadge: { marginTop: 12, backgroundColor: '#f0faf4', borderRadius: 8, padding: 10, width: '100%' },
  gpxBadgeText: { fontSize: 13, color: '#2D6A4F', fontWeight: '600', textAlign: 'center' },
  gpsBtn: { backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1.5, borderColor: '#e8e8e8' },
  gpsBtnOk: { borderColor: '#2D6A4F', backgroundColor: '#f0faf4' },
  gpsBtnText: { fontSize: 15, fontWeight: '600', color: '#444' },
  startBtn: { margin: 24, backgroundColor: '#2D6A4F', padding: 20, borderRadius: 18, alignItems: 'center' },
  startBtnDisabled: { opacity: 0.6 },
  startBtnText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  gpxZoneDone: { borderColor: '#2D6A4F', backgroundColor: '#f0faf4' },
});