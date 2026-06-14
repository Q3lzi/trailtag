import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Platform, Linking, Switch } from 'react-native';
import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { apiFetch } from '../lib/api';
import { getToken } from '../lib/storage';
import { showAlert, showConfirm } from '../lib/alert';
import {
  Mountain, User, Phone, Users, Plus, Trash2, Edit3,
  QrCode, UserPlus, Check, X, ChevronRight, Star,
  Shield, Eye, EyeOff
} from 'lucide-react-native';

const BLOOD_TYPES = ['A+','A-','B+','B-','AB+','AB-','0+','0-'];
const GROUP_COLORS = [
  '#2c694e','#1d4ed8','#dc2626','#ea580c','#7c3aed','#0891b2'
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'profil'|'notfall'|'freunde'>('profil');

  // Profile
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

  // Privacy settings for QR portal
  const [showName, setShowName] = useState(true);
  const [showPhone, setShowPhone] = useState(true);
  const [showMedical, setShowMedical] = useState(true);
  const [showContacts, setShowContacts] = useState(true);

  // Contacts
  const [newCName, setNewCName] = useState('');
  const [newCPhone, setNewCPhone] = useState('');
  const [newCRelation, setNewCRelation] = useState('');
  const [addingC, setAddingC] = useState(false);
  const [editingC, setEditingC] = useState<any>(null);
  const [showAddC, setShowAddC] = useState(false);

  // Friends
  const [friends, setFriends] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [myQrCode, setMyQrCode] = useState<string|null>(null);
  const [scanInput, setScanInput] = useState('');
  const [showAddF, setShowAddF] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#2c694e');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const token = await getToken();
      const [data, friendData, qrData] = await Promise.all([
        apiFetch('/profile', {}, token ?? undefined),
        apiFetch('/friends', {}, token ?? undefined).catch(() => ({ friends: [], pending: [], groups: [] })),
        apiFetch('/friends/qr', {}, token ?? undefined).catch(() => ({ qrCode: null })),
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
      showAlert('✅ Profil gespeichert!');
    } catch (err: any) { showAlert('Fehler', err.message); }
    finally { setSaving(false); }
  }

  async function handleAddContact() {
    if (!newCName || !newCPhone) { showAlert('Fehler', 'Name und Telefon erforderlich'); return; }
    setAddingC(true);
    try {
      const token = await getToken();
      const contact = await apiFetch('/profile/emergency-contacts', {
        method: 'POST',
        body: JSON.stringify({ name: newCName, phone: newCPhone, relation: newCRelation || null, isPrimary: (profile.emergencyContacts?.length ?? 0) === 0 }),
      }, token ?? undefined);
      setProfile((p: any) => ({ ...p, emergencyContacts: [...(p.emergencyContacts ?? []), contact] }));
      setNewCName(''); setNewCPhone(''); setNewCRelation(''); setShowAddC(false);
    } catch (err: any) { showAlert('Fehler', err.message); }
    finally { setAddingC(false); }
  }

  async function handleEditContact() {
    if (!newCName || !newCPhone) { showAlert('Fehler', 'Name und Telefon erforderlich'); return; }
    setAddingC(true);
    try {
      const token = await getToken();
      await apiFetch(`/profile/emergency-contacts/${editingC.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: newCName, phone: newCPhone, relation: newCRelation || null }),
      }, token ?? undefined);
      setProfile((p: any) => ({
        ...p,
        emergencyContacts: (p.emergencyContacts ?? []).map((c: any) =>
          c.id === editingC.id ? { ...c, name: newCName, phone: newCPhone, relation: newCRelation || null } : c
        )
      }));
      setEditingC(null); setNewCName(''); setNewCPhone(''); setNewCRelation(''); setShowAddC(false);
    } catch (err: any) { showAlert('Fehler', err.message); }
    finally { setAddingC(false); }
  }

  async function handleDeleteContact(id: string) {
    const ok = await showConfirm('Kontakt löschen?');
    if (!ok) return;
    try {
      const token = await getToken();
      await apiFetch(`/profile/emergency-contacts/${id}`, { method: 'DELETE' }, token ?? undefined);
      setProfile((p: any) => ({ ...p, emergencyContacts: (p.emergencyContacts ?? []).filter((c: any) => c.id !== id) }));
    } catch (err: any) { showAlert('Fehler', err.message); }
  }

  async function handleAddFriend() {
    if (!scanInput.trim()) return;
    try {
      const token = await getToken();
      const res = await apiFetch('/friends/add', { method: 'POST', body: JSON.stringify({ qrCode: scanInput.trim() }) }, token ?? undefined);
      setScanInput(''); setShowAddF(false);
      showAlert('Anfrage gesendet!', `${res.target?.name} wurde eine Anfrage gesendet.`);
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
      setPending(p => p.filter((f: any) => f.id !== id));
    } catch (err: any) { showAlert('Fehler', err.message); }
  }

  async function handleRemoveFriend(id: string) {
    const ok = await showConfirm('Freund entfernen?');
    if (!ok) return;
    try {
      const token = await getToken();
      await apiFetch(`/friends/${id}`, { method: 'DELETE' }, token ?? undefined);
      setFriends(f => f.filter((fr: any) => fr.friendshipId !== id));
    } catch (err: any) { showAlert('Fehler', err.message); }
  }

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    try {
      const token = await getToken();
      const group = await apiFetch('/friends/groups', {
        method: 'POST', body: JSON.stringify({ name: newGroupName.trim(), color: newGroupColor })
      }, token ?? undefined);
      setGroups((g: any) => [...g, group]);
      setNewGroupName(''); setShowNewGroup(false);
    } catch (err: any) { showAlert('Fehler', err.message); }
  }

  function shareMyQR() {
    if (!myQrCode) { showAlert('Fehler', 'QR-Code wird geladen...'); return; }
    const msg = `Füge mich bei Trailtag als Freund hinzu!\n\nMein Code: ${myQrCode}`;
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        navigator.share({ title: 'Trailtag Freundschaft', text: msg }).catch(() => {});
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(myQrCode);
        showAlert('Code kopiert!', myQrCode);
      }
    } else {
      const { Share } = require('react-native');
      Share.share({ message: msg });
    }
  }

  if (loading) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <Mountain size={48} color="#2c694e" strokeWidth={1.5}/>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header — same style as Dashboard/Tours */}
      <View style={[styles.topNav, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topNavLeft}>
          <Mountain size={22} color="#061907" strokeWidth={2.5}/>
          <Text style={styles.logoText}>Trailtag</Text>
        </View>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarLetter}>{name ? name.charAt(0).toUpperCase() : '?'}</Text>
        </View>
      </View>

      {/* Profile hero strip */}
      <View style={styles.profileHero}>
        <View>
          <Text style={styles.profileName}>{name || 'Mein Profil'}</Text>
          <Text style={styles.profileEmail}>{profile?.email}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {(['profil','notfall','freunde'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabTxt, tab === t && styles.tabTxtActive]}>
              {t === 'profil' ? 'Profil' : t === 'notfall' ? 'Notfall' : `Freunde${pending.length > 0 ? ` (${pending.length})` : ''}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

        {/* ── PROFIL TAB ── */}
        {tab === 'profil' && (<>
          <Text style={styles.sectionLabel}>PERSÖNLICHE DATEN</Text>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>NAME</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor="#c3c8bf"/>
            <Text style={styles.fieldLabel}>TELEFON</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+41 79 123 45 67" placeholderTextColor="#c3c8bf" keyboardType="phone-pad"/>
            <Text style={styles.fieldLabel}>GEBURTSJAHR</Text>
            <TextInput style={styles.input} value={birthYear} onChangeText={setBirthYear} placeholder="1990" placeholderTextColor="#c3c8bf" keyboardType="numeric"/>
          </View>

          <Text style={[styles.sectionLabel, {marginTop:20}]}>MEDIZINISCHE INFOS</Text>
          <Text style={styles.sectionHint}>Im Alarmfall für Rettungskräfte sichtbar</Text>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>BLUTGRUPPE</Text>
            <View style={styles.chipRow}>
              {BLOOD_TYPES.map(bt => (
                <TouchableOpacity key={bt} style={[styles.chip, bloodType===bt && styles.chipOn]} onPress={() => setBloodType(bt===bloodType?'':bt)}>
                  <Text style={[styles.chipTxt, bloodType===bt && styles.chipTxtOn]}>{bt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>ALLERGIEN</Text>
            <TextInput style={[styles.input,{height:64}]} value={allergies} onChangeText={setAllergies} multiline placeholder="z.B. Penicillin, Nüsse" placeholderTextColor="#c3c8bf"/>
            <Text style={styles.fieldLabel}>MEDIKAMENTE</Text>
            <TextInput style={[styles.input,{height:64}]} value={medications} onChangeText={setMedications} multiline placeholder="z.B. Blutverdünner 5mg" placeholderTextColor="#c3c8bf"/>
            <Text style={styles.fieldLabel}>WEITERE HINWEISE</Text>
            <TextInput style={[styles.input,{height:64}]} value={medicalNotes} onChangeText={setMedicalNotes} multiline placeholder="z.B. Herzschrittmacher, Diabetes" placeholderTextColor="#c3c8bf"/>
          </View>

          <TouchableOpacity style={[styles.primaryBtn, saving&&{opacity:0.6}]} onPress={handleSave} disabled={saving}>
            <Text style={styles.primaryBtnTxt}>{saving?'Speichert...':'Profil speichern'}</Text>
          </TouchableOpacity>

          {/* QR Privacy Settings */}
          <Text style={[styles.sectionLabel,{marginTop:20}]}>DATENSCHUTZ — QR-PORTAL</Text>
          <Text style={styles.sectionHint}>Was darf im Ersthelfer-Portal bei aktiver Tour angezeigt werden?</Text>
          <View style={styles.card}>
            {[
              { label: 'Name & Telefon', val: showName, set: setShowName },
              { label: 'Medizinische Daten', val: showMedical, set: setShowMedical },
              { label: 'Notfallkontakte', val: showContacts, set: setShowContacts },
            ].map(({ label, val, set }) => (
              <View key={label} style={styles.privacyRow}>
                <View style={styles.privacyLeft}>
                  {val ? <Eye size={15} color="#2c694e" strokeWidth={2}/> : <EyeOff size={15} color="#747871" strokeWidth={2}/>}
                  <Text style={styles.privacyLabel}>{label}</Text>
                </View>
                <Switch value={val} onValueChange={set} trackColor={{false:'#e1e3e4',true:'#aeeecb'}} thumbColor={val?'#2c694e':'#fff'}/>
              </View>
            ))}
            <Text style={styles.privacyNote}>Im Alarmfall sind immer alle Daten sichtbar</Text>
          </View>
        </>)}

        {/* ── NOTFALL TAB ── */}
        {tab === 'notfall' && (<>
          <Text style={styles.sectionLabel}>NOTFALLKONTAKTE</Text>
          {(profile?.emergencyContacts?.length ?? 0) === 0 && (
            <Text style={styles.sectionHint}>Noch keine Kontakte. Mindestens einen hinzufügen!</Text>
          )}
          {(profile?.emergencyContacts ?? []).map((c: any) => (
            <View key={c.id} style={styles.contactCard}>
              <View style={[styles.contactAvatar, c.isPrimary && {backgroundColor:'#aeeecb'}]}>
                {c.isPrimary
                  ? <Star size={14} color="#2c694e" strokeWidth={2} fill="#2c694e"/>
                  : <User size={14} color="#747871" strokeWidth={2}/>}
              </View>
              <View style={{flex:1}}>
                <Text style={styles.contactName}>{c.name}</Text>
                <Text style={styles.contactMeta}>{c.relation ? `${c.relation} · ` : ''}{c.phone}</Text>
              </View>
              <TouchableOpacity style={styles.iconBtn} onPress={() => {
                setEditingC(c); setNewCName(c.name); setNewCPhone(c.phone); setNewCRelation(c.relation??''); setShowAddC(true);
              }}>
                <Edit3 size={14} color="#2c694e" strokeWidth={2}/>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn,{backgroundColor:'#ffdad6'}]} onPress={() => handleDeleteContact(c.id)}>
                <Trash2 size={14} color="#ba1a1a" strokeWidth={2}/>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.outlineBtn} onPress={() => { setEditingC(null); setNewCName(''); setNewCPhone(''); setNewCRelation(''); setShowAddC(v=>!v); }}>
            <Plus size={15} color="#2c694e" strokeWidth={2}/>
            <Text style={styles.outlineBtnTxt}>Notfallkontakt hinzufügen</Text>
          </TouchableOpacity>

          {showAddC && (
            <View style={[styles.card,{marginTop:8}]}>
              <Text style={styles.cardTitle}>{editingC ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}</Text>
              <Text style={styles.fieldLabel}>NAME *</Text>
              <TextInput style={styles.input} value={newCName} onChangeText={setNewCName} placeholder="z.B. Anna Muster" placeholderTextColor="#c3c8bf"/>
              <Text style={styles.fieldLabel}>TELEFON *</Text>
              <TextInput style={styles.input} value={newCPhone} onChangeText={setNewCPhone} placeholder="+41 79 123 45 67" placeholderTextColor="#c3c8bf" keyboardType="phone-pad"/>
              <Text style={styles.fieldLabel}>BEZIEHUNG</Text>
              <TextInput style={styles.input} value={newCRelation} onChangeText={setNewCRelation} placeholder="z.B. Partner, Mutter" placeholderTextColor="#c3c8bf"/>
              <TouchableOpacity style={[styles.primaryBtn,{marginTop:8},addingC&&{opacity:0.6}]}
                onPress={editingC ? handleEditContact : handleAddContact} disabled={addingC}>
                <Text style={styles.primaryBtnTxt}>{addingC?'Speichert...':editingC?'Speichern':'Hinzufügen'}</Text>
              </TouchableOpacity>
              {editingC && (
                <TouchableOpacity style={{padding:12,alignItems:'center'}} onPress={() => { setShowAddC(false); setEditingC(null); }}>
                  <Text style={{color:'#747871',fontWeight:'600'}}>Abbrechen</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Friends as emergency contacts */}
          {friends.length > 0 && (<>
            <Text style={[styles.sectionLabel,{marginTop:20}]}>AUS FREUNDESLISTE</Text>
            <Text style={styles.sectionHint}>Diese Freunde können bei Alarmtouren benachrichtigt werden</Text>
            {friends.map((f: any) => (
              <View key={f.friendshipId} style={[styles.contactCard,{opacity:0.8}]}>
                <View style={[styles.contactAvatar,{backgroundColor:'#f0faf4'}]}>
                  <Users size={14} color="#2c694e" strokeWidth={2}/>
                </View>
                <View style={{flex:1}}>
                  <Text style={styles.contactName}>{f.name}</Text>
                  <Text style={styles.contactMeta}>{f.phone ?? 'Kein Telefon'}</Text>
                </View>
                <View style={{backgroundColor:'#f0faf4',paddingHorizontal:8,paddingVertical:4,borderRadius:100}}>
                  <Text style={{fontSize:10,fontWeight:'700',color:'#2c694e'}}>Freund</Text>
                </View>
              </View>
            ))}
          </>)}
        </>)}

        {/* ── FREUNDE TAB ── */}
        {tab === 'freunde' && (<>
          {/* My QR Code */}
          <View style={styles.qrCard}>
            <View style={styles.qrCardLeft}>
              <QrCode size={32} color="#2c694e" strokeWidth={1.8}/>
            </View>
            <View style={{flex:1}}>
              <Text style={styles.qrTitle}>Mein Trailtag-Code</Text>
              <Text style={styles.qrCode}>{myQrCode?.slice(0,8).toUpperCase() ?? '...'}</Text>
              <Text style={styles.qrSub}>Teilen damit Freunde mich finden</Text>
            </View>
            <TouchableOpacity style={styles.shareBtn} onPress={shareMyQR}>
              <Text style={styles.shareBtnTxt}>Teilen</Text>
            </TouchableOpacity>
          </View>

          {/* Pending requests */}
          {pending.length > 0 && (<>
            <Text style={styles.sectionLabel}>AUSSTEHENDE ANFRAGEN</Text>
            {pending.map((f: any) => (
              <View key={f.id} style={[styles.contactCard,{borderLeftWidth:3,borderLeftColor:'#f59e0b'}]}>
                <View style={[styles.contactAvatar,{backgroundColor:'#fef3c7'}]}>
                  <User size={14} color="#92400e" strokeWidth={2}/>
                </View>
                <View style={{flex:1}}>
                  <Text style={styles.contactName}>{f.initiator?.name}</Text>
                  <Text style={styles.contactMeta}>Freundschaftsanfrage</Text>
                </View>
                <TouchableOpacity style={[styles.iconBtn,{backgroundColor:'#aeeecb'}]} onPress={() => handleAccept(f.id)}>
                  <Check size={14} color="#2c694e" strokeWidth={2.5}/>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn,{backgroundColor:'#ffdad6'}]} onPress={() => handleDecline(f.id)}>
                  <X size={14} color="#ba1a1a" strokeWidth={2.5}/>
                </TouchableOpacity>
              </View>
            ))}
          </>)}

          {/* Add friend */}
          <TouchableOpacity style={styles.outlineBtn} onPress={() => setShowAddF(v=>!v)}>
            <UserPlus size={15} color="#2c694e" strokeWidth={2}/>
            <Text style={styles.outlineBtnTxt}>Freund per Code hinzufügen</Text>
          </TouchableOpacity>
          {showAddF && (
            <View style={[styles.card,{marginTop:8}]}>
              <Text style={styles.cardTitle}>Trailtag-Code eingeben</Text>
              <TextInput style={styles.input} value={scanInput} onChangeText={setScanInput}
                placeholder="Code des Freundes..." placeholderTextColor="#c3c8bf" autoCapitalize="none"/>
              <TouchableOpacity style={[styles.primaryBtn,{marginTop:8}]} onPress={handleAddFriend}>
                <Text style={styles.primaryBtnTxt}>Anfrage senden</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Groups */}
          <Text style={[styles.sectionLabel,{marginTop:20}]}>GRUPPEN</Text>
          {groups.map((g: any) => (
            <View key={g.id} style={[styles.groupRow,{borderLeftColor:g.color}]}>
              <View style={[styles.groupDot,{backgroundColor:g.color}]}/>
              <Text style={styles.groupName}>{g.name}</Text>
              <Text style={styles.groupCount}>{friends.filter((f:any)=>f.groupId===g.id).length} Freunde</Text>
            </View>
          ))}
          <TouchableOpacity style={styles.outlineBtn} onPress={() => setShowNewGroup(v=>!v)}>
            <Plus size={15} color="#2c694e" strokeWidth={2}/>
            <Text style={styles.outlineBtnTxt}>Gruppe erstellen</Text>
          </TouchableOpacity>
          {showNewGroup && (
            <View style={[styles.card,{marginTop:8}]}>
              <Text style={styles.cardTitle}>Neue Gruppe</Text>
              <Text style={styles.fieldLabel}>NAME</Text>
              <TextInput style={styles.input} value={newGroupName} onChangeText={setNewGroupName} placeholder="z.B. Familie, Bergkollegen" placeholderTextColor="#c3c8bf"/>
              <Text style={styles.fieldLabel}>FARBE</Text>
              <View style={{flexDirection:'row',gap:10,marginBottom:12,marginTop:4}}>
                {GROUP_COLORS.map(gc => (
                  <TouchableOpacity key={gc} onPress={() => setNewGroupColor(gc)}
                    style={[styles.colorDot,{backgroundColor:gc,borderWidth:newGroupColor===gc?3:0,borderColor:'#fff',elevation:newGroupColor===gc?4:0}]}/>
                ))}
              </View>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateGroup}>
                <Text style={styles.primaryBtnTxt}>Erstellen</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Friends list */}
          <Text style={[styles.sectionLabel,{marginTop:20}]}>MEINE FREUNDE ({friends.length})</Text>
          {friends.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={{fontSize:28,marginBottom:8}}>👥</Text>
              <Text style={styles.emptyTitle}>Noch keine Freunde</Text>
              <Text style={styles.emptySub}>Teile deinen Code damit Freunde dich finden können</Text>
            </View>
          ) : friends.map((f: any) => {
            const grp = groups.find((g:any)=>g.id===f.groupId);
            return (
              <View key={f.friendshipId} style={styles.contactCard}>
                <View style={[styles.contactAvatar,grp&&{backgroundColor:grp.color+'22'}]}>
                  <User size={14} color={grp?.color??'#747871'} strokeWidth={2}/>
                </View>
                <View style={{flex:1}}>
                  <Text style={styles.contactName}>{f.name}</Text>
                  <Text style={styles.contactMeta}>{grp?`${grp.name} · `:''}{f.phone??'—'}</Text>
                </View>
                {f.phone ? (
                  <TouchableOpacity style={[styles.iconBtn,{backgroundColor:'#aeeecb'}]}
                    onPress={() => Platform.OS!=='web' ? Linking.openURL(`tel:${f.phone}`) : null}>
                    <Phone size={14} color="#2c694e" strokeWidth={2}/>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={[styles.iconBtn,{backgroundColor:'#ffdad6'}]} onPress={() => handleRemoveFriend(f.friendshipId)}>
                  <Trash2 size={14} color="#ba1a1a" strokeWidth={2}/>
                </TouchableOpacity>
              </View>
            );
          })}
        </>)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  // Header — matches Dashboard
  topNav: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:20, paddingBottom:14, backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#edeeef' },
  topNavLeft: { flexDirection:'row', alignItems:'center', gap:8 },
  logoText: { fontSize:20, fontWeight:'800', color:'#061907', letterSpacing:-0.5 },
  avatarCircle: { width:36, height:36, borderRadius:18, backgroundColor:'#1a2e1a', alignItems:'center', justifyContent:'center' },
  avatarLetter: { fontSize:15, fontWeight:'800', color:'#fff' },
  // Profile hero
  profileHero: { backgroundColor:'#1a2e1a', paddingHorizontal:20, paddingVertical:16 },
  profileName: { fontSize:20, fontWeight:'800', color:'#fff', letterSpacing:-0.3 },
  profileEmail: { fontSize:12, color:'rgba(255,255,255,0.55)', marginTop:2 },
  // Tabs
  tabBar: { flexDirection:'row', backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#e1e3e4' },
  tab: { flex:1, alignItems:'center', justifyContent:'center', paddingVertical:12 },
  tabActive: { borderBottomWidth:2, borderBottomColor:'#2c694e' },
  tabTxt: { fontSize:12, fontWeight:'600', color:'#747871' },
  tabTxtActive: { color:'#2c694e', fontWeight:'800' },
  scroll: { flex:1 },
  // Common
  sectionLabel: { fontSize:10, fontWeight:'700', color:'#747871', letterSpacing:1, marginBottom:8, marginTop:4 },
  sectionHint: { fontSize:12, color:'#c3c8bf', marginBottom:10, lineHeight:18 },
  card: { backgroundColor:'#fff', borderRadius:8, padding:16, borderWidth:1, borderColor:'#e1e3e4', marginBottom:8 },
  cardTitle: { fontSize:14, fontWeight:'800', color:'#061907', marginBottom:12 },
  fieldLabel: { fontSize:10, fontWeight:'700', color:'#747871', letterSpacing:0.8, marginBottom:5, marginTop:10 },
  input: { backgroundColor:'#f8f9fa', borderRadius:6, padding:12, fontSize:14, color:'#191c1d', borderWidth:1, borderColor:'#e1e3e4', marginBottom:4 },
  // Blood type chips
  chipRow: { flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:4 },
  chip: { paddingHorizontal:12, paddingVertical:7, borderRadius:6, backgroundColor:'#f8f9fa', borderWidth:1.5, borderColor:'#e1e3e4' },
  chipOn: { backgroundColor:'#ffdad6', borderColor:'#ba1a1a' },
  chipTxt: { fontSize:13, color:'#434841', fontWeight:'600' },
  chipTxtOn: { color:'#ba1a1a', fontWeight:'700' },
  // Buttons
  primaryBtn: { backgroundColor:'#061907', borderRadius:6, padding:15, alignItems:'center', marginTop:4 },
  primaryBtnTxt: { color:'#fff', fontWeight:'800', fontSize:14 },
  outlineBtn: { flexDirection:'row', alignItems:'center', gap:8, paddingVertical:12 },
  outlineBtnTxt: { fontSize:14, color:'#2c694e', fontWeight:'700' },
  // Contacts
  contactCard: { backgroundColor:'#fff', borderRadius:8, padding:12, flexDirection:'row', alignItems:'center', gap:10, borderWidth:1, borderColor:'#e1e3e4', marginBottom:8 },
  contactAvatar: { width:36, height:36, borderRadius:18, backgroundColor:'#f3f4f5', alignItems:'center', justifyContent:'center' },
  contactName: { fontSize:14, fontWeight:'700', color:'#061907' },
  contactMeta: { fontSize:12, color:'#747871', marginTop:1 },
  iconBtn: { width:34, height:34, borderRadius:8, backgroundColor:'#f0faf4', alignItems:'center', justifyContent:'center' },
  // Privacy
  privacyRow: { flexDirection:'row', alignItems:'center', paddingVertical:12, borderBottomWidth:1, borderBottomColor:'#f3f4f5' },
  privacyLeft: { flex:1, flexDirection:'row', alignItems:'center', gap:10 },
  privacyLabel: { fontSize:14, color:'#191c1d', fontWeight:'600' },
  privacyNote: { fontSize:11, color:'#2c694e', marginTop:10, fontStyle:'italic' },
  // QR
  qrCard: { backgroundColor:'#fff', borderRadius:8, borderWidth:1, borderColor:'#aeeecb', padding:16, flexDirection:'row', alignItems:'center', gap:14, marginBottom:16 },
  qrCardLeft: { width:52, height:52, backgroundColor:'#f0faf4', borderRadius:8, alignItems:'center', justifyContent:'center' },
  qrTitle: { fontSize:13, fontWeight:'800', color:'#061907' },
  qrCode: { fontSize:16, fontWeight:'900', color:'#2c694e', fontFamily:'monospace', letterSpacing:1, marginTop:2 },
  qrSub: { fontSize:11, color:'#747871', marginTop:2 },
  shareBtn: { backgroundColor:'#1a2e1a', paddingHorizontal:14, paddingVertical:9, borderRadius:6 },
  shareBtnTxt: { fontSize:12, fontWeight:'800', color:'#fff' },
  // Groups
  groupRow: { backgroundColor:'#fff', borderRadius:8, borderWidth:1, borderColor:'#e1e3e4', borderLeftWidth:4, flexDirection:'row', alignItems:'center', gap:10, padding:12, marginBottom:8 },
  groupDot: { width:10, height:10, borderRadius:5 },
  groupName: { fontSize:13, fontWeight:'700', color:'#061907', flex:1 },
  groupCount: { fontSize:11, color:'#747871' },
  colorDot: { width:28, height:28, borderRadius:14 },
  // Empty
  emptyBox: { alignItems:'center', padding:32, backgroundColor:'#fff', borderRadius:8, borderWidth:1, borderColor:'#e1e3e4' },
  emptyTitle: { fontSize:15, fontWeight:'700', color:'#434841' },
  emptySub: { fontSize:12, color:'#747871', textAlign:'center', marginTop:4, lineHeight:18 },
});

