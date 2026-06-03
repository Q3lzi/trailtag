import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { apiFetch } from '../lib/api';

async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem('token');
  return await SecureStore.getItemAsync('token');
}

export default function DashboardScreen() {
  const [activeTour, setActiveTour] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActiveTour();
  }, []);

  async function loadActiveTour() {
    try {
      const token = await getToken();
      const tours = await apiFetch('/tours', {}, token ?? undefined);
      const active = tours.find((t: any) => t.status === 'ACTIVE');
      setActiveTour(active ?? null);
    } catch (err) {
      console.log('Keine Touren gefunden');
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckout() {
    try {
      const token = await getToken();
      await apiFetch(`/tours/${activeTour.id}/checkout`, { method: 'POST' }, token ?? undefined);
      Alert.alert('✅ Tour abgeschlossen!', 'Du bist sicher zurück.');
      setActiveTour(null);
    } catch (err: any) {
      Alert.alert('Fehler', err.message);
    }
  }

  async function handleLogout() {
    if (Platform.OS === 'web') {
      localStorage.removeItem('token');
    } else {
      await SecureStore.deleteItemAsync('token');
    }
    router.replace('/');
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Lädt...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🏔️ Trailtag</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logout}>Logout</Text>
        </TouchableOpacity>
      </View>

      {activeTour ? (
        <View style={styles.activeTourCard}>
          <Text style={styles.activeLabel}>🟢 Tour aktiv</Text>
          <Text style={styles.tourInfo}>{activeTour.activity}</Text>
          <Text style={styles.tourInfo}>ETA: {new Date(activeTour.eta).toLocaleTimeString()}</Text>
          <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout}>
            <Text style={styles.buttonText}>✅ Ich bin zurück</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.noTourCard}>
          <Text style={styles.noTourText}>Keine aktive Tour</Text>
          <TouchableOpacity style={styles.startButton} onPress={() => router.push('/create-tour')}>
            <Text style={styles.buttonText}>+ Tour starten</Text>
          </TouchableOpacity>
        </View>
      )}
      <TouchableOpacity style={styles.vehicleLink} onPress={() => router.push('/vehicle')}>
  <Text style={styles.vehicleLinkText}>🚗 Fahrzeug verwalten</Text>
</TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 28, fontWeight: 'bold' },
  logout: { color: '#999', fontSize: 14 },
  activeTourCard: { backgroundColor: '#D8F3DC', borderRadius: 16, padding: 24, gap: 8 },
  activeLabel: { fontSize: 18, fontWeight: 'bold', color: '#2D6A4F' },
  tourInfo: { fontSize: 16, color: '#333' },
  checkoutButton: { backgroundColor: '#2D6A4F', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  noTourCard: { backgroundColor: '#f5f5f5', borderRadius: 16, padding: 24, alignItems: 'center', gap: 16 },
  noTourText: { fontSize: 16, color: '#666' },
  startButton: { backgroundColor: '#2D6A4F', padding: 16, borderRadius: 12, alignItems: 'center', width: '100%' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  vehicleLink: { marginTop: 24, alignItems: 'center' },
vehicleLinkText: { color: '#2D6A4F', fontSize: 14, fontWeight: '600' },
});