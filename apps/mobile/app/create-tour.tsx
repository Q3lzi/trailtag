import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform, ScrollView } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { apiFetch } from '../lib/api';

async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem('token');
  return await SecureStore.getItemAsync('token');
}

export default function CreateTourScreen() {
  const [activity, setActivity] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [elevationUp, setElevationUp] = useState('');
  const [etaHours, setEtaHours] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    if (!activity || !etaHours) {
      Alert.alert('Fehler', 'Aktivität und Dauer sind Pflichtfelder.');
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();

      // Tour erstellen
      const tour = await apiFetch('/tours', {
        method: 'POST',
        body: JSON.stringify({
          activity,
          distanceKm: distanceKm ? parseFloat(distanceKm) : null,
          elevationUp: elevationUp ? parseInt(elevationUp) : null,
        }),
      }, token ?? undefined);

      // ETA berechnen (jetzt + Stunden)
      const eta = new Date(Date.now() + parseFloat(etaHours) * 60 * 60 * 1000).toISOString();

      // Tour starten
      await apiFetch(`/tours/${tour.id}/start`, {
        method: 'POST',
        body: JSON.stringify({ eta }),
      }, token ?? undefined);

      Alert.alert('🏔️ Tour gestartet!', `Du hast ${etaHours}h Zeit. Viel Erfolg!`);
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

      <Text style={styles.label}>Aktivität *</Text>
      <TextInput
        style={styles.input}
        placeholder="z.B. Wanderung Säntis"
        value={activity}
        onChangeText={setActivity}
      />

      <Text style={styles.label}>Geplante Dauer (Stunden) *</Text>
      <TextInput
        style={styles.input}
        placeholder="z.B. 4"
        value={etaHours}
        onChangeText={setEtaHours}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Distanz (km)</Text>
      <TextInput
        style={styles.input}
        placeholder="z.B. 12"
        value={distanceKm}
        onChangeText={setDistanceKm}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Höhenmeter</Text>
      <TextInput
        style={styles.input}
        placeholder="z.B. 800"
        value={elevationUp}
        onChangeText={setElevationUp}
        keyboardType="numeric"
      />

      <TouchableOpacity style={styles.button} onPress={handleStart} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Startet...' : '🏔️ Tour starten'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 32 },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 16, marginBottom: 20, fontSize: 16 },
  button: { backgroundColor: '#2D6A4F', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});