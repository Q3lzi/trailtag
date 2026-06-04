import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiFetch } from '../lib/api';

async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem('token');
  return await SecureStore.getItemAsync('token');
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'];

export default function ProfileScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profil Felder
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medications, setMedications] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');

  // Neuer Kontakt
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRelation, setNewRelation] = useState('');
  const [addingContact, setAddingContact] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const token = await getToken();
      const data = await apiFetch('/profile', {}, token ?? undefined);
      setProfile(data);
      setName(data.name ?? '');
      setPhone(data.phone ?? '');
      setBirthYear(data.birthYear ? String(data.birthYear) : '');
      setBloodType(data.bloodType ?? '');
      setAllergies(data.allergies ?? '');
      setMedications(data.medications ?? '');
      setMedicalNotes(data.medicalNotes ?? '');
    } catch (err) {
      console.log('Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const token = await getToken();
      await apiFetch('/profile', {
        method: 'PUT',
        body: JSON.stringify({ name, phone, birthYear: birthYear ? parseInt(birthYear) : null, bloodType, allergies, medications, medicalNotes }),
      }, token ?? undefined);
      if (Platform.OS === 'web') window.alert('✅ Profil gespeichert!');
    } catch (err: any) {
      if (Platform.OS === 'web') window.alert('Fehler: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

async function handleAddContact() {
  if (!newName || !newPhone) {
    window.alert('Name und Telefon sind Pflichtfelder');
    return;
  }
  setAddingContact(true);
  try {
    const token = await getToken();
    console.log('Token:', token);
    console.log('Sending:', { name: newName, phone: newPhone, relation: newRelation });
    const contact = await apiFetch('/profile/emergency-contacts', {
      method: 'POST',
      body: JSON.stringify({ name: newName, phone: newPhone, relation: newRelation || null, isPrimary: profile.emergencyContacts.length === 0 }),
    }, token ?? undefined);
    console.log('Contact created:', contact);
    setProfile((p: any) => ({ ...p, emergencyContacts: [...p.emergencyContacts, contact] }));
    setNewName(''); setNewPhone(''); setNewRelation('');
  } catch (err: any) {
    console.log('Error:', err);
    window.alert('Fehler: ' + err.message);
  } finally {
    setAddingContact(false);
  }
}

  async function handleDeleteContact(id: string) {
    const confirmed = Platform.OS === 'web' ? window.confirm('Kontakt löschen?') : true;
    if (!confirmed) return;
    try {
      const token = await getToken();
      await apiFetch(`/profile/emergency-contacts/${id}`, { method: 'DELETE' }, token ?? undefined);
      setProfile((p: any) => ({ ...p, emergencyContacts: p.emergencyContacts.filter((c: any) => c.id !== id) }));
    } catch (err: any) {
      if (Platform.OS === 'web') window.alert('Fehler: ' + err.message);
    }
  }

  if (loading) return <View style={styles.container}><Text>Lädt...</Text></View>;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>👤 Mein Profil</Text>

      {/* Persönliche Daten */}
      <Text style={styles.sectionTitle}>① Persönliche Daten</Text>
      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />

      <Text style={styles.label}>Telefon</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+41 79 123 45 67" />

      <Text style={styles.label}>Geburtsjahr</Text>
      <TextInput style={styles.input} value={birthYear} onChangeText={setBirthYear} keyboardType="numeric" placeholder="z.B. 1990" />

      {/* Medizinische Infos */}
      <Text style={styles.sectionTitle}>② Medizinische Informationen</Text>
      <Text style={styles.hint}>Diese Informationen werden im Notfall für Rettungskräfte sichtbar.</Text>

      <Text style={styles.label}>Blutgruppe</Text>
      <View style={styles.grid}>
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

      <Text style={styles.label}>Allergien</Text>
      <TextInput style={[styles.input, styles.textArea]} value={allergies} onChangeText={setAllergies} multiline numberOfLines={2} placeholder="z.B. Penicillin, Nüsse" />

      <Text style={styles.label}>Medikamente</Text>
      <TextInput style={[styles.input, styles.textArea]} value={medications} onChangeText={setMedications} multiline numberOfLines={2} placeholder="z.B. Blutverdünner 5mg" />

      <Text style={styles.label}>Weitere medizinische Hinweise</Text>
      <TextInput style={[styles.input, styles.textArea]} value={medicalNotes} onChangeText={setMedicalNotes} multiline numberOfLines={3} placeholder="z.B. Herzschrittmacher, Diabetes Typ 2" />

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Speichert...' : '💾 Profil speichern'}</Text>
      </TouchableOpacity>

      {/* Notfallkontakte */}
      <Text style={styles.sectionTitle}>③ Notfallkontakte</Text>

      {profile.emergencyContacts.length === 0 && (
        <Text style={styles.hint}>Noch keine Notfallkontakte. Füge mindestens einen hinzu!</Text>
      )}

      {profile.emergencyContacts.map((c: any) => (
        <View key={c.id} style={styles.contactCard}>
          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>
              {c.isPrimary ? '⭐ ' : ''}{c.name}
              {c.relation ? ` · ${c.relation}` : ''}
            </Text>
            <Text style={styles.contactPhone}>{c.phone}</Text>
          </View>
          <TouchableOpacity onPress={() => handleDeleteContact(c.id)}>
            <Text style={styles.deleteBtn}>🗑️</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Neuer Kontakt */}
      <View style={styles.addContactCard}>
        <Text style={styles.addContactTitle}>+ Neuer Kontakt</Text>
        <Text style={styles.label}>Name *</Text>
        <TextInput style={styles.input} value={newName} onChangeText={setNewName} placeholder="z.B. Anna Muster" />
        <Text style={styles.label}>Telefon *</Text>
        <TextInput style={styles.input} value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" placeholder="+41 79 123 45 67" />
        <Text style={styles.label}>Beziehung</Text>
        <TextInput style={styles.input} value={newRelation} onChangeText={setNewRelation} placeholder="z.B. Partner, Mutter, Freund" />
        <TouchableOpacity style={styles.addBtn} onPress={handleAddContact} disabled={addingContact}>
          <Text style={styles.addBtnText}>{addingContact ? 'Speichert...' : '+ Kontakt hinzufügen'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 60, paddingBottom: 60 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#2D6A4F', marginTop: 24, marginBottom: 8 },
  hint: { fontSize: 13, color: '#999', marginBottom: 12, lineHeight: 18 },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 16, marginBottom: 16, fontSize: 16, backgroundColor: '#fff' },
  textArea: { height: 70, textAlignVertical: 'top' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#f9f9f9' },
  chipActive: { borderColor: '#e63946', backgroundColor: '#fff5f5' },
  chipText: { fontSize: 14, color: '#444', fontWeight: '600' },
  chipTextActive: { color: '#e63946', fontWeight: '700' },
  saveBtn: { backgroundColor: '#2D6A4F', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  contactCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  contactPhone: { fontSize: 13, color: '#666' },
  deleteBtn: { fontSize: 20, paddingLeft: 12 },
  addContactCard: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 16, marginTop: 8 },
  addContactTitle: { fontSize: 15, fontWeight: '700', color: '#2D6A4F', marginBottom: 16 },
  addBtn: { backgroundColor: '#2D6A4F', padding: 14, borderRadius: 12, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});