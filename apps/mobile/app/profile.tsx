import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { getToken } from '../lib/storage';
import { showAlert, showConfirm } from '../lib/alert';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'];

export default function ProfileScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medications, setMedications] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRelation, setNewRelation] = useState('');
  const [addingContact, setAddingContact] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    try {
      const token = await getToken();
      const data = await apiFetch('/profile', {}, token ?? undefined);
      setProfile(data);
      setName(data.name ?? ''); setPhone(data.phone ?? '');
      setBirthYear(data.birthYear ? String(data.birthYear) : '');
      setBloodType(data.bloodType ?? ''); setAllergies(data.allergies ?? '');
      setMedications(data.medications ?? ''); setMedicalNotes(data.medicalNotes ?? '');
    } catch (err) { console.log('Fehler'); }
    finally { setLoading(false); }
  }

  async function handleSave() {
  setSaving(true);
  try {
    const token = await getToken();
    await apiFetch('/profile', {
      method: 'PUT',
      body: JSON.stringify({ name, phone, birthYear: birthYear ? parseInt(birthYear) : null, bloodType, allergies, medications, medicalNotes }),
    }, token ?? undefined);
    showAlert('✅ Profil gespeichert!');
  } catch (err: any) {
    showAlert('Fehler', err.message);
  } finally { setSaving(false); }
}

async function handleAddContact() {
  if (!newName || !newPhone) { showAlert('Fehler', 'Name und Telefon sind Pflichtfelder'); return; }
  setAddingContact(true);
  try {
    const token = await getToken();
    const contact = await apiFetch('/profile/emergency-contacts', {
      method: 'POST',
      body: JSON.stringify({ name: newName, phone: newPhone, relation: newRelation || null, isPrimary: profile.emergencyContacts.length === 0 }),
    }, token ?? undefined);
    setProfile((p: any) => ({ ...p, emergencyContacts: [...p.emergencyContacts, contact] }));
    setNewName(''); setNewPhone(''); setNewRelation('');
  } catch (err: any) {
    showAlert('Fehler', err.message);
  } finally { setAddingContact(false); }
}

async function handleDeleteContact(id: string) {
  const confirmed = await showConfirm('Kontakt löschen?');
  if (!confirmed) return;
  try {
    const token = await getToken();
    await apiFetch(`/profile/emergency-contacts/${id}`, { method: 'DELETE' }, token ?? undefined);
    setProfile((p: any) => ({ ...p, emergencyContacts: p.emergencyContacts.filter((c: any) => c.id !== id) }));
  } catch (err: any) { showAlert('Fehler', err.message); }
}

  if (loading) return <View style={styles.loading}><Text style={styles.loadingEmoji}>👤</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mein Profil</Text>
        <Text style={styles.subtitle}>Notfallinformationen & Kontakte</Text>
      </View>

      {/* Persönliche Daten */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>PERSÖNLICHE DATEN</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor="#bbb" />
          <Text style={styles.fieldLabel}>Telefon</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+41 79 123 45 67" placeholderTextColor="#bbb" keyboardType="phone-pad" />
          <Text style={styles.fieldLabel}>Geburtsjahr</Text>
          <TextInput style={styles.input} value={birthYear} onChangeText={setBirthYear} placeholder="z.B. 1990" placeholderTextColor="#bbb" keyboardType="numeric" />
        </View>
      </View>

      {/* Medizin */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>MEDIZINISCHE INFORMATIONEN</Text>
        <Text style={styles.sectionHint}>Im Notfall für Rettungskräfte sichtbar</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Blutgruppe</Text>
          <View style={styles.chipRow}>
            {BLOOD_TYPES.map(bt => (
              <TouchableOpacity
                key={bt}
                style={[styles.chip, bloodType === bt && styles.chipActive]}
                onPress={() => setBloodType(bt === bloodType ? '' : bt)}
              >
                <Text style={[styles.chipText, bloodType === bt && styles.chipTextActive]}>{bt}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.fieldLabel}>Allergien</Text>
          <TextInput style={[styles.input, styles.textArea]} value={allergies} onChangeText={setAllergies} multiline placeholder="z.B. Penicillin, Nüsse" placeholderTextColor="#bbb" />
          <Text style={styles.fieldLabel}>Medikamente</Text>
          <TextInput style={[styles.input, styles.textArea]} value={medications} onChangeText={setMedications} multiline placeholder="z.B. Blutverdünner 5mg" placeholderTextColor="#bbb" />
          <Text style={styles.fieldLabel}>Weitere Hinweise</Text>
          <TextInput style={[styles.input, styles.textArea]} value={medicalNotes} onChangeText={setMedicalNotes} multiline placeholder="z.B. Herzschrittmacher, Diabetes" placeholderTextColor="#bbb" />
        </View>
      </View>

      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Speichert...' : 'Profil speichern'}</Text>
      </TouchableOpacity>

      {/* Notfallkontakte */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>NOTFALLKONTAKTE</Text>
        {profile.emergencyContacts.length === 0 && (
          <Text style={styles.sectionHint}>Noch keine Kontakte — füge mindestens einen hinzu!</Text>
        )}

        <View style={styles.contactList}>
          {profile.emergencyContacts.map((c: any) => (
            <View key={c.id} style={styles.contactCard}>
              <View style={styles.contactLeft}>
                <Text style={styles.contactName}>
                  {c.isPrimary ? '⭐ ' : ''}{c.name}
                </Text>
                <Text style={styles.contactMeta}>{c.relation ? `${c.relation} · ` : ''}{c.phone}</Text>
              </View>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteContact(c.id)}>
                <Text style={styles.deleteBtnText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Neuer Kontakt */}
        <View style={[styles.card, { marginTop: 8 }]}>
          <Text style={styles.addTitle}>+ Neuer Kontakt</Text>
          <Text style={styles.fieldLabel}>Name *</Text>
          <TextInput style={styles.input} value={newName} onChangeText={setNewName} placeholder="z.B. Anna Muster" placeholderTextColor="#bbb" />
          <Text style={styles.fieldLabel}>Telefon *</Text>
          <TextInput style={styles.input} value={newPhone} onChangeText={setNewPhone} placeholder="+41 79 123 45 67" placeholderTextColor="#bbb" keyboardType="phone-pad" />
          <Text style={styles.fieldLabel}>Beziehung</Text>
          <TextInput style={styles.input} value={newRelation} onChangeText={setNewRelation} placeholder="z.B. Partner, Mutter" placeholderTextColor="#bbb" />
          <TouchableOpacity style={[styles.addBtn, addingContact && { opacity: 0.6 }]} onPress={handleAddContact} disabled={addingContact}>
            <Text style={styles.addBtnText}>{addingContact ? 'Speichert...' : 'Kontakt hinzufügen'}</Text>
          </TouchableOpacity>
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
  section: { paddingHorizontal: 16, paddingTop: 24 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#aaa', letterSpacing: 1, marginBottom: 8 },
  sectionHint: { fontSize: 13, color: '#bbb', marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#aaa', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#f8f8f8', borderRadius: 10, padding: 14, fontSize: 15, color: '#222', borderWidth: 1, borderColor: '#f0f0f0' },
  textArea: { height: 72, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: '#f8f8f8', borderWidth: 1.5, borderColor: '#eee' },
  chipActive: { backgroundColor: '#fef2f2', borderColor: '#e63946' },
  chipText: { fontSize: 13, color: '#555', fontWeight: '600' },
  chipTextActive: { color: '#e63946', fontWeight: '700' },
  saveBtn: { margin: 16, backgroundColor: '#2D6A4F', padding: 18, borderRadius: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  contactList: { gap: 8 },
  contactCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  contactLeft: { flex: 1 },
  contactName: { fontSize: 15, fontWeight: '700', color: '#111' },
  contactMeta: { fontSize: 13, color: '#aaa', marginTop: 2 },
  deleteBtn: { padding: 8 },
  deleteBtnText: { fontSize: 18 },
  addTitle: { fontSize: 15, fontWeight: '700', color: '#2D6A4F', marginBottom: 4 },
  addBtn: { backgroundColor: '#1a2e1a', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});