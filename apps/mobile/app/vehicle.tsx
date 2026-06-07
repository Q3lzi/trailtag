import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Linking } from 'react-native';
import { useState, useEffect } from 'react';
import QRCode from 'react-native-qrcode-svg';
import { apiFetch } from '../lib/api';
import { getToken } from '../lib/storage';
import { showAlert, showConfirm } from '../lib/alert';

export default function VehicleScreen() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [plate, setPlate] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { loadVehicles(); }, []);

  async function loadVehicles() {
    try {
      const token = await getToken();
      const data = await apiFetch('/vehicles', {}, token ?? undefined);
      setVehicles(data);
    } catch (err) { console.log('Kein Fahrzeug'); }
    finally { setLoading(false); }
  }

  async function handleSave() {
    if (!plate || !make || !model) { showAlert('Fehler', 'Kennzeichen, Marke und Modell sind Pflichtfelder.'); return; }
    setSaving(true);
    try {
      const token = await getToken();
      if (editing) {
        const updated = await apiFetch(`/vehicles/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({ plate, make, model, color }),
        }, token ?? undefined);
        setVehicles(vs => vs.map(v => v.id === editing.id ? updated : v));
        setEditing(null);
      } else {
        const data = await apiFetch('/vehicles', {
          method: 'POST',
          body: JSON.stringify({ plate, make, model, color }),
        }, token ?? undefined);
        setVehicles(vs => [...vs, data]);
      }
      setPlate(''); setMake(''); setModel(''); setColor('');
      setShowForm(false);
    } catch (err: any) {
      showAlert('Fehler', err.message);
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    const confirmed = await showConfirm('Fahrzeug löschen?', 'Der QR-Code wird ungültig.');
    if (!confirmed) return;
    try {
      const token = await getToken();
      await apiFetch(`/vehicles/${id}`, { method: 'DELETE' }, token ?? undefined);
      setVehicles(vs => vs.filter(v => v.id !== id));
    } catch (err: any) {
      showAlert('Fehler', err.message);
    }
  }

  function startEdit(v: any) {
    setEditing(v);
    setPlate(v.plate); setMake(v.make); setModel(v.model); setColor(v.color ?? '');
    setShowForm(true);
  }

  function cancelForm() {
    setEditing(null);
    setPlate(''); setMake(''); setModel(''); setColor('');
    setShowForm(false);
  }

  if (loading) return <View style={styles.loading}><Text style={styles.loadingEmoji}>🚗</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Meine Fahrzeuge</Text>
        <Text style={styles.subtitle}>QR-Codes für das Erstretter-Portal</Text>
      </View>

      {/* Fahrzeug Liste */}
      {vehicles.map(v => {
        const qrUrl = `https://trailtag-production.up.railway.app/r/${v.qrToken}`;
        return (
          <View key={v.id} style={styles.section}>
            <View style={styles.vehicleCard}>
              <View style={styles.vehicleHeader}>
                <View style={styles.vehicleIcon}>
                  <Text style={styles.vehicleEmoji}>🚗</Text>
                </View>
                <View style={styles.vehicleInfo}>
                  <Text style={styles.vehicleName}>{v.make} {v.model}</Text>
                  <Text style={styles.vehicleMeta}>{v.plate}{v.color ? ` · ${v.color}` : ''}</Text>
                </View>
                <View style={styles.vehicleActions}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => startEdit(v)}>
                    <Text style={styles.editBtnText}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(v.id)}>
                    <Text style={styles.deleteBtnText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* QR Code */}
              <View style={styles.qrSection}>
                <View style={styles.qrCode}>
                  <QRCode value={qrUrl} size={140} color="#1a2e1a" backgroundColor="#fff" />
                </View>
                <View style={styles.qrInfo}>
                  <Text style={styles.qrLabel}>Erstretter-Portal</Text>
                  <TouchableOpacity onPress={() => Linking.openURL(qrUrl)}>
                    <Text style={styles.qrUrl} numberOfLines={2}>{qrUrl}</Text>
                  </TouchableOpacity>
                  <View style={styles.qrDot} />
                </View>
              </View>

              <Text style={styles.qrHint}>
                📋 Drucke den QR-Code aus und befestige ihn am Fahrzeug.
              </Text>
            </View>
          </View>
        );
      })}

      {/* Formular */}
      {showForm ? (
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.formTitle}>{editing ? '✏️ Fahrzeug bearbeiten' : '➕ Fahrzeug hinzufügen'}</Text>
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
            <TouchableOpacity style={styles.cancelBtn} onPress={cancelForm}>
              <Text style={styles.cancelBtnText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.section}>
          <TouchableOpacity style={styles.addVehicleBtn} onPress={() => setShowForm(true)}>
            <Text style={styles.addVehicleBtnText}>+ Fahrzeug hinzufügen</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.hintCard}>
          <Text style={styles.hintTitle}>💡 QR-Code verwenden</Text>
          <Text style={styles.hintText}>
            Drucke den QR-Code aus, laminiere ihn und befestige ihn gut sichtbar am Fahrzeug. Rettungskräfte können ihn scannen um deinen Status zu sehen.
          </Text>
        </View>
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
  section: { paddingHorizontal: 16, paddingTop: 16 },
  vehicleCard: { backgroundColor: '#fff', borderRadius: 18, padding: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  vehicleHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  vehicleIcon: { width: 48, height: 48, backgroundColor: '#f0faf4', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  vehicleEmoji: { fontSize: 24 },
  vehicleInfo: { flex: 1 },
  vehicleName: { fontSize: 17, fontWeight: '800', color: '#111' },
  vehicleMeta: { fontSize: 13, color: '#aaa', marginTop: 2 },
  vehicleActions: { flexDirection: 'row', gap: 8 },
  editBtn: { width: 38, height: 38, backgroundColor: '#f0faf4', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  editBtnText: { fontSize: 16 },
  deleteBtn: { width: 38, height: 38, backgroundColor: '#fff5f5', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontSize: 16 },
  qrSection: { flexDirection: 'row', gap: 16, alignItems: 'center', marginBottom: 12 },
  qrCode: { padding: 8, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#f0f0f0' },
  qrInfo: { flex: 1 },
  qrLabel: { fontSize: 12, fontWeight: '700', color: '#aaa', letterSpacing: 0.5, marginBottom: 6 },
  qrUrl: { fontSize: 11, color: '#2D6A4F', textDecorationLine: 'underline', lineHeight: 16 },
  qrDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ade80', marginTop: 8 },
  qrHint: { fontSize: 12, color: '#aaa', marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  formTitle: { fontSize: 16, fontWeight: '700', color: '#1a2e1a', marginBottom: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#aaa', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#f8f8f8', borderRadius: 10, padding: 14, fontSize: 15, color: '#222', borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 4 },
  saveBtn: { backgroundColor: '#1a2e1a', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 16 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  cancelBtn: { padding: 14, borderRadius: 16, alignItems: 'center', marginTop: 4 },
  cancelBtnText: { color: '#888', fontWeight: '600', fontSize: 15 },
  addVehicleBtn: { backgroundColor: '#fff', borderRadius: 16, padding: 18, alignItems: 'center', borderWidth: 2, borderColor: '#e8e8e8', borderStyle: 'dashed' },
  addVehicleBtnText: { color: '#2D6A4F', fontWeight: '700', fontSize: 16 },
  hintCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, borderLeftWidth: 4, borderLeftColor: '#2D6A4F' },
  hintTitle: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 8 },
  hintText: { fontSize: 13, color: '#888', lineHeight: 20 },
});