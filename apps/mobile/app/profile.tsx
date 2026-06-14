import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Platform, Linking, Switch } from 'react-native';
import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { apiFetch } from '../lib/api';
import { getToken } from '../lib/storage';
import { showAlert, showConfirm } from '../lib/alert';
import {
  Mountain, User, Phone, Users, Plus, Trash2, Edit3,
  UserPlus, Check, X, Star, Eye, EyeOff, Share2
} from 'lucide-react-native';
import QRCodeSVG from 'react-native-qrcode-svg';

const BLOOD_TYPES = ['A+','A-','B+','B-','AB+','AB-','0+','0-'];
const GROUP_COLORS = ['#2c694e','#1d4ed8','#dc2626','#ea580c','#7c3aed','#0891b2'];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'profil'|'notfall'|'freunde'>('profil');

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

  // Privacy
  const [showName, setShowName] = useState(true);
  const [showMedical, setShowMedical] = useState(true);
  const [showContacts, setShowContacts] = useState(true);

  // Emergency contacts
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
  const [friendCode, setFriendCode] = useState('');
  const [showAddF, setShowAddF] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#2c694e');
  const [addingF, setAddingF] = useState(false);

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
      showAlert('Gespeichert ✓');
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
        body: JSON.stringify({ name: newCName, phone: newCPhone, relation: newCRelation || null, isPrimary: (profile?.emergencyContacts?.length ?? 0) === 0 }),
      }, token ?? undefined);
      setProfile((p: any) => ({ ...p, emergencyContacts: [...(p.emergencyContacts ?? []), contact] }));
      setNewCName(''); setNewCPhone(''); setNewCRelation(''); setShowAddC(false);
    } catch (err: any) { showAlert('Fehler', err.message); }
    finally { setAddingC(false); }
  }

  async function handleEditContact() {
    if (!newCName || !newCPhone) return;
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
    const code = friendCode.trim();
    if (!code) { showAlert('Fehler', 'Code eingeben'); return; }
    setAddingF(true);
    try {
      const token = await getToken();
      const res = await apiFetch('/friends/add', {
        method: 'POST',
        body: JSON.stringify({ qrCode: code })
      }, token ?? undefined);
      setFriendCode(''); setShowAddF(false);
      showAlert('Anfrage gesendet ✓', `${res.target?.name ?? 'Freund'} wurde eine Anfrage gesendet.`);
    } catch (err: any) { showAlert('Fehler', err.message ?? 'Ungültiger Code'); }
    finally { setAddingF(false); }
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
    if (!myQrCode) { showAlert('Kein Code', 'Code wird noch geladen'); return; }
    const msg = `Füge mich bei Trailtag als Freund hinzu!\n\nCode: ${myQrCode}`;
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && (navigator as any).share) {
        (navigator as any).share({ title: 'Trailtag', text: msg }).catch(() => {});
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(myQrCode);
        showAlert('Code kopiert!');
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

      {/* Header — identisch mit Dashboard */}
      <View style={styles.topNav}>
        <View style={styles.topNavLeft}>
          <Mountain size={22} color="#061907" strokeWidth={2.5}/>
          <Text style={styles.logoText}>Trailtag</Text>
        </View>
      </View>

      {/* Profil-Block — Avatar + Name + Email */}
      <View style={styles.profileBlock}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarLetter}>{name ? name.charAt(0).toUpperCase() : '?'}</Text>
        </View>
        <View style={{flex:1}}>
          <Text style={styles.profileBlockName}>{name || '—'}</Text>
          <Text style={styles.profileBlockEmail}>{profile?.email}</Text>
        </View>
      </View>

      {/* ── TABS ── */}
      <View style={styles.tabBar}>
        {[
          { key: 'profil', label: 'Profil' },
          { key: 'notfall', label: 'Notfall' },
          { key: 'freunde', label: pending.length > 0 ? `Freunde (${pending.length})` : 'Freunde' },
        ].map(t => (
          <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key as any)}>
            <Text style={[styles.tabTxt, tab === t.key && styles.tabTxtActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* ══════════ PROFIL TAB ══════════ */}
        {tab === 'profil' && (<>

          <Text style={styles.sectionLabel}>PERSÖNLICHE DATEN</Text>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>NAME</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor="#c3c8bf"/>
            <Text style={styles.fieldLabel}>TELEFON</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone}
              placeholder="+41 79 123 45 67" placeholderTextColor="#c3c8bf" keyboardType="phone-pad"/>
            <Text style={styles.fieldLabel}>GEBURTSJAHR</Text>
            <TextInput style={styles.input} value={birthYear} onChangeText={setBirthYear}
              placeholder="1990" placeholderTextColor="#c3c8bf" keyboardType="numeric"/>
          </View>

          <Text style={[styles.sectionLabel, {marginTop:20}]}>MEDIZINISCHE INFORMATIONEN</Text>
          <Text style={styles.hint}>Im Alarmfall für Rettungskräfte sichtbar</Text>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>BLUTGRUPPE</Text>
            <View style={styles.chipRow}>
              {BLOOD_TYPES.map(bt => (
                <TouchableOpacity key={bt}
                  style={[styles.chip, bloodType===bt && styles.chipOn]}
                  onPress={() => setBloodType(bt===bloodType ? '' : bt)}>
                  <Text style={[styles.chipTxt, bloodType===bt && styles.chipTxtOn]}>{bt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>ALLERGIEN</Text>
            <TextInput style={[styles.input,{height:60}]} value={allergies} onChangeText={setAllergies}
              multiline placeholder="z.B. Penicillin, Nüsse" placeholderTextColor="#c3c8bf"/>
            <Text style={styles.fieldLabel}>MEDIKAMENTE</Text>
            <TextInput style={[styles.input,{height:60}]} value={medications} onChangeText={setMedications}
              multiline placeholder="z.B. Blutverdünner 5mg" placeholderTextColor="#c3c8bf"/>
            <Text style={styles.fieldLabel}>WEITERE HINWEISE</Text>
            <TextInput style={[styles.input,{height:60}]} value={medicalNotes} onChangeText={setMedicalNotes}
              multiline placeholder="z.B. Herzschrittmacher, Diabetes" placeholderTextColor="#c3c8bf"/>
          </View>

          <TouchableOpacity style={[styles.primaryBtn, saving&&{opacity:0.6}]}
            onPress={handleSave} disabled={saving}>
            <Text style={styles.primaryBtnTxt}>{saving ? 'Speichert...' : 'Profil speichern'}</Text>
          </TouchableOpacity>

          {/* Privacy */}
          <Text style={[styles.sectionLabel, {marginTop:20}]}>DATENSCHUTZ — QR-PORTAL</Text>
          <Text style={styles.hint}>Was bei aktiver Tour (kein Alarm) sichtbar ist</Text>
          <View style={styles.card}>
            {([
              ['Name & Telefon sichtbar', showName, setShowName],
              ['Medizinische Daten sichtbar', showMedical, setShowMedical],
              ['Notfallkontakte sichtbar', showContacts, setShowContacts],
            ] as [string, boolean, (v: boolean) => void][]).map(([label, val, set]) => (
              <View key={label} style={styles.switchRow}>
                {val
                  ? <Eye size={15} color="#2c694e" strokeWidth={2}/>
                  : <EyeOff size={15} color="#c3c8bf" strokeWidth={2}/>}
                <Text style={styles.switchLabel}>{label}</Text>
                <Switch value={val} onValueChange={set}
                  trackColor={{false:'#e1e3e4', true:'#aeeecb'}}
                  thumbColor={val ? '#2c694e' : '#fff'}/>
              </View>
            ))}
            <Text style={styles.privacyNote}>⚠️ Im Alarmfall sind immer alle Daten sichtbar</Text>
          </View>

        </>)}

        {/* ══════════ NOTFALL TAB ══════════ */}
        {tab === 'notfall' && (<>

          <Text style={styles.sectionLabel}>NOTFALLKONTAKTE</Text>
          {(profile?.emergencyContacts?.length ?? 0) === 0 && (
            <Text style={styles.hint}>Noch keine Kontakte — mindestens einen hinzufügen!</Text>
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
                <Text style={styles.contactMeta}>
                  {c.relation ? `${c.relation} · ` : ''}{c.phone}
                </Text>
              </View>
              <TouchableOpacity style={styles.iconBtn} onPress={() => {
                setEditingC(c); setNewCName(c.name); setNewCPhone(c.phone);
                setNewCRelation(c.relation ?? ''); setShowAddC(true);
              }}>
                <Edit3 size={14} color="#2c694e" strokeWidth={2}/>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn,{backgroundColor:'#ffdad6'}]}
                onPress={() => handleDeleteContact(c.id)}>
                <Trash2 size={14} color="#ba1a1a" strokeWidth={2}/>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.outlineBtn}
            onPress={() => { setEditingC(null); setNewCName(''); setNewCPhone(''); setNewCRelation(''); setShowAddC(v=>!v); }}>
            <Plus size={15} color="#2c694e" strokeWidth={2}/>
            <Text style={styles.outlineBtnTxt}>Notfallkontakt {showAddC && !editingC ? 'schliessen' : 'hinzufügen'}</Text>
          </TouchableOpacity>

          {showAddC && (
            <View style={[styles.card,{marginTop:8}]}>
              <Text style={styles.cardTitle}>{editingC ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}</Text>
              <Text style={styles.fieldLabel}>NAME *</Text>
              <TextInput style={styles.input} value={newCName} onChangeText={setNewCName}
                placeholder="z.B. Anna Muster" placeholderTextColor="#c3c8bf"/>
              <Text style={styles.fieldLabel}>TELEFON *</Text>
              <TextInput style={styles.input} value={newCPhone} onChangeText={setNewCPhone}
                placeholder="+41 79 123 45 67" placeholderTextColor="#c3c8bf" keyboardType="phone-pad"/>
              <Text style={styles.fieldLabel}>BEZIEHUNG</Text>
              <TextInput style={styles.input} value={newCRelation} onChangeText={setNewCRelation}
                placeholder="z.B. Partner, Mutter" placeholderTextColor="#c3c8bf"/>
              <TouchableOpacity
                style={[styles.primaryBtn,{marginTop:8},addingC&&{opacity:0.6}]}
                onPress={editingC ? handleEditContact : handleAddContact} disabled={addingC}>
                <Text style={styles.primaryBtnTxt}>
                  {addingC ? 'Speichert...' : editingC ? 'Speichern' : 'Hinzufügen'}
                </Text>
              </TouchableOpacity>
              {editingC && (
                <TouchableOpacity style={{padding:12,alignItems:'center'}}
                  onPress={() => { setShowAddC(false); setEditingC(null); }}>
                  <Text style={{color:'#747871',fontWeight:'600'}}>Abbrechen</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Friends as emergency contacts hint */}
          {friends.length > 0 && (<>
            <Text style={[styles.sectionLabel,{marginTop:20}]}>FREUNDE ({friends.length})</Text>
            <Text style={styles.hint}>Freunde erhalten bei Alarm eine Push-Benachrichtigung</Text>
            {friends.map((f: any) => (
              <View key={f.friendshipId} style={[styles.contactCard,{opacity:0.8}]}>
                <View style={[styles.contactAvatar,{backgroundColor:'#f0faf4'}]}>
                  <Users size={14} color="#2c694e" strokeWidth={2}/>
                </View>
                <View style={{flex:1}}>
                  <Text style={styles.contactName}>{f.name}</Text>
                  <Text style={styles.contactMeta}>{f.phone ?? 'Kein Telefon'}</Text>
                </View>
                <View style={{backgroundColor:'#f0faf4',paddingHorizontal:8,paddingVertical:3,borderRadius:100}}>
                  <Text style={{fontSize:10,fontWeight:'700',color:'#2c694e'}}>Freund</Text>
                </View>
              </View>
            ))}
          </>)}

        </>)}

        {/* ══════════ FREUNDE TAB ══════════ */}
        {tab === 'freunde' && (<>

          {/* My QR Code */}
          <Text style={styles.sectionLabel}>MEIN TRAILTAG-CODE</Text>
          <View style={[styles.card,{alignItems:'center',paddingVertical:24}]}>
            {myQrCode ? (
              Platform.OS !== 'web' ? (
                <View style={styles.qrBox}>
                  <QRCodeSVG
                    value={`trailtag://friend/${myQrCode}`}
                    size={160}
                    color="#061907"
                    backgroundColor="#fff"
                  />
                </View>
              ) : (
                <View style={[styles.qrBox, {padding:20, alignItems:'center'}]}>
                  <View style={{width:160,height:160,backgroundColor:'#f3f4f5',borderRadius:8,alignItems:'center',justifyContent:'center'}}>
                    <Text style={{fontSize:11,color:'#747871',textAlign:'center',marginBottom:8}}>QR-Code</Text>
                    <Text style={{fontSize:13,fontWeight:'800',color:'#061907',fontFamily:'monospace',textAlign:'center',letterSpacing:1}}>{myQrCode.slice(0,8).toUpperCase()}</Text>
                    <Text style={{fontSize:11,color:'#747871',textAlign:'center',marginTop:8}}>Im App scannbar</Text>
                  </View>
                </View>
              )
            ) : (
              <View style={[styles.qrBox,{height:160,justifyContent:'center',alignItems:'center'}]}>
                <Text style={{color:'#c3c8bf'}}>Code wird geladen...</Text>
                <Text style={{color:'#c3c8bf',fontSize:11,marginTop:4}}>DB-Migration nötig</Text>
              </View>
            )}
            <Text style={styles.qrCodeText}>{myQrCode?.slice(0,8).toUpperCase() ?? '...'}</Text>
            <Text style={[styles.hint,{textAlign:'center',marginTop:4,marginBottom:16}]}>
              Freunde scannen diesen Code oder geben ihn manuell ein
            </Text>
            <TouchableOpacity style={styles.shareBtn} onPress={shareMyQR}>
              <Share2 size={14} color="#fff" strokeWidth={2}/>
              <Text style={styles.shareBtnTxt}>Code teilen</Text>
            </TouchableOpacity>
          </View>

          {/* Pending requests */}
          {pending.length > 0 && (<>
            <Text style={[styles.sectionLabel,{marginTop:20}]}>AUSSTEHENDE ANFRAGEN ({pending.length})</Text>
            {pending.map((f: any) => (
              <View key={f.id} style={[styles.contactCard,{borderLeftWidth:3,borderLeftColor:'#f59e0b'}]}>
                <View style={[styles.contactAvatar,{backgroundColor:'#fef3c7'}]}>
                  <User size={14} color="#92400e" strokeWidth={2}/>
                </View>
                <View style={{flex:1}}>
                  <Text style={styles.contactName}>{f.initiator?.name ?? '?'}</Text>
                  <Text style={styles.contactMeta}>Freundschaftsanfrage</Text>
                </View>
                <TouchableOpacity style={[styles.iconBtn,{backgroundColor:'#aeeecb'}]}
                  onPress={() => handleAccept(f.id)}>
                  <Check size={14} color="#2c694e" strokeWidth={2.5}/>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn,{backgroundColor:'#ffdad6'}]}
                  onPress={() => handleDecline(f.id)}>
                  <X size={14} color="#ba1a1a" strokeWidth={2.5}/>
                </TouchableOpacity>
              </View>
            ))}
          </>)}

          {/* Add friend by code */}
          <Text style={[styles.sectionLabel,{marginTop:20}]}>FREUND HINZUFÜGEN</Text>
          <View style={styles.card}>
            <Text style={styles.hint}>Code des Freundes eingeben (aus seinem Profil)</Text>
            <TextInput
              style={[styles.input,{marginTop:8,fontFamily:'monospace'}]}
              value={friendCode}
              onChangeText={setFriendCode}
              placeholder="z.B. A3F8B2C1-..."
              placeholderTextColor="#c3c8bf"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.primaryBtn,{marginTop:8},addingF&&{opacity:0.6}]}
              onPress={handleAddFriend}
              disabled={addingF}>
              <UserPlus size={15} color="#fff" strokeWidth={2}/>
              <Text style={styles.primaryBtnTxt}>{addingF ? 'Sendet...' : 'Anfrage senden'}</Text>
            </TouchableOpacity>
          </View>

          {/* Groups */}
          {groups.length > 0 && (<>
            <Text style={[styles.sectionLabel,{marginTop:20}]}>GRUPPEN</Text>
            {groups.map((g: any) => (
              <View key={g.id} style={[styles.groupRow,{borderLeftColor:g.color}]}>
                <View style={[styles.groupDot,{backgroundColor:g.color}]}/>
                <Text style={styles.groupName}>{g.name}</Text>
                <Text style={styles.groupCount}>
                  {friends.filter((f:any)=>f.groupId===g.id).length} Freunde
                </Text>
              </View>
            ))}
          </>)}
          <TouchableOpacity style={styles.outlineBtn} onPress={() => setShowNewGroup(v=>!v)}>
            <Plus size={15} color="#2c694e" strokeWidth={2}/>
            <Text style={styles.outlineBtnTxt}>Gruppe erstellen</Text>
          </TouchableOpacity>
          {showNewGroup && (
            <View style={[styles.card,{marginTop:8}]}>
              <Text style={styles.fieldLabel}>GRUPPENNAME</Text>
              <TextInput style={styles.input} value={newGroupName} onChangeText={setNewGroupName}
                placeholder="z.B. Familie, Bergkollegen" placeholderTextColor="#c3c8bf"/>
              <Text style={styles.fieldLabel}>FARBE</Text>
              <View style={{flexDirection:'row',gap:10,marginBottom:12,marginTop:4}}>
                {GROUP_COLORS.map(gc => (
                  <TouchableOpacity key={gc} onPress={() => setNewGroupColor(gc)}
                    style={[styles.colorDot,{backgroundColor:gc,
                      borderWidth:newGroupColor===gc?3:0,borderColor:'#fff',
                      shadowOpacity:newGroupColor===gc?0.3:0,shadowRadius:4,elevation:newGroupColor===gc?4:0}]}/>
                ))}
              </View>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateGroup}>
                <Text style={styles.primaryBtnTxt}>Erstellen</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Friends list */}
          <Text style={[styles.sectionLabel,{marginTop:20}]}>
            MEINE FREUNDE ({friends.length})
          </Text>
          {friends.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={{fontSize:28,marginBottom:8}}>👥</Text>
              <Text style={styles.emptyTitle}>Noch keine Freunde</Text>
              <Text style={styles.hint}>Teile deinen Code damit Freunde dich finden können</Text>
            </View>
          ) : friends.map((f: any) => {
            const grp = groups.find((g:any)=>g.id===f.groupId);
            return (
              <View key={f.friendshipId} style={styles.contactCard}>
                <View style={[styles.contactAvatar,
                  grp ? {backgroundColor:grp.color+'22'} : {}]}>
                  <User size={14} color={grp?.color ?? '#747871'} strokeWidth={2}/>
                </View>
                <View style={{flex:1}}>
                  <Text style={styles.contactName}>{f.name}</Text>
                  <Text style={styles.contactMeta}>
                    {grp ? `${grp.name} · ` : ''}{f.phone ?? '—'}
                  </Text>
                </View>
                {f.phone && Platform.OS !== 'web' ? (
                  <TouchableOpacity style={[styles.iconBtn,{backgroundColor:'#aeeecb'}]}
                    onPress={() => Linking.openURL(`tel:${f.phone}`)}>
                    <Phone size={14} color="#2c694e" strokeWidth={2}/>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={[styles.iconBtn,{backgroundColor:'#ffdad6'}]}
                  onPress={() => handleRemoveFriend(f.friendshipId)}>
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
  container: { flex:1, backgroundColor:'#f8f9fa' },

  // Header — identisch mit Dashboard
  topNav: {
    flexDirection:'row', justifyContent:'space-between', alignItems:'center',
    paddingHorizontal:20, paddingTop:18, paddingBottom:16,
    backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#edeeef'
  },
  topNavLeft: { flexDirection:'row', alignItems:'center', gap:8 },
  logoText: { fontSize:20, fontWeight:'800', color:'#061907', letterSpacing:-0.5 },
  avatarCircle: {
    width:36, height:36, borderRadius:18,
    backgroundColor:'#1a2e1a', alignItems:'center', justifyContent:'center'
  },
  avatarLetter: { fontSize:15, fontWeight:'800', color:'#fff' },

  // Profile strip below header

  // Tabs
  tabBar: { flexDirection:'row', backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#e1e3e4' },
  tab: { flex:1, alignItems:'center', paddingVertical:12 },
  tabActive: { borderBottomWidth:2, borderBottomColor:'#2c694e' },
  tabTxt: { fontSize:12, fontWeight:'600', color:'#747871' },
  tabTxtActive: { color:'#2c694e', fontWeight:'800' },

  scroll: { flex:1 },
  scrollContent: { padding:16, paddingBottom:100 },

  // Labels
  sectionLabel: { fontSize:10, fontWeight:'700', color:'#747871', letterSpacing:1, marginBottom:8, marginTop:4 },
  hint: { fontSize:12, color:'#c3c8bf', marginBottom:10, lineHeight:18 },

  // Cards
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
  primaryBtn: { backgroundColor:'#061907', borderRadius:6, padding:15, alignItems:'center', marginTop:4, flexDirection:'row', justifyContent:'center', gap:8 },
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
  switchRow: { flexDirection:'row', alignItems:'center', paddingVertical:12, borderBottomWidth:1, borderBottomColor:'#f3f4f5', gap:10 },
  switchLabel: { flex:1, fontSize:14, color:'#191c1d', fontWeight:'600' },
  privacyNote: { fontSize:11, color:'#2c694e', marginTop:10, fontStyle:'italic' },

  // QR
  qrBox: { backgroundColor:'#fff', padding:12, borderRadius:8, borderWidth:1, borderColor:'#e1e3e4', marginBottom:12 },
  qrCodeText: { fontSize:18, fontWeight:'900', color:'#2c694e', letterSpacing:2, fontFamily:'monospace' },
  shareBtn: { backgroundColor:'#061907', paddingHorizontal:20, paddingVertical:12, borderRadius:6, flexDirection:'row', alignItems:'center', gap:8 },
  shareBtnTxt: { fontSize:13, fontWeight:'800', color:'#fff' },

  // Groups
  groupRow: { backgroundColor:'#fff', borderRadius:8, borderWidth:1, borderColor:'#e1e3e4', borderLeftWidth:4, flexDirection:'row', alignItems:'center', gap:10, padding:12, marginBottom:8 },
  groupDot: { width:10, height:10, borderRadius:5 },
  groupName: { fontSize:13, fontWeight:'700', color:'#061907', flex:1 },
  groupCount: { fontSize:11, color:'#747871' },
  colorDot: { width:28, height:28, borderRadius:14, shadowColor:'#000' },

  // Empty
  emptyBox: { alignItems:'center', padding:32, backgroundColor:'#fff', borderRadius:8, borderWidth:1, borderColor:'#e1e3e4' },
  emptyTitle: { fontSize:15, fontWeight:'700', color:'#434841', marginBottom:4 },
});
