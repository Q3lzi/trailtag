import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { getToken } from '../lib/storage';
import { showAlert } from '../lib/alert';

export default function VehicleScreen() {
  const [vehicle, setVehicle] = useState<any>(null);
  const [plate, setPlate] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadVehicle(); }, []);

  async function loadVehicle() {
    try {
      const token = await getToken();
      const data = await apiFetch('/vehicles', {}, token ?? undefined);
      if (data.length > 0) setVehicle(data[0]);
    } catch (err) { console.log('Kein Fahrzeug'); }
    finally { setLoading(false); }
  }

async function handleSave() {
  if (!plate || !make || !model) { showAlert('Fehler', 'Kennzeichen, Marke und Modell sind Pflichtfelder.'); return; }
  setSaving(true);
  try {
    const token = await getToken();
    const data = await apiFetch('/vehicles', {
      method: 'POST',
      body: JSON.stringify({ plate, make, model, color }),
    }, token ?? undefined);
    setVehicle(data);
  } catch (err: any) {
    showAlert('Fehler', err.message);
  } finally { setSaving(false); }
}

  const qrUrl = vehicle ? `https://trailtag-production.up.railway.app/r/${vehicle.qrToken}` : null;

  if (loading) return <View style={styles.loading}><Text style={styles.loadingEmoji}>🚗</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mein Fahrzeug</Text>
        <Text style={styles.subtitle}>QR-Code für das Erstretter-Portal</Text>
      </View>

      {vehicle ? (
        <>
          {/* Fahrzeug Info */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>FAHRZEUG</Text>
            <View style={styles.vehicleCard}>
              <View style={styles.vehicleIcon}>
                <Text style={styles.vehicleEmoji}>🚗</Text>
              </View>
              <View style={styles.vehicleInfo}>
                <Text style={styles.vehicleName}>{vehicle.make} {vehicle.model}</Text>
                <Text style={styles.vehicleMeta}>{vehicle.plate} · {vehicle.color}</Text>
              </View>
            </View>
          </View>

          {/* QR Code */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>QR-CODE PORTAL</Text>
            <View style={styles.qrCard}>
              <View style={styles.qrTop}>
                <Text style={styles.qrTitle}>🔗 Erstretter-Portal</Text>
                <View style={styles.qrDot} />
              </View>
              <Text style={styles.qrUrl}>{qrUrl}</Text>
              <View style={styles.qrDivider} />
              <Text style={styles.qrHint}>
                Drucke diesen Link als QR-Code aus und klebe ihn ans Auto. Wenn jemand den Code scannt, sieht er sofort deinen Alarm-Status und alle relevanten Informationen für Rettungskräfte.
              </Text>
              {Platform.OS === 'web' && (
  <TouchableOpacity
    style={styles.copyBtn}
    onPress={() => { navigator.clipboard.writeText(qrUrl!); showAlert('✅ Link kopiert!'); }}
  >
    <Text style={styles.copyBtnText}>📋 Link kopieren</Text>
  </TouchableOpacity>
)}
            </View>
          </View>

          {/* QR Generator Hinweis */}
          <View style={styles.section}>
            <View style={styles.hintCard}>
              <Text style={styles.hintTitle}>💡 QR-Code erstellen</Text>
              <Text style={styles.hintText}>
                Gehe auf qr-code-generator.com, füge den Link ein und drucke den QR-Code aus. Laminiere ihn und befestige ihn gut sichtbar am Fahrzeug.
              </Text>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>FAHRZEUG HINZUFÜGEN</Text>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Kennzeichen *</Text>
            <TextInput style={styles.input} placeholder="z.B. SG 123 456" placeholderTextColor="#bbb" value={plate} onChangeText={setPlate} autoCapitalize="characters" />

            <Text style={styles.fieldLabel}>Marke *</Text>
            <TextInput style={styles.input} placeholder="z.B. VW" placeholderTextColor="#bbb" value={make} onChangeText={setMake} />

            <Text style={styles.fieldLabel}>Modell *</Text>
            <TextInput style={styles.input} placeholder="z.B. Golf" placeholderTextColor="#bbb" value={model} onChangeText={setModel} />

            <Text style={styles.fieldLabel}>Farbe</Text>
            <TextInput style={styles.input} placeholder="z.B. Schwarz" placeholderTextColor="#bbb" value={color} onChangeText={setColor} />

            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Speichert...' : 'Fahrzeug speichern'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  section: { paddingHorizontal: 16, paddingTop: 24 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#aaa', letterSpacing: 1, marginBottom: 12 },
  vehicleCard: { backgroundColor: '#fff', borderRadius: 18, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  vehicleIcon: { width: 56, height: 56, backgroundColor: '#f0faf4', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  vehicleEmoji: { fontSize: 28 },
  vehicleInfo: { flex: 1 },
  vehicleName: { fontSize: 20, fontWeight: '800', color: '#111' },
  vehicleMeta: { fontSize: 14, color: '#aaa', marginTop: 2 },
  qrCard: { backgroundColor: '#fff', borderRadius: 18, padding: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  qrTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  qrTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  qrDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4ade80' },
  qrUrl: { fontSize: 12, color: '#2D6A4F', fontFamily: 'monospace', backgroundColor: '#f0faf4', padding: 12, borderRadius: 10, marginBottom: 16 },
  qrDivider: { height: 1, backgroundColor: '#f0f0f0', marginBottom: 16 },
  qrHint: { fontSize: 14, color: '#888', lineHeight: 20 },
  copyBtn: { marginTop: 16, backgroundColor: '#f0faf4', padding: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#d1fae5' },
  copyBtnText: { color: '#2D6A4F', fontWeight: '700', fontSize: 14 },
  hintCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, borderLeftWidth: 4, borderLeftColor: '#2D6A4F' },
  hintTitle: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 8 },
  hintText: { fontSize: 13, color: '#888', lineHeight: 20 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#aaa', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#f8f8f8', borderRadius: 10, padding: 14, fontSize: 15, color: '#222', borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 4 },
  saveBtn: { backgroundColor: '#1a2e1a', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 16 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});