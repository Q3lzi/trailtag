import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiFetch } from '../lib/api';

async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem('token');
  return await SecureStore.getItemAsync('token');
}

export default function VehicleScreen() {
  const [vehicle, setVehicle] = useState<any>(null);
  const [plate, setPlate] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadVehicle();
  }, []);

  async function loadVehicle() {
    try {
      const token = await getToken();
      const data = await apiFetch('/vehicles', {}, token ?? undefined);
      if (data.length > 0) setVehicle(data[0]);
    } catch (err) {
      console.log('Kein Fahrzeug gefunden');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!plate || !make || !model) {
      Alert.alert('Fehler', 'Kennzeichen, Marke und Modell sind Pflichtfelder.');
      return;
    }
    setSaving(true);
    try {
      const token = await getToken();
      const data = await apiFetch('/vehicles', {
        method: 'POST',
        body: JSON.stringify({ plate, make, model, color }),
      }, token ?? undefined);
      setVehicle(data);
      Alert.alert('✅ Fahrzeug gespeichert!');
    } catch (err: any) {
      Alert.alert('Fehler', err.message);
    } finally {
      setSaving(false);
    }
  }

  const qrUrl = vehicle
    ? `https://trailtag-production.up.railway.app/r/${vehicle.qrToken}`
    : null;

  if (loading) {
    return <View style={styles.container}><Text>Lädt...</Text></View>;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>🚗 Fahrzeug</Text>

      {vehicle ? (
        <View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{vehicle.make} {vehicle.model}</Text>
            <Text style={styles.cardSub}>{vehicle.plate} · {vehicle.color}</Text>
          </View>

          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>🔗 QR-Code Link</Text>
            <Text style={styles.qrUrl}>{qrUrl}</Text>
            <Text style={styles.qrHint}>
              Diesen Link als QR-Code ausdrucken und ans Auto kleben.
              Wenn jemand den Code scannt, sieht er sofort deinen Alarm-Status.
            </Text>
          </View>
        </View>
      ) : (
        <View>
          <Text style={styles.label}>Kennzeichen *</Text>
          <TextInput style={styles.input} placeholder="z.B. SG 123 456" value={plate} onChangeText={setPlate} autoCapitalize="characters" />

          <Text style={styles.label}>Marke *</Text>
          <TextInput style={styles.input} placeholder="z.B. VW" value={make} onChangeText={setMake} />

          <Text style={styles.label}>Modell *</Text>
          <TextInput style={styles.input} placeholder="z.B. Golf" value={model} onChangeText={setModel} />

          <Text style={styles.label}>Farbe</Text>
          <TextInput style={styles.input} placeholder="z.B. Schwarz" value={color} onChangeText={setColor} />

          <TouchableOpacity style={styles.button} onPress={handleSave} disabled={saving}>
            <Text style={styles.buttonText}>{saving ? 'Speichert...' : '💾 Fahrzeug speichern'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 32 },
  card: { backgroundColor: '#f5f5f5', borderRadius: 16, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 20, fontWeight: 'bold' },
  cardSub: { fontSize: 14, color: '#666', marginTop: 4 },
  qrCard: { backgroundColor: '#EBF5FB', borderRadius: 16, padding: 20, gap: 12 },
  qrTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A5276' },
  qrUrl: { fontSize: 13, color: '#2980B9', fontFamily: 'monospace' },
  qrHint: { fontSize: 14, color: '#555', lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 16, marginBottom: 20, fontSize: 16 },
  button: { backgroundColor: '#2D6A4F', padding: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});