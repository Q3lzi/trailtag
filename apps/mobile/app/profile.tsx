import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Platform, Linking } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiFetch } from '../lib/api';
import { getToken } from '../lib/storage';
import { showAlert, showConfirm } from '../lib/alert';
import {
  User, Phone, Heart, Shield, Users, Plus, Trash2, Edit3,
  QrCode, UserPlus, Check, X, ChevronRight, Star
} from 'lucide-react-native';

const BLOOD_TYPES = ['A+','A-','B+','B-','AB+','AB-','0+','0-'];

const GROUP_COLORS = [
  { label: 'Grün',   value: '#2c694e' },
  { label: 'Blau',   value: '#1d4ed8' },
  { label: 'Rot',    value: '#dc2626' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Lila',   value: '#7c3aed' },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'profil'|'freunde'>('profil');

  // Profile state
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

  // Contacts
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRelation, setNewRelation] = useState('');
  const [addingContact, setAddingContact] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [showAddContact, setShowAddContact] = useState(false);

  // Friends
  const [friends, setFriends] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [myQrCode, setMyQrCode] = useState<string|null>(null);
  const [scanInput, setScanInput] = useState('');
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#2c694e');

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const token = await getToken();
      const [data, friendData, qrData] = await Promise.all([
        apiFetch('/profile', {}, token ?? undefined),
        apiFetch('/friends', {}, token ?? undefined),
        apiFetch('/friends/qr', {}, token ?? undefined),
      ]);
      setProfile(data);
      setName(data.name ?? ''); setPhone(data.phone ?? '');
      setBirthYear(data.birthYear ? String(data.birthYear) : '');
      setBloodType(data.bloodType ?? ''); setAllergies(data.allergies ?? '');
      setMedications(data.medications ?? ''); setMedicalNotes(data.medicalNotes ?? '');
      setFriends(friendData.friends ?? []);
      setPending(friendData.pending ?? []);
      setGroups(friendData.groups ?? []);
      setMyQrCode(qrData.qrCode ?? null);
    } catch (err) { console.log('Ladefehler:', err); }
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
      showAlert('✅ Gespeichert!');
    } catch (err: any) { showAlert('Fehler', err.message); }
    finally { setSaving(false); }
  }

  async function handleAddContact() {
    if (!newName || !newPhone) { showAlert('Fehler', 'Name und Telefon erforderlich'); return; }
    setAddingContact(true);
    try {
      const token = await getToken();
      const contact = await apiFetch('/profile/emergency-contacts', {
        method: 'POST',
        body: JSON.stringify({ name: newName, phone: newPhone, relation: newRelation || null, isPrimary: profile.emergencyContacts.length === 0 }),
      }, token ?? undefined);
      setProfile((p: any) => ({ ...p, emergencyContacts: [...p.emergencyContacts, contact] }));
      setNewName(''); setNewPhone(''); setNewRelation(''); setShowAddContact(false);
    } catch (err: any) { showAlert('Fehler', err.message); }
    finally { setAddingContact(false); }
  }

  async function handleEditContact() {
    if (!newName || !newPhone) { showAlert('Fehler', 'Name und Telefon erforderlich'); return; }
    setAddingContact(true);
    try {
      const token = await getToken();
      await apiFetch(`/profile/emergency-contacts/${editingContact.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: newName, phone: newPhone, relation: newRelation || null }),
      }, token ?? undefined);
      setProfile((p: any) => ({
        ...p,
        emergencyContacts: p.emergencyContacts.map((c: any) =>
          c.id === editingContact.id ? { ...c, name: newName, phone: newPhone, relation: newRelation || null } : c
        )
      }));
      setEditingContact(null); setNewName(''); setNewPhone(''); setNewRelation(''); setShowAddContact(false);
    } catch (err: any) { showAlert('Fehler', err.message); }
    finally { setAddingContact(false); }
  }

  async function handleDeleteContact(id: string) {
    const ok = await showConfirm('Kontakt löschen?');
    if (!ok) return;
    try {
      const token = await getToken();
      await apiFetch(`/profile/emergency-contacts/${id}`, { method: 'DELETE' }, token ?? undefined);
      setProfile((p: any) => ({ ...p, emergencyContacts: p.emergencyContacts.filter((c: any) => c.id !== id) }));
    } catch (err: any) { showAlert('Fehler', err.message); }
  }

  async function handleAddFriend() {
    if (!scanInput.trim()) return;
    try {
      const token = await getToken();
      const res = await apiFetch('/friends/add', { method: 'POST', body: JSON.stringify({ qrCode: scanInput.trim() }) }, token ?? undefined);
      setPending(p => [...p, res]);
      setScanInput(''); setShowAddFriend(false);
      showAlert('Anfrage gesendet!', `${res.target?.name} wurde eine Freundschaftsanfrage gesendet.`);
    } catch (err: any) { showAlert('Fehler', err.message); }
  }

  async function handleAccept(id: string) {
    try {
      const token = await getToken();
      await apiFetch(`/friends/${id}/accept`, { method: 'POST' }, token ?? undefined);
      loadAll();
    } catch (err: any) { showAlert('Fehler', err.message); }
  }

  async function handleDecline(id: string) {
    try {
      const token = await getToken();
      await apiFetch(`/friends/${id}/decline`, { method: 'POST' }, token ?? undefined);
      setPending(p => p.filter(f => f.id !== id));
    } catch (err: any) { showAlert('Fehler', err.message); }
  }

  async function handleRemoveFriend(id: string) {
    const ok = await showConfirm('Freund entfernen?');
    if (!ok) return;
    try {
      const token = await getToken();
      await apiFetch(`/friends/${id}`, { method: 'DELETE' }, token ?? undefined);
      setFriends(f => f.filter(fr => fr.friendshipId !== id));
    } catch (err: any) { showAlert('Fehler', err.message); }
  }

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    try {
      const token = await getToken();
      const group = await apiFetch('/friends/groups', {
        method: 'POST', body: JSON.stringify({ name: newGroupName.trim(), color: newGroupColor })
      }, token ?? undefined);
      setGroups(g => [...g, group]);
      setNewGroupName(''); setShowNewGroup(false);
    } catch (err: any) { showAlert('Fehler', err.message); }
  }

  function shareMyQR() {
    if (!myQrCode) return;
    const url = `trailtag://friend/${myQrCode}`;
    const msg = `Füge mich bei Trailtag als Freund hinzu!\n\nMein Code: ${myQrCode}\n\nOder direkt:\n${url}`;
    if (Platform.OS === 'web') {
      if (navigator.share) {
        navigator.share({ title: 'Trailtag Freundschaft', text: msg });
      } else {
        navigator.clipboard?.writeText(myQrCode);
        showAlert('Code kopiert!', myQrCode);
      }
    } else {
      const { Share } = require('react-native');
      Share.share({ message: msg });
    }
  }

  if (loading) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ fontSize: 32 }}>👤</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name ? name.charAt(0).toUpperCase() : '?'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerName}>{name || 'Mein Profil'}</Text>
          <Text style={styles.headerSub}>{profile?.email}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, tab === 'profil' && styles.tabActive]} onPress={() => setTab('profil')}>
          <User size={15} color={tab === 'profil' ? '#2c694e' : '#747871'} strokeWidth={2}/>
          <Text style={[styles.tabTxt, tab === 'profil' && styles.tabTxtActive]}>Profil</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'freunde' && styles.tabActive]} onPress={() => setTab('freunde')}>
          <Users size={15} color={tab === 'freunde' ? '#2c694e' : '#747871'} strokeWidth={2}/>
          <Text style={[styles.tabTxt, tab === 'freunde' && styles.tabTxtActive]}>Freunde {pending.length > 0 ? `(${pending.length})` : ''}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

        {tab === 'profil' && (<>
          {/* QR Code eigener */}
          {myQrCode && (
            <TouchableOpacity style={styles.qrBanner} onPress={shareMyQR}>
              <QrCode size={20} color="#2c694e" strokeWidth={2}/>
              <View style={{ flex: 1 }}>
                <Text style={styles.qrBannerTitle}>Mein Trailtag-Code</Text>
                <Text style={styles.qrBannerSub}>Teilen damit Freunde mich finden können</Text>
              </View>
              <Text style={styles.qrBannerCode}>{myQrCode.slice(0, 8).toUpperCase()}</Text>
              <ChevronRight size={16} color="#2c694e" strokeWidth={2}/>
            </TouchableOpacity>
          )}

          {/* Persönliche Daten */}
          <Text style={styles.sectionLabel}>PERSÖNLICHE DATEN</Text>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>NAME</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor="#c3c8bf"/>
            <Text style={styles.fieldLabel}>TELEFON</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+41 79 123 45 67" placeholderTextColor="#c3c8bf" keyboardType="phone-pad"/>
            <Text style={styles.fieldLabel}>GEBURTSJAHR</Text>
            <TextInput style={styles.input} value={birthYear} onChangeText={setBirthYear} placeholder="1990" placeholderTextColor="#c3c8bf" keyboardType="numeric"/>
          </View>

          {/* Medizin */}
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>MEDIZINISCHE INFOS</Text>
          <Text style={styles.sectionHint}>Im Alarmfall für Rettungskräfte sichtbar</Text>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>BLUTGRUPPE</Text>
            <View style={styles.chipRow}>
              {BLOOD_TYPES.map(bt => (
                <TouchableOpacity key={bt} style={[styles.chip, bloodType === bt && styles.chipOn]} onPress={() => setBloodType(bt === bloodType ? '' : bt)}>
                  <Text style={[styles.chipTxt, bloodType === bt && styles.chipTxtOn]}>{bt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>ALLERGIEN</Text>
            <TextInput style={[styles.input, { height: 64 }]} value={allergies} onChangeText={setAllergies} multiline placeholder="z.B. Penicillin, Nüsse" placeholderTextColor="#c3c8bf"/>
            <Text style={styles.fieldLabel}>MEDIKAMENTE</Text>
            <TextInput style={[styles.input, { height: 64 }]} value={medications} onChangeText={setMedications} multiline placeholder="z.B. Blutverdünner 5mg" placeholderTextColor="#c3c8bf"/>
            <Text style={styles.fieldLabel}>WEITERE HINWEISE</Text>
            <TextInput style={[styles.input, { height: 64 }]} value={medicalNotes} onChangeText={setMedicalNotes} multiline placeholder="z.B. Herzschrittmacher, Diabetes" placeholderTextColor="#c3c8bf"/>
          </View>

          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            <Text style={styles.saveBtnTxt}>{saving ? 'Speichert...' : 'Profil speichern'}</Text>
          </TouchableOpacity>

          {/* Notfallkontakte */}
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>NOTFALLKONTAKTE</Text>
          {profile?.emergencyContacts?.length === 0 && (
            <Text style={styles.sectionHint}>Noch keine Kontakte. Mindestens einen hinzufügen!</Text>
          )}
          {profile?.emergencyContacts?.map((c: any) => (
            <View key={c.id} style={styles.contactCard}>
              <View style={[styles.contactAvatar, c.isPrimary && { backgroundColor: '#aeeecb' }]}>
                {c.isPrimary ? <Star size={14} color="#2c694e" strokeWidth={2} fill="#2c694e"/> : <User size={14} color="#747871" strokeWidth={2}/>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>{c.name}</Text>
                <Text style={styles.contactMeta}>{c.relation ? `${c.relation} · ` : ''}{c.phone}</Text>
              </View>
              <TouchableOpacity style={styles.iconBtn} onPress={() => {
                setEditingContact(c); setNewName(c.name); setNewPhone(c.phone); setNewRelation(c.relation ?? ''); setShowAddContact(true);
              }}>
                <Edit3 size={14} color="#2c694e" strokeWidth={2}/>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#ffdad6' }]} onPress={() => handleDeleteContact(c.id)}>
                <Trash2 size={14} color="#ba1a1a" strokeWidth={2}/>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.addBtn} onPress={() => { setEditingContact(null); setNewName(''); setNewPhone(''); setNewRelation(''); setShowAddContact(v => !v); }}>
            <Plus size={15} color="#2c694e" strokeWidth={2}/>
            <Text style={styles.addBtnTxt}>Notfallkontakt hinzufügen</Text>
          </TouchableOpacity>

          {showAddContact && (
            <View style={[styles.card, { marginTop: 8 }]}>
              <Text style={styles.cardTitle}>{editingContact ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}</Text>
              <Text style={styles.fieldLabel}>NAME *</Text>
              <TextInput style={styles.input} value={newName} onChangeText={setNewName} placeholder="z.B. Anna Muster" placeholderTextColor="#c3c8bf"/>
              <Text style={styles.fieldLabel}>TELEFON *</Text>
              <TextInput style={styles.input} value={newPhone} onChangeText={setNewPhone} placeholder="+41 79 123 45 67" placeholderTextColor="#c3c8bf" keyboardType="phone-pad"/>
              <Text style={styles.fieldLabel}>BEZIEHUNG</Text>
              <TextInput style={styles.input} value={newRelation} onChangeText={setNewRelation} placeholder="z.B. Partner, Mutter" placeholderTextColor="#c3c8bf"/>
              <TouchableOpacity style={[styles.saveBtn, { marginTop: 8 }, addingContact && { opacity: 0.6 }]}
                onPress={editingContact ? handleEditContact : handleAddContact} disabled={addingContact}>
                <Text style={styles.saveBtnTxt}>{addingContact ? 'Speichert...' : editingContact ? 'Speichern' : 'Hinzufügen'}</Text>
              </TouchableOpacity>
              {editingContact && (
                <TouchableOpacity style={{ padding: 12, alignItems: 'center' }} onPress={() => { setShowAddContact(false); setEditingContact(null); }}>
                  <Text style={{ color: '#747871', fontWeight: '600' }}>Abbrechen</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </>)}

        {tab === 'freunde' && (<>
          {/* Mein QR */}
          <TouchableOpacity style={styles.qrBanner} onPress={shareMyQR}>
            <QrCode size={20} color="#2c694e" strokeWidth={2}/>
            <View style={{ flex: 1 }}>
              <Text style={styles.qrBannerTitle}>Meinen Code teilen</Text>
              <Text style={styles.qrBannerSub}>Freunde können dich über diesen Code finden</Text>
            </View>
            <Text style={styles.qrBannerCode}>{myQrCode?.slice(0, 8).toUpperCase()}</Text>
          </TouchableOpacity>

          {/* Ausstehende Anfragen */}
          {pending.length > 0 && (<>
            <Text style={styles.sectionLabel}>AUSSTEHENDE ANFRAGEN</Text>
            {pending.map((f: any) => (
              <View key={f.id} style={[styles.contactCard, { borderLeftWidth: 3, borderLeftColor: '#f59e0b' }]}>
                <View style={[styles.contactAvatar, { backgroundColor: '#fef3c7' }]}>
                  <User size={14} color="#92400e" strokeWidth={2}/>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>{f.initiator?.name}</Text>
                  <Text style={styles.contactMeta}>Möchte dich als Freund hinzufügen</Text>
                </View>
                <TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#aeeecb' }]} onPress={() => handleAccept(f.id)}>
                  <Check size={14} color="#2c694e" strokeWidth={2.5}/>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#ffdad6' }]} onPress={() => handleDecline(f.id)}>
                  <X size={14} color="#ba1a1a" strokeWidth={2.5}/>
                </TouchableOpacity>
              </View>
            ))}
          </>)}

          {/* Freund hinzufügen */}
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddFriend(v => !v)}>
            <UserPlus size={15} color="#2c694e" strokeWidth={2}/>
            <Text style={styles.addBtnTxt}>Freund per Code hinzufügen</Text>
          </TouchableOpacity>

          {showAddFriend && (
            <View style={[styles.card, { marginTop: 8 }]}>
              <Text style={styles.cardTitle}>Trailtag-Code eingeben</Text>
              <Text style={styles.sectionHint}>Den Code des Freundes eingeben (aus seinem Profil)</Text>
              <TextInput style={styles.input} value={scanInput} onChangeText={setScanInput}
                placeholder="z.B. A3F8B2C1-..." placeholderTextColor="#c3c8bf" autoCapitalize="none"/>
              <TouchableOpacity style={[styles.saveBtn, { marginTop: 8 }]} onPress={handleAddFriend}>
                <Text style={styles.saveBtnTxt}>Anfrage senden</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Gruppen */}
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>GRUPPEN</Text>
          {groups.map((g: any) => (
            <View key={g.id} style={[styles.groupChip, { borderLeftColor: g.color }]}>
              <View style={[styles.groupDot, { backgroundColor: g.color }]}/>
              <Text style={styles.groupName}>{g.name}</Text>
              <Text style={styles.groupCount}>{friends.filter((f: any) => f.groupId === g.id).length} Freunde</Text>
            </View>
          ))}
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowNewGroup(v => !v)}>
            <Plus size={15} color="#2c694e" strokeWidth={2}/>
            <Text style={styles.addBtnTxt}>Neue Gruppe erstellen</Text>
          </TouchableOpacity>
          {showNewGroup && (
            <View style={[styles.card, { marginTop: 8 }]}>
              <Text style={styles.cardTitle}>Neue Gruppe</Text>
              <Text style={styles.fieldLabel}>NAME</Text>
              <TextInput style={styles.input} value={newGroupName} onChangeText={setNewGroupName} placeholder="z.B. Familie, Bergkollegen" placeholderTextColor="#c3c8bf"/>
              <Text style={styles.fieldLabel}>FARBE</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {GROUP_COLORS.map(gc => (
                  <TouchableOpacity key={gc.value} onPress={() => setNewGroupColor(gc.value)}
                    style={[styles.colorDot, { backgroundColor: gc.value, borderWidth: newGroupColor === gc.value ? 3 : 0, borderColor: '#fff', shadowOpacity: newGroupColor === gc.value ? 0.3 : 0 }]}/>
                ))}
              </View>
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreateGroup}>
                <Text style={styles.saveBtnTxt}>Gruppe erstellen</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Freundesliste */}
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>MEINE FREUNDE ({friends.length})</Text>
          {friends.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>👥</Text>
              <Text style={styles.emptyTitle}>Noch keine Freunde</Text>
              <Text style={styles.emptySub}>Teile deinen Code damit Freunde dich hinzufügen können</Text>
            </View>
          ) : (
            friends.map((f: any) => (
              <View key={f.friendshipId} style={styles.contactCard}>
                <View style={[styles.contactAvatar, f.groupId ? { backgroundColor: (groups.find((g: any) => g.id === f.groupId)?.color ?? '#2c694e') + '22' } : {}]}>
                  <User size={14} color={f.groupId ? (groups.find((g: any) => g.id === f.groupId)?.color ?? '#747871') : '#747871'} strokeWidth={2}/>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>{f.name}</Text>
                  <Text style={styles.contactMeta}>
                    {f.group ? `${f.group.name} · ` : ''}{f.phone ?? ''}
                  </Text>
                </View>
                {f.phone ? (
                  <TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#aeeecb' }]}
                    onPress={() => Platform.OS === 'web' ? null : Linking.openURL(`tel:${f.phone}`)}>
                    <Phone size={14} color="#2c694e" strokeWidth={2}/>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#ffdad6' }]} onPress={() => handleRemoveFriend(f.friendshipId)}>
                  <Trash2 size={14} color="#ba1a1a" strokeWidth={2}/>
                </TouchableOpacity>
              </View>
            ))
          )}
        </>)}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { backgroundColor: '#061907', paddingHorizontal: 20, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2c694e', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerName: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e1e3e4' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#2c694e' },
  tabTxt: { fontSize: 13, fontWeight: '600', color: '#747871' },
  tabTxtActive: { color: '#2c694e', fontWeight: '800' },
  scroll: { flex: 1 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#747871', letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  sectionHint: { fontSize: 12, color: '#c3c8bf', marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#e1e3e4', marginBottom: 8 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#061907', marginBottom: 12 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: '#747871', letterSpacing: 0.8, marginBottom: 5, marginTop: 10 },
  input: { backgroundColor: '#f8f9fa', borderRadius: 6, padding: 12, fontSize: 14, color: '#191c1d', borderWidth: 1, borderColor: '#e1e3e4', marginBottom: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6, backgroundColor: '#f8f9fa', borderWidth: 1.5, borderColor: '#e1e3e4' },
  chipOn: { backgroundColor: '#ffdad6', borderColor: '#ba1a1a' },
  chipTxt: { fontSize: 13, color: '#434841', fontWeight: '600' },
  chipTxtOn: { color: '#ba1a1a', fontWeight: '700' },
  saveBtn: { backgroundColor: '#061907', borderRadius: 6, padding: 16, alignItems: 'center', marginTop: 4 },
  saveBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  contactCard: { backgroundColor: '#fff', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#e1e3e4', marginBottom: 8 },
  contactAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f5', alignItems: 'center', justifyContent: 'center' },
  contactName: { fontSize: 14, fontWeight: '700', color: '#061907' },
  contactMeta: { fontSize: 12, color: '#747871', marginTop: 1 },
  iconBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#f0faf4', alignItems: 'center', justifyContent: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  addBtnTxt: { fontSize: 14, color: '#2c694e', fontWeight: '700' },
  qrBanner: { backgroundColor: '#fff', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#aeeecb', flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  qrBannerTitle: { fontSize: 13, fontWeight: '800', color: '#061907' },
  qrBannerSub: { fontSize: 11, color: '#747871', marginTop: 1 },
  qrBannerCode: { fontSize: 11, fontWeight: '800', color: '#2c694e', fontFamily: 'monospace' },
  groupChip: { backgroundColor: '#fff', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#e1e3e4', borderLeftWidth: 4, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  groupDot: { width: 10, height: 10, borderRadius: 5 },
  groupName: { fontSize: 13, fontWeight: '700', color: '#061907', flex: 1 },
  groupCount: { fontSize: 11, color: '#747871' },
  colorDot: { width: 28, height: 28, borderRadius: 14, shadowColor: '#000', shadowRadius: 4, elevation: 2 },
  emptyState: { alignItems: 'center', padding: 32, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e1e3e4' },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#434841' },
  emptySub: { fontSize: 12, color: '#747871', textAlign: 'center', marginTop: 4, lineHeight: 18 },
});
