import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { getToken } from '../lib/storage';
import { showAlert, showConfirm } from '../lib/alert';

export default function VehicleScreen() {
  const [vehicle, setVehicle] = useState<any>(null);
  const [plate, setPlate] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => { loadVehicle(); }, []);

  async function loadVehicle() {
    try {
      const token = await getToken();
      const data = await apiFetch('/vehicles', {}, token ?? undefined);
      if (data.length > 0) {
        setVehicle(data[0]);
        setPlate(data[0].plate);
        setMake(data[0].make);
        setModel(data[0].model);
        setColor(data[0].color ?? '');
      }
    } catch (err) { console.log('Kein Fahrzeug'); }
    finally { setLoading(false); }
  }

  async function handleSave() {
    if (!plate || !make || !model) { showAlert('Fehler', 'Kennzeichen, Marke und Modell sind Pflichtfelder.'); return; }
    setSaving(true);
    try {
      const token = await getToken();
      if (vehicle && editing) {
        const updated = await apiFetch(`/vehicles/${vehicle.id}`, {
          method: 'PUT',
          body: JSON.stringify({ plate, make, model, color }),
        }, token ?? undefined);
        setVehicle(updated);
        setEditing(false);
      } else {
        const data = await apiFetch('/vehicles', {
          method: 'POST',
          body: JSON.stringify({ plate, make, model, color }),
        }, token ?? undefined);
        setVehicle(data);
        setPlate(data.plate); setMake(data.make); setModel(data.model); setColor(data.color ?? '');
      }
    } catch (err: any) {
      showAlert('Fehler', err.message);
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    const confirmed = await showConfirm('Fahrzeug löschen?', 'Der QR-Code wird ungültig.');
    if (!confirmed) return;
    try {
      const token = await getToken();
      await apiFetch(`/vehicles/${vehicle.id}`, { method: 'DELETE' }, token ?? undefined);
      setVehicle(null);
      setPlate(''); setMake(''); setModel(''); setColor('');
      setEditing(false);
    } catch (err: any) {
      showAlert('Fehler', err.message);
    }
  }

  function startEdit() {
    setPlate(vehicle.plate);
    setMake(vehicle.make);
    setModel(vehicle.model);
    setColor(vehicle.color ?? '');
    setEditing(true);
  }

  const qrUrl = vehicle ? `https://trailtag-production.up.railway.app/r/${vehicle.qrToken}` : null;

  if (loading) return <View style={styles.loading}><Text style={styles.loadingEmoji}>🚗</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Mein Fahrzeug</Text>
        <Text style={styles.subtitle}>QR-Code für das Erstretter-Portal</Text>
      </View>

      {vehicle && !editing ? (
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
                <Text style={styles.vehicleMeta}>{vehicle.plate}{vehicle.color ? ` · ${vehicle.color}` : ''}</Text>
              </View>
              <View style={styles.vehicleActions}>
                <TouchableOpacity style={styles.editBtn} onPress={startEdit}>
                  <Text style={styles.editBtnText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                  <Text style={styles.deleteBtnText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* QR Link */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ERSTRETTER-PORTAL LINK</Text>
            <View style={styles.qrCard}>
              <View style={styles.qrTop}>
                <Text style={styles.qrTitle}>🔗 Portal-Link</Text>
                <View style={styles.qrDot} />
              </View>
              <Text style={styles.qrUrl}>{qrUrl}</Text>
              <View style={styles.qrDivider} />
              <Text style={styles.qrHint}>
                Erstelle mit diesem Link einen QR-Code auf qr-code-generator.com und befestige ihn am Fahrzeug.
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.hintCard}>
              <Text style={styles.hintTitle}>💡 QR-Code erstellen</Text>
              <Text style={styles.hintText}>
                Gehe auf qr-code-generator.com, füge den Link ein, drucke den QR-Code aus, laminiere ihn und befestige ihn gut sichtbar am Fahrzeug.
              </Text>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{editing ? 'FAHRZEUG BEARBEITEN' : 'FAHRZEUG HINZUFÜGEN'}</Text>
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
              <Text style={styles.saveBtnText}>{saving ? 'Speichert...' : editing ? 'Änderungen speichern' : 'Fahrzeug speichern'}</Text>
            </TouchableOpacity>

            {editing && (
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                <Text style={styles.cancelBtnText}>Abbrechen</Text>
              </TouchableOpacity>
            )}
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
  vehicleCard: { backgroundColor: '#fff', borderRadius: 18, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  vehicleIcon: { width: 56, height: 56, backgroundColor: '#f0faf4', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  vehicleEmoji: { fontSize: 28 },
  vehicleInfo: { flex: 1 },
  vehicleName: { fontSize: 18, fontWeight: '800', color: '#111' },
  vehicleMeta: { fontSize: 13, color: '#aaa', marginTop: 2 },
  vehicleActions: { flexDirection: 'row', gap: 8 },
  editBtn: { width: 40, height: 40, backgroundColor: '#f0faf4', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  editBtnText: { fontSize: 18 },
  deleteBtn: { width: 40, height: 40, backgroundColor: '#fff5f5', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontSize: 18 },
  qrCard: { backgroundColor: '#fff', borderRadius: 18, padding: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  qrTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  qrTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  qrDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4ade80' },
  qrUrl: { fontSize: 12, color: '#2D6A4F', backgroundColor: '#f0faf4', padding: 12, borderRadius: 10, marginBottom: 16 },
  qrDivider: { height: 1, backgroundColor: '#f0f0f0', marginBottom: 16 },
  qrHint: { fontSize: 14, color: '#888', lineHeight: 20 },
  hintCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, borderLeftWidth: 4, borderLeftColor: '#2D6A4F' },
  hintTitle: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 8 },
  hintText: { fontSize: 13, color: '#888', lineHeight: 20 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#aaa', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#f8f8f8', borderRadius: 10, padding: 14, fontSize: 15, color: '#222', borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 4 },
  saveBtn: { backgroundColor: '#1a2e1a', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 16 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  cancelBtn: { padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 8 },
  cancelBtnText: { color: '#888', fontWeight: '600', fontSize: 15 },
});