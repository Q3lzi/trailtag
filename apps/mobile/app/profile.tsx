import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Platform, Linking, Switch } from 'react-native';
import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { apiFetch } from '../lib/api';
import { getToken } from '../lib/storage';
import { showAlert, showConfirm } from '../lib/alert';
import {
  Mountain, User, Phone, Users, Plus, Trash2, Edit3,
  QrCode, UserPlus, Check, X, ChevronRight, Star, Share2
} from 'lucide-react-native';

const BLOOD_TYPES = ['A+','A-','B+','B-','AB+','AB-','0+','0-'];
const GROUP_COLORS = ['#2c694e','#1d4ed8','#dc2626','#ea580c','#7c3aed','#0891b2'];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'profil'|'freunde'>('profil');

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

  const [newCName, setNewCName] = useState('');
  const [newCPhone, setNewCPhone] = useState('');
  const [newCRelation, setNewCRelation] = useState('');
  const [addingC, setAddingC] = useState(false);
  const [editingC, setEditingC] = useState<any>(null);
  const [showAddC, setShowAddC] = useState(false);

  const [friends, setFriends] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [myQrCode, setMyQrCode] = useState<string|null>(null);
  const [friendCode, setFriendCode] = useState('');
  const [showAddF, setShowAddF] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#2c694e');
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [addingF, setAddingF] = useState(false);

  // Privacy settings (loaded from profile)
  const [privacyShowName, setPrivacyShowName] = useState(true);
  const [privacyShowPhone, setPrivacyShowPhone] = useState(true);
  const [privacyShowMedical, setPrivacyShowMedical] = useState(false);
  const [privacyShowContacts, setPrivacyShowContacts] = useState(true);
  const [privacyShowGps, setPrivacyShowGps] = useState(false);
  const [privacyShowNotes, setPrivacyShowNotes] = useState(false);

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
      setName(data.name ?? '');
      setPhone(data.phone ?? '');
      setBirthYear(data.birthYear ? String(data.birthYear) : '');
      setBloodType(data.bloodType ?? '');
      setAllergies(data.allergies ?? '');
      setMedications(data.medications ?? '');
      setMedicalNotes(data.medicalNotes ?? '');
      setFriends(friendData.friends ?? []);
      setPending(friendData.pending ?? []);
      setGroups(friendData.groups ?? []);
      setMyQrCode(qrData.qrCode ?? null);
      if (data.privacyShowName !== undefined) setPrivacyShowName(data.privacyShowName);
      if (data.privacyShowPhone !== undefined) setPrivacyShowPhone(data.privacyShowPhone);
      if (data.privacyShowMedical !== undefined) setPrivacyShowMedical(data.privacyShowMedical);
      if (data.privacyShowContacts !== undefined) setPrivacyShowContacts(data.privacyShowContacts);
      if (data.privacyShowGps !== undefined) setPrivacyShowGps(data.privacyShowGps);
      if (data.privacyShowNotes !== undefined) setPrivacyShowNotes(data.privacyShowNotes);
    } catch (err) { console.log('Ladefehler:', err); }
    finally { setLoading(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const token = await getToken();
      await apiFetch('/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name, phone, birthYear: birthYear ? parseInt(birthYear) : null,
          bloodType, allergies, medications, medicalNotes,
          privacyShowName, privacyShowPhone, privacyShowMedical,
          privacyShowContacts, privacyShowGps, privacyShowNotes,
        }),
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
      if (editingGroup) {
        await apiFetch(`/friends/groups/${editingGroup.id}`, {
          method: 'PUT', body: JSON.stringify({ name: newGroupName.trim(), color: newGroupColor })
        }, token ?? undefined);
        setGroups(g => g.map((gr: any) => gr.id === editingGroup.id ? { ...gr, name: newGroupName.trim(), color: newGroupColor } : gr));
        setEditingGroup(null);
      } else {
        const group = await apiFetch('/friends/groups', {
          method: 'POST', body: JSON.stringify({ name: newGroupName.trim(), color: newGroupColor })
        }, token ?? undefined);
        setGroups(g => [...g, group]);
      }
      setNewGroupName(''); setShowNewGroup(false);
    } catch (err: any) { showAlert('Fehler', err.message); }
  }

  async function handleDeleteGroup(id: string) {
    const ok = await showConfirm('Gruppe löschen?');
    if (!ok) return;
    try {
      const token = await getToken();
      await apiFetch(`/friends/groups/${id}`, { method: 'DELETE' }, token ?? undefined);
      setGroups(g => g.filter((gr: any) => gr.id !== id));
    } catch (err: any) { showAlert('Fehler', err.message); }
  }

  function shareMyQR() {
    if (!myQrCode) { showAlert('Code nicht verfügbar'); return; }
    const msg = `Füge mich bei Trailtag als Freund hinzu!\n\nMein Code: ${myQrCode}`;
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && (navigator as any).share) {
        (navigator as any).share({ title: 'Trailtag', text: msg }).catch(() => {});
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

      {/* Header — weiss wie Dashboard */}
      <View style={[styles.topNav, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topNavLeft}>
          <Mountain size={22} color="#061907" strokeWidth={2.5}/>
          <Text style={styles.logoText}>Trailtag</Text>
        </View>
        <View style={styles.accountBtn}>
          <User size={18} color="#434841" strokeWidth={1.8}/>
        </View>
      </View>

      {/* Profil-Block */}
      <View style={styles.profileBlock}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarLetter}>{name ? name.charAt(0).toUpperCase() : '?'}</Text>
        </View>
        <View style={{flex:1}}>
          <Text style={styles.profileName}>{name || '—'}</Text>
          <Text style={styles.profileEmail}>{profile?.email}</Text>
        </View>
        {myQrCode && (
          <TouchableOpacity style={styles.codeChip} onPress={shareMyQR}>
            <QrCode size={12} color="#2c694e" strokeWidth={2}/>
            <Text style={styles.codeChipTxt}>{myQrCode.slice(0,8).toUpperCase()}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, tab==='profil' && styles.tabActive]} onPress={() => setTab('profil')}>
          <Text style={[styles.tabTxt, tab==='profil' && styles.tabTxtActive]}>Profil</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab==='freunde' && styles.tabActive]} onPress={() => setTab('freunde')}>
          <Text style={[styles.tabTxt, tab==='freunde' && styles.tabTxtActive]}>
            {pending.length > 0 ? `Freunde (${pending.length})` : 'Freunde'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* ══ PROFIL TAB ══ */}
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

          <Text style={[styles.sectionLabel,{marginTop:20}]}>MEDIZINISCHE INFOS</Text>
          <Text style={styles.hint}>Im Alarmfall für Rettungskräfte sichtbar</Text>
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
            <TextInput style={[styles.input,{height:60}]} value={allergies} onChangeText={setAllergies} multiline placeholder="z.B. Penicillin, Nüsse" placeholderTextColor="#c3c8bf"/>
            <Text style={styles.fieldLabel}>MEDIKAMENTE</Text>
            <TextInput style={[styles.input,{height:60}]} value={medications} onChangeText={setMedications} multiline placeholder="z.B. Blutverdünner 5mg" placeholderTextColor="#c3c8bf"/>
            <Text style={styles.fieldLabel}>WEITERE HINWEISE</Text>
            <TextInput style={[styles.input,{height:60}]} value={medicalNotes} onChangeText={setMedicalNotes} multiline placeholder="z.B. Herzschrittmacher, Diabetes" placeholderTextColor="#c3c8bf"/>
          </View>

          <TouchableOpacity style={[styles.primaryBtn, saving&&{opacity:0.6}]} onPress={handleSave} disabled={saving}>
            <Text style={styles.primaryBtnTxt}>{saving ? 'Speichert...' : 'Profil speichern'}</Text>
          </TouchableOpacity>

          <Text style={[styles.sectionLabel,{marginTop:20}]}>NOTFALLKONTAKTE</Text>
          {(profile?.emergencyContacts?.length ?? 0) === 0 && (
            <Text style={styles.hint}>Noch keine Kontakte — mindestens einen hinzufügen!</Text>
          )}
          {(profile?.emergencyContacts ?? []).map((c: any) => (
            <View key={c.id} style={styles.contactCard}>
              <View style={[styles.contactAvatar, c.isPrimary && {backgroundColor:'#aeeecb'}]}>
                {c.isPrimary ? <Star size={14} color="#2c694e" strokeWidth={2} fill="#2c694e"/> : <User size={14} color="#747871" strokeWidth={2}/>}
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

          <TouchableOpacity style={styles.addBtn} onPress={() => { setEditingC(null); setNewCName(''); setNewCPhone(''); setNewCRelation(''); setShowAddC(v=>!v); }}>
            <Plus size={15} color="#2c694e" strokeWidth={2}/>
            <Text style={styles.addBtnTxt}>{showAddC && !editingC ? 'Abbrechen' : 'Notfallkontakt hinzufügen'}</Text>
          </TouchableOpacity>

          {showAddC && (
            <View style={[styles.card,{marginTop:4}]}>
              <Text style={styles.cardTitle}>{editingC ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}</Text>
              <Text style={styles.fieldLabel}>NAME *</Text>
              <TextInput style={styles.input} value={newCName} onChangeText={setNewCName} placeholder="z.B. Anna Muster" placeholderTextColor="#c3c8bf"/>
              <Text style={styles.fieldLabel}>TELEFON *</Text>
              <TextInput style={styles.input} value={newCPhone} onChangeText={setNewCPhone} placeholder="+41 79 123 45 67" placeholderTextColor="#c3c8bf" keyboardType="phone-pad"/>
              <Text style={styles.fieldLabel}>BEZIEHUNG</Text>
              <TextInput style={styles.input} value={newCRelation} onChangeText={setNewCRelation} placeholder="z.B. Partner, Mutter" placeholderTextColor="#c3c8bf"/>
              <TouchableOpacity style={[styles.primaryBtn,{marginTop:8},addingC&&{opacity:0.6}]}
                onPress={editingC ? handleEditContact : handleAddContact} disabled={addingC}>
                <Text style={styles.primaryBtnTxt}>{addingC ? 'Speichert...' : editingC ? 'Speichern' : 'Hinzufügen'}</Text>
              </TouchableOpacity>
              {editingC && (
                <TouchableOpacity style={{padding:10,alignItems:'center'}} onPress={() => { setShowAddC(false); setEditingC(null); }}>
                  <Text style={{color:'#747871',fontWeight:'600'}}>Abbrechen</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

        {/* Datenschutz-Einstellungen */}
          <Text style={[styles.sectionLabel,{marginTop:20}]}>DATENSCHUTZ — QR-PORTAL</Text>
          <Text style={styles.hint}>Was bei aktiver Tour für Ersthelfer sichtbar ist. Im Alarmfall ist alles sichtbar.</Text>
          <View style={styles.card}>
            {([
              { key:'showName', label:'Name', val:privacyShowName, set:setPrivacyShowName },
              { key:'showPhone', label:'Telefonnummer', val:privacyShowPhone, set:setPrivacyShowPhone },
              { key:'showMedical', label:'Medizinische Daten', val:privacyShowMedical, set:setPrivacyShowMedical },
              { key:'showContacts', label:'Notfallkontakte', val:privacyShowContacts, set:setPrivacyShowContacts },
              { key:'showGps', label:'GPS-Standort', val:privacyShowGps, set:setPrivacyShowGps },
              { key:'showNotes', label:'Notizen für Rettungskräfte', val:privacyShowNotes, set:setPrivacyShowNotes },
            ] as Array<{key:string;label:string;val:boolean;set:(v:boolean)=>void}>).map(({key,label,val,set}) => (
              <View key={key} style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#f3f4f5'}}>
                <View style={{flex:1,paddingRight:12}}>
                  <Text style={{fontSize:14,color:'#191c1d',fontWeight:'600'}}>{label}</Text>
                  <Text style={{fontSize:11,color:'#c3c8bf',marginTop:1}}>{val ? 'Sichtbar bei aktiver Tour' : 'Versteckt bei aktiver Tour'}</Text>
                </View>
                <Switch
                  value={val}
                  onValueChange={set}
                  trackColor={{false:'#e1e3e4',true:'#aeeecb'}}
                  thumbColor={val?'#2c694e':'#fff'}
                />
              </View>
            ))}
            <Text style={{fontSize:11,color:'#2c694e',marginTop:10,fontStyle:'italic'}}>Im Alarmfall sind immer alle Daten sichtbar</Text>
          </View>

        </>)}

        {/* ══ FREUNDE TAB ══ */}
        {tab === 'freunde' && (<>

          {/* Mein Code */}
          <Text style={styles.sectionLabel}>MEIN TRAILTAG-CODE</Text>
          <View style={[styles.card,{flexDirection:'row',alignItems:'center',gap:14}]}>
            <View style={styles.qrIconBox}>
              <QrCode size={28} color="#2c694e" strokeWidth={1.8}/>
            </View>
            <View style={{flex:1}}>
              <Text style={styles.myCode}>{myQrCode?.toUpperCase() ?? 'Lädt...'}</Text>
              <Text style={styles.hint}>Freunde geben diesen Code ein</Text>
            </View>
            <TouchableOpacity style={styles.shareBtn} onPress={shareMyQR}>
              <Share2 size={14} color="#fff" strokeWidth={2}/>
            </TouchableOpacity>
          </View>

          {/* Pendente Anfragen */}
          {pending.length > 0 && (<>
            <Text style={[styles.sectionLabel,{marginTop:16}]}>ANFRAGEN ({pending.length})</Text>
            {pending.map((f: any) => (
              <View key={f.id} style={[styles.contactCard,{borderLeftWidth:3,borderLeftColor:'#f59e0b'}]}>
                <View style={[styles.contactAvatar,{backgroundColor:'#fef3c7'}]}>
                  <User size={14} color="#92400e" strokeWidth={2}/>
                </View>
                <View style={{flex:1}}>
                  <Text style={styles.contactName}>{f.initiator?.name ?? '?'}</Text>
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

          {/* Freund hinzufügen */}
          <Text style={[styles.sectionLabel,{marginTop:16}]}>FREUND HINZUFÜGEN</Text>
          <View style={styles.card}>
            <TextInput
              style={styles.input}
              value={friendCode}
              onChangeText={setFriendCode}
              placeholder="Code des Freundes eingeben..."
              placeholderTextColor="#c3c8bf"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={[styles.primaryBtn,{marginTop:8},addingF&&{opacity:0.6}]}
              onPress={handleAddFriend} disabled={addingF}>
              <UserPlus size={15} color="#fff" strokeWidth={2}/>
              <Text style={styles.primaryBtnTxt}>{addingF ? 'Sendet...' : 'Anfrage senden'}</Text>
            </TouchableOpacity>
          </View>

          {/* Gruppen */}
          <Text style={[styles.sectionLabel,{marginTop:16}]}>GRUPPEN</Text>
          {groups.map((g: any) => (
            <View key={g.id} style={[styles.groupRow,{borderLeftColor:g.color}]}>
              <View style={[styles.groupDot,{backgroundColor:g.color}]}/>
              <Text style={styles.groupName}>{g.name}</Text>
              <Text style={styles.groupCount}>{friends.filter((f:any)=>f.groupId===g.id).length}</Text>
              <TouchableOpacity style={styles.iconBtn} onPress={() => {
                setEditingGroup(g); setNewGroupName(g.name); setNewGroupColor(g.color); setShowNewGroup(true);
              }}>
                <Edit3 size={13} color="#2c694e" strokeWidth={2}/>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn,{backgroundColor:'#ffdad6'}]} onPress={() => handleDeleteGroup(g.id)}>
                <Trash2 size={13} color="#ba1a1a" strokeWidth={2}/>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addBtn} onPress={() => { setEditingGroup(null); setNewGroupName(''); setNewGroupColor('#2c694e'); setShowNewGroup(v=>!v); }}>
            <Plus size={15} color="#2c694e" strokeWidth={2}/>
            <Text style={styles.addBtnTxt}>{showNewGroup && !editingGroup ? 'Abbrechen' : 'Gruppe erstellen'}</Text>
          </TouchableOpacity>
          {showNewGroup && (
            <View style={[styles.card,{marginTop:4}]}>
              <Text style={styles.cardTitle}>{editingGroup ? 'Gruppe bearbeiten' : 'Neue Gruppe'}</Text>
              <Text style={styles.fieldLabel}>NAME</Text>
              <TextInput style={styles.input} value={newGroupName} onChangeText={setNewGroupName} placeholder="z.B. Familie" placeholderTextColor="#c3c8bf"/>
              <Text style={styles.fieldLabel}>FARBE</Text>
              <View style={{flexDirection:'row',gap:10,marginTop:6,marginBottom:12}}>
                {GROUP_COLORS.map(gc => (
                  <TouchableOpacity key={gc} onPress={() => setNewGroupColor(gc)}
                    style={[styles.colorDot,{backgroundColor:gc,borderWidth:newGroupColor===gc?3:0,borderColor:'#fff',elevation:newGroupColor===gc?4:0}]}/>
                ))}
              </View>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateGroup}>
                <Text style={styles.primaryBtnTxt}>{editingGroup ? 'Speichern' : 'Erstellen'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Freundesliste */}
          <Text style={[styles.sectionLabel,{marginTop:16}]}>MEINE FREUNDE ({friends.length})</Text>
          {friends.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={{fontSize:28,marginBottom:8}}>👥</Text>
              <Text style={styles.emptyTitle}>Noch keine Freunde</Text>
              <Text style={styles.hint}>Teile deinen Code damit Freunde dich finden</Text>
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
                {f.phone && Platform.OS!=='web' ? (
                  <TouchableOpacity style={[styles.iconBtn,{backgroundColor:'#aeeecb'}]} onPress={() => Linking.openURL(`tel:${f.phone}`)}>
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
  container: { flex:1, backgroundColor:'#f8f9fa' },
  // Header — identisch Dashboard
  topNav: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:20, paddingBottom:16, backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#edeeef' },
  topNavLeft: { flexDirection:'row', alignItems:'center', gap:8 },
  logoText: { fontSize:20, fontWeight:'800', color:'#061907', letterSpacing:-0.5 },
  accountBtn: { width:40, height:40, borderRadius:8, backgroundColor:'#f3f4f5', alignItems:'center', justifyContent:'center' },
  // Profil-Block
  profileBlock: { backgroundColor:'#fff', paddingHorizontal:20, paddingVertical:14, flexDirection:'row', alignItems:'center', gap:12, borderBottomWidth:1, borderBottomColor:'#e1e3e4' },
  profileAvatar: { width:42, height:42, borderRadius:21, backgroundColor:'#1a2e1a', alignItems:'center', justifyContent:'center' },
  profileAvatarLetter: { fontSize:17, fontWeight:'900', color:'#fff' },
  profileName: { fontSize:16, fontWeight:'800', color:'#061907', letterSpacing:-0.2 },
  profileEmail: { fontSize:12, color:'#747871', marginTop:2 },
  codeChip: { flexDirection:'row', alignItems:'center', gap:5, backgroundColor:'#f0faf4', borderRadius:100, paddingHorizontal:10, paddingVertical:5, borderWidth:1, borderColor:'#aeeecb' },
  codeChipTxt: { fontSize:10, fontWeight:'800', color:'#2c694e', fontFamily:'monospace' },
  // Tabs
  tabBar: { flexDirection:'row', backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#e1e3e4' },
  tab: { flex:1, alignItems:'center', paddingVertical:12 },
  tabActive: { borderBottomWidth:2, borderBottomColor:'#2c694e' },
  tabTxt: { fontSize:13, fontWeight:'600', color:'#747871' },
  tabTxtActive: { color:'#2c694e', fontWeight:'800' },
  scroll: { flex:1 },
  scrollContent: { padding:16, paddingBottom:100 },
  // Sections
  sectionLabel: { fontSize:10, fontWeight:'700', color:'#747871', letterSpacing:1, marginBottom:8, marginTop:4 },
  hint: { fontSize:12, color:'#c3c8bf', marginBottom:10, lineHeight:18 },
  // Cards
  card: { backgroundColor:'#fff', borderRadius:8, padding:14, borderWidth:1, borderColor:'#e1e3e4', marginBottom:8 },
  cardTitle: { fontSize:14, fontWeight:'800', color:'#061907', marginBottom:10 },
  fieldLabel: { fontSize:10, fontWeight:'700', color:'#747871', letterSpacing:0.8, marginBottom:5, marginTop:8 },
  input: { backgroundColor:'#f8f9fa', borderRadius:6, padding:11, fontSize:14, color:'#191c1d', borderWidth:1, borderColor:'#e1e3e4', marginBottom:4 },
  // Chips
  chipRow: { flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:4 },
  chip: { paddingHorizontal:11, paddingVertical:6, borderRadius:6, backgroundColor:'#f8f9fa', borderWidth:1.5, borderColor:'#e1e3e4' },
  chipOn: { backgroundColor:'#ffdad6', borderColor:'#ba1a1a' },
  chipTxt: { fontSize:12, color:'#434841', fontWeight:'600' },
  chipTxtOn: { color:'#ba1a1a', fontWeight:'700' },
  // Buttons
  primaryBtn: { backgroundColor:'#061907', borderRadius:6, padding:14, alignItems:'center', flexDirection:'row', justifyContent:'center', gap:8 },
  primaryBtnTxt: { color:'#fff', fontWeight:'800', fontSize:14 },
  addBtn: { flexDirection:'row', alignItems:'center', gap:8, paddingVertical:11 },
  addBtnTxt: { fontSize:14, color:'#2c694e', fontWeight:'700' },
  // Contacts
  contactCard: { backgroundColor:'#fff', borderRadius:8, padding:11, flexDirection:'row', alignItems:'center', gap:10, borderWidth:1, borderColor:'#e1e3e4', marginBottom:8 },
  contactAvatar: { width:36, height:36, borderRadius:18, backgroundColor:'#f3f4f5', alignItems:'center', justifyContent:'center' },
  contactName: { fontSize:14, fontWeight:'700', color:'#061907' },
  contactMeta: { fontSize:12, color:'#747871', marginTop:1 },
  iconBtn: { width:34, height:34, borderRadius:8, backgroundColor:'#f0faf4', alignItems:'center', justifyContent:'center' },
  // QR
  qrIconBox: { width:52, height:52, backgroundColor:'#f0faf4', borderRadius:8, alignItems:'center', justifyContent:'center' },
  myCode: { fontSize:13, fontWeight:'900', color:'#2c694e', fontFamily:'monospace', letterSpacing:1 },
  shareBtn: { width:38, height:38, borderRadius:8, backgroundColor:'#061907', alignItems:'center', justifyContent:'center' },
  // Groups
  groupRow: { backgroundColor:'#fff', borderRadius:8, borderWidth:1, borderColor:'#e1e3e4', borderLeftWidth:4, flexDirection:'row', alignItems:'center', gap:8, padding:11, marginBottom:8 },
  groupDot: { width:10, height:10, borderRadius:5 },
  groupName: { flex:1, fontSize:13, fontWeight:'700', color:'#061907' },
  groupCount: { fontSize:12, color:'#747871', marginRight:4 },
  colorDot: { width:28, height:28, borderRadius:14, shadowColor:'#000' },
  // Empty
  emptyBox: { alignItems:'center', padding:28, backgroundColor:'#fff', borderRadius:8, borderWidth:1, borderColor:'#e1e3e4' },
  emptyTitle: { fontSize:15, fontWeight:'700', color:'#434841', marginBottom:4 },
});
