import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Switch, Modal, ActivityIndicator } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, Linking } from 'react-native';
import { router } from 'expo-router';
import { apiFetch } from '../lib/api';
import { getToken } from '../lib/storage';
import { showAlert, showConfirm } from '../lib/alert';
import {
  Mountain, User, Phone, Users, Plus, Trash2, Edit3,
  QrCode, UserPlus, Check, X, Share2, Scan, ChevronDown,
  Shield, Heart, Bell, LogOut
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';

import { Platform as RNPlatform } from 'react-native';
let CameraView: any = null;
let useCameraPermissions: any = () => [{ granted: false }, async () => ({ granted: false })];
if (RNPlatform.OS !== 'web') {
  try { const c = require('expo-camera'); CameraView = c.CameraView; useCameraPermissions = c.useCameraPermissions; } catch {}
}

const BLOOD_TYPES = ['A+','A-','B+','B-','AB+','AB-','0+','0-'];
const GROUP_COLORS = ['#2c694e','#1d4ed8','#dc2626','#ea580c','#7c3aed','#0891b2','#374151'];

// ── Auto-save hook ─────────────────────────────────────────────────────────────
function useAutoSave(data: any, enabled: boolean) {
  const timerRef = useRef<any>(null);
  const dataRef = useRef(data);
  const [status, setStatus] = useState<'idle'|'saving'|'saved'>('idle');

  // Keep ref current so the timer callback always uses latest data
  dataRef.current = data;

  useEffect(() => {
    if (!enabled) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setStatus('saving');
      try {
        const token = await getToken();
        await apiFetch('/profile', { method: 'PUT', body: JSON.stringify(dataRef.current) }, token ?? undefined);
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 2000);
      } catch { setStatus('idle'); }
    }, 1200);
    return () => clearTimeout(timerRef.current);
  }, [JSON.stringify(data), enabled]);

  return status;
}

// ── Group Picker Modal ─────────────────────────────────────────────────────────
function GroupPicker({ visible, groups, onSelect, onClose }: { visible: boolean; groups: any[]; onSelect: (id: string|null) => void; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{flex:1,backgroundColor:'rgba(0,0,0,0.4)'}} onPress={onClose} activeOpacity={1}>
        <View style={{position:'absolute',bottom:0,left:0,right:0,backgroundColor:'#fff',borderTopLeftRadius:16,borderTopRightRadius:16,paddingBottom:32}}>
          <View style={{padding:16,borderBottomWidth:1,borderBottomColor:'#f3f4f5'}}>
            <Text style={{fontSize:16,fontWeight:'800',color:'#061907'}}>Gruppe zuweisen</Text>
          </View>
          <TouchableOpacity style={{flexDirection:'row',alignItems:'center',gap:12,padding:16,borderBottomWidth:1,borderBottomColor:'#f3f4f5'}} onPress={() => { onSelect(null); onClose(); }}>
            <View style={{width:32,height:32,borderRadius:16,backgroundColor:'#f3f4f5',alignItems:'center',justifyContent:'center'}}>
              <X size={14} color="#747871" strokeWidth={2}/>
            </View>
            <Text style={{fontSize:14,color:'#747871'}}>Keine Gruppe</Text>
          </TouchableOpacity>
          {groups.map((g: any) => (
            <TouchableOpacity key={g.id} style={{flexDirection:'row',alignItems:'center',gap:12,padding:16,borderBottomWidth:1,borderBottomColor:'#f3f4f5'}} onPress={() => { onSelect(g.id); onClose(); }}>
              <View style={{width:32,height:32,borderRadius:16,backgroundColor:g.color+'22',alignItems:'center',justifyContent:'center'}}>
                <View style={{width:12,height:12,borderRadius:6,backgroundColor:g.color}}/>
              </View>
              <Text style={{fontSize:14,fontWeight:'600',color:'#061907'}}>{g.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'profil'|'notfall'|'freunde'|'einstellungen'>('profil');
  const [loaded, setLoaded] = useState(false);

  // Profile fields
  const [profile, setProfile] = useState<any>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medications, setMedications] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');

  // Privacy
  const [privacyShowName, setPrivacyShowName] = useState(true);
  const [privacyShowPhone, setPrivacyShowPhone] = useState(true);
  const [privacyShowMedical, setPrivacyShowMedical] = useState(false);
  const [privacyShowContacts, setPrivacyShowContacts] = useState(true);
  const [privacyShowGps, setPrivacyShowGps] = useState(false);
  const [privacyShowNotes, setPrivacyShowNotes] = useState(false);

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
  const [friendCode, setFriendCode] = useState('');
  const [addingF, setAddingF] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [scanPermission, requestScanPermission] = useCameraPermissions();
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#2c694e');
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [groupPickerFriend, setGroupPickerFriend] = useState<any>(null);

  // Auto-save
  const saveData = {
    name, phone, birthYear: birthYear ? parseInt(birthYear) : null,
    bloodType, allergies, medications, medicalNotes,
    privacyShowName, privacyShowPhone, privacyShowMedical,
    privacyShowContacts, privacyShowGps, privacyShowNotes,
  };
  const saveStatus = useAutoSave(saveData, loaded);

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
      if (data.privacyShowName !== undefined) setPrivacyShowName(data.privacyShowName);
      if (data.privacyShowPhone !== undefined) setPrivacyShowPhone(data.privacyShowPhone);
      if (data.privacyShowMedical !== undefined) setPrivacyShowMedical(data.privacyShowMedical);
      if (data.privacyShowContacts !== undefined) setPrivacyShowContacts(data.privacyShowContacts);
      if (data.privacyShowGps !== undefined) setPrivacyShowGps(data.privacyShowGps);
      if (data.privacyShowNotes !== undefined) setPrivacyShowNotes(data.privacyShowNotes);
      setFriends(friendData.friends ?? []);
      setPending(friendData.pending ?? []);
      setGroups(friendData.groups ?? []);
      setMyQrCode(qrData.qrCode ?? null);
      setTimeout(() => setLoaded(true), 100); // delay to prevent immediate save
    } catch (err) { console.log('Ladefehler:', err); }
  }

  // ── Contacts ────────────────────────────────────────────────────────────────
  async function handleAddContact() {
    if (!newCName || !newCPhone) { showAlert('Name und Telefon erforderlich'); return; }
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
    setAddingC(true);
    try {
      const token = await getToken();
      await apiFetch(`/profile/emergency-contacts/${editingC.id}`, {
        method: 'PUT', body: JSON.stringify({ name: newCName, phone: newCPhone, relation: newCRelation || null }),
      }, token ?? undefined);
      setProfile((p: any) => ({ ...p, emergencyContacts: (p.emergencyContacts ?? []).map((c: any) =>
        c.id === editingC.id ? { ...c, name: newCName, phone: newCPhone, relation: newCRelation || null } : c
      )}));
      setEditingC(null); setNewCName(''); setNewCPhone(''); setNewCRelation(''); setShowAddC(false);
    } catch (err: any) { showAlert('Fehler', err.message); }
    finally { setAddingC(false); }
  }

  async function handleDeleteContact(id: string) {
    const ok = await showConfirm('Kontakt löschen?'); if (!ok) return;
    try {
      const token = await getToken();
      await apiFetch(`/profile/emergency-contacts/${id}`, { method: 'DELETE' }, token ?? undefined);
      setProfile((p: any) => ({ ...p, emergencyContacts: (p.emergencyContacts ?? []).filter((c: any) => c.id !== id) }));
    } catch (err: any) { showAlert('Fehler', err.message); }
  }

  // ── Friends ─────────────────────────────────────────────────────────────────
  async function handleAddFriend() {
    const code = friendCode.trim(); if (!code) return;
    setAddingF(true);
    try {
      const token = await getToken();
      const res = await apiFetch('/friends/add', { method: 'POST', body: JSON.stringify({ qrCode: code }) }, token ?? undefined);
      setFriendCode('');
      showAlert('Anfrage gesendet ✓', `${res.target?.name ?? 'Freund'} wurde eine Anfrage gesendet.`);
    } catch (err: any) { showAlert('Fehler', err.message ?? 'Ungültiger Code'); }
    finally { setAddingF(false); }
  }

  async function handleScanQR() {
    if (!scanPermission?.granted) {
      const r = await requestScanPermission();
      if (!r.granted) { showAlert('Kamera-Zugriff verweigert'); return; }
    }
    setScanned(false); setShowScanner(true);
  }

  async function handleBarcodeScanned(data: string) {
    if (scanned) return; setScanned(true); setShowScanner(false);
    const code = data.replace('trailtag://friend/', '').trim();
    setAddingF(true);
    try {
      const token = await getToken();
      const res = await apiFetch('/friends/add', { method: 'POST', body: JSON.stringify({ qrCode: code }) }, token ?? undefined);
      showAlert('Anfrage gesendet ✓', `${res.target?.name ?? 'Freund'} wurde eine Anfrage gesendet.`);
      loadAll();
    } catch (err: any) { showAlert('Fehler', err.message ?? 'Ungültiger QR-Code'); }
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
    const ok = await showConfirm('Freund entfernen?'); if (!ok) return;
    try {
      const token = await getToken();
      await apiFetch(`/friends/${id}`, { method: 'DELETE' }, token ?? undefined);
      setFriends(f => f.filter((fr: any) => fr.friendshipId !== id));
    } catch (err: any) { showAlert('Fehler', err.message); }
  }

  async function handleAssignGroup(friendshipId: string, groupId: string | null) {
    try {
      const token = await getToken();
      await apiFetch(`/friends/${friendshipId}/group`, { method: 'PUT', body: JSON.stringify({ groupId }) }, token ?? undefined);
      setFriends(fs => fs.map((f: any) => f.friendshipId === friendshipId ? { ...f, groupId } : f));
    } catch (err: any) { showAlert('Fehler', err.message); }
  }

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    try {
      const token = await getToken();
      if (editingGroup) {
        await apiFetch(`/friends/groups/${editingGroup.id}`, { method: 'PUT', body: JSON.stringify({ name: newGroupName.trim(), color: newGroupColor }) }, token ?? undefined);
        setGroups(g => g.map((gr: any) => gr.id === editingGroup.id ? { ...gr, name: newGroupName.trim(), color: newGroupColor } : gr));
        setEditingGroup(null);
      } else {
        const group = await apiFetch('/friends/groups', { method: 'POST', body: JSON.stringify({ name: newGroupName.trim(), color: newGroupColor }) }, token ?? undefined);
        setGroups(g => [...g, group]);
      }
      setNewGroupName(''); setShowNewGroup(false);
    } catch (err: any) { showAlert('Fehler', err.message); }
  }

  async function handleDeleteGroup(id: string) {
    const ok = await showConfirm('Gruppe löschen?'); if (!ok) return;
    try {
      const token = await getToken();
      await apiFetch(`/friends/groups/${id}`, { method: 'DELETE' }, token ?? undefined);
      setGroups(g => g.filter((gr: any) => gr.id !== id));
    } catch (err: any) { showAlert('Fehler', err.message); }
  }

  async function savePrivacy(updates: Record<string, boolean>) {
    try {
      const token = await getToken();
      console.log('savePrivacy sending:', JSON.stringify(updates));
      const result = await apiFetch('/profile', { method: 'PUT', body: JSON.stringify(updates) }, token ?? undefined);
      console.log('savePrivacy result:', JSON.stringify(result));
    } catch (err: any) {
      console.log('savePrivacy ERROR:', err.message);
      showAlert('Fehler beim Speichern', err.message);
    }
  }

  function shareMyQR() {
    if (!myQrCode) return;
    const code = myQrCode.slice(0,8).toUpperCase();
    const msg = `Füge mich bei Trailtag als Freund hinzu!\n\nMein Code: ${code}`;
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && (navigator as any).share) (navigator as any).share({ title: 'Trailtag', text: msg }).catch(() => {});
      else if (typeof navigator !== 'undefined' && navigator.clipboard) { navigator.clipboard.writeText(code); showAlert('Code kopiert!', code); }
    } else { const { Share } = require('react-native'); Share.share({ message: msg }); }
  }

  if (!profile) return (
    <View style={[styles.container, {justifyContent:'center',alignItems:'center'}]}>
      <ActivityIndicator color="#2c694e" size="large"/>
    </View>
  );

  const shortCode = myQrCode?.slice(0,8).toUpperCase() ?? null;
  const pendingCount = pending.length;

  return (
    <View style={styles.container}>

      {/* QR Scanner */}
      <Modal visible={showScanner} animationType="slide" onRequestClose={() => setShowScanner(false)}>
        <View style={{flex:1,backgroundColor:'#000'}}>
          <View style={{position:'absolute',top:0,left:0,right:0,zIndex:10,paddingTop:60,paddingHorizontal:20}}>
            <TouchableOpacity onPress={() => setShowScanner(false)}
              style={{alignSelf:'flex-end',backgroundColor:'rgba(0,0,0,0.5)',borderRadius:8,paddingHorizontal:14,paddingVertical:10}}>
              <Text style={{color:'#fff',fontWeight:'700'}}>✕ Schliessen</Text>
            </TouchableOpacity>
            <Text style={{color:'#fff',fontSize:18,fontWeight:'800',textAlign:'center',marginTop:16}}>QR-Code scannen</Text>
            <Text style={{color:'rgba(255,255,255,0.6)',fontSize:13,textAlign:'center',marginTop:6}}>Halte die Kamera auf den Trailtag-Code deines Freundes</Text>
          </View>
          {showScanner && CameraView && (
            <CameraView style={{flex:1}} facing="back" barcodeScannerSettings={{barcodeTypes:['qr']}} onBarcodeScanned={({data}:any) => handleBarcodeScanned(data)}/>
          )}
          <View pointerEvents="none" style={{position:'absolute',top:'50%',left:'50%',width:220,height:220,marginLeft:-110,marginTop:-110}}>
            {[{t:true,l:true},{t:true,r:true},{b:true,l:true},{b:true,r:true}].map((c,i) => (
              <View key={i} style={{position:'absolute',width:28,height:28,...(c as any),
                borderTopWidth:c.t?4:0,borderBottomWidth:c.b?4:0,borderLeftWidth:c.l?4:0,borderRightWidth:c.r?4:0,
                borderColor:'#2c694e',borderRadius:4}}/>
            ))}
          </View>
        </View>
      </Modal>

      {/* Group Picker */}
      <GroupPicker
        visible={!!groupPickerFriend}
        groups={groups}
        onClose={() => setGroupPickerFriend(null)}
        onSelect={(gid) => { if (groupPickerFriend) handleAssignGroup(groupPickerFriend.friendshipId, gid); }}
      />

      {/* Header */}
      <View style={[styles.header, {paddingTop: insets.top + 10}]}>
        <View style={styles.headerLeft}>
          <Mountain size={20} color="#061907" strokeWidth={2.5}/>
          <Text style={styles.headerTitle}>Trailtag</Text>
        </View>
        {saveStatus === 'saving' && <ActivityIndicator size="small" color="#2c694e"/>}
        {saveStatus === 'saved' && <Text style={{fontSize:11,color:'#2c694e',fontWeight:'700'}}>✓ Gespeichert</Text>}
      </View>

      {/* Profile strip */}
      <View style={styles.profileStrip}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>{name ? name[0].toUpperCase() : '?'}</Text>
        </View>
        <View style={{flex:1}}>
          <Text style={styles.profileName}>{name || '—'}</Text>
          <Text style={styles.profileEmail}>{profile.email}</Text>
        </View>
        {shortCode && (
          <TouchableOpacity style={styles.codeChip} onPress={shareMyQR}>
            <QrCode size={10} color="#2c694e" strokeWidth={2.5}/>
            <Text style={styles.codeChipTxt}>{shortCode}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {([
          {id:'profil', label:'Profil'},
          {id:'notfall', label:'Notfall'},
          {id:'freunde', label: pendingCount > 0 ? `Freunde ${pendingCount}` : 'Freunde'},
          {id:'einstellungen', label:'Einstellungen'},
        ] as {id:any,label:string}[]).map(t => (
          <TouchableOpacity key={t.id} style={[styles.tab, tab===t.id && styles.tabActive]} onPress={() => setTab(t.id)}>
            <Text style={[styles.tabTxt, tab===t.id && styles.tabTxtActive]} numberOfLines={1}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{flex:1}} contentContainerStyle={{padding:16,paddingBottom:120}}>

        {/* ══ PROFIL ══ */}
        {tab === 'profil' && (
          <View>
            <Text style={styles.hint}>Änderungen werden automatisch gespeichert.</Text>
            <View style={styles.card}>
              {[
                {label:'Name', val:name, set:setName, placeholder:'Dein Name', type:'default'},
                {label:'Telefon', val:phone, set:setPhone, placeholder:'+41 79 123 45 67', type:'phone-pad'},
                {label:'Geburtsjahr', val:birthYear, set:setBirthYear, placeholder:'1990', type:'numeric'},
              ].map(f => (
                <View key={f.label} style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={f.val}
                    onChangeText={f.set}
                    placeholder={f.placeholder}
                    placeholderTextColor="#c3c8bf"
                    keyboardType={f.type as any}
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ══ NOTFALL ══ */}
        {tab === 'notfall' && (
          <View>
            <Text style={styles.hint}>Diese Daten sehen Rettungskräfte bei einem Alarm.</Text>

            {/* Blood type */}
            <Text style={styles.sectionLabel}>BLUTGRUPPE</Text>
            <View style={styles.chipRow}>
              {BLOOD_TYPES.map(bt => (
                <TouchableOpacity key={bt} style={[styles.chip, bloodType===bt && styles.chipActive]} onPress={() => setBloodType(bt===bloodType?'':bt)}>
                  <Text style={[styles.chipTxt, bloodType===bt && styles.chipTxtActive]}>{bt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionLabel,{marginTop:16}]}>ALLERGIEN</Text>
            <TextInput style={[styles.textArea]} value={allergies} onChangeText={setAllergies} multiline placeholder="z.B. Penicillin, Bienenstiche" placeholderTextColor="#c3c8bf"/>

            <Text style={[styles.sectionLabel,{marginTop:16}]}>MEDIKAMENTE</Text>
            <TextInput style={[styles.textArea]} value={medications} onChangeText={setMedications} multiline placeholder="z.B. Insulin, Blutverdünner" placeholderTextColor="#c3c8bf"/>

            <Text style={[styles.sectionLabel,{marginTop:16}]}>WEITERE HINWEISE</Text>
            <TextInput style={[styles.textArea]} value={medicalNotes} onChangeText={setMedicalNotes} multiline placeholder="z.B. Herzschrittmacher, Diabetes Typ 1" placeholderTextColor="#c3c8bf"/>

            {/* Emergency contacts */}
            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:20,marginBottom:8}}>
              <Text style={styles.sectionLabel}>NOTFALLKONTAKTE</Text>
              <TouchableOpacity onPress={() => { setEditingC(null); setNewCName(''); setNewCPhone(''); setNewCRelation(''); setShowAddC(v=>!v); }}>
                <Plus size={18} color="#2c694e" strokeWidth={2}/>
              </TouchableOpacity>
            </View>
            {(profile?.emergencyContacts?.length ?? 0) === 0 && (
              <Text style={styles.hint}>Noch keine Kontakte hinzugefügt.</Text>
            )}
            {(profile?.emergencyContacts ?? []).map((c: any) => (
              <View key={c.id} style={styles.listRow}>
                <View style={[styles.rowIcon, c.isPrimary && {backgroundColor:'#aeeecb'}]}>
                  <User size={14} color={c.isPrimary?'#2c694e':'#747871'} strokeWidth={2}/>
                </View>
                <View style={{flex:1}}>
                  <Text style={styles.rowTitle}>{c.name}</Text>
                  <Text style={styles.rowSub}>{c.relation ? `${c.relation} · ` : ''}{c.phone}</Text>
                </View>
                <TouchableOpacity style={styles.iconBtn} onPress={() => { setEditingC(c); setNewCName(c.name); setNewCPhone(c.phone); setNewCRelation(c.relation??''); setShowAddC(true); }}>
                  <Edit3 size={13} color="#2c694e" strokeWidth={2}/>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn,{backgroundColor:'#ffdad6',marginLeft:4}]} onPress={() => handleDeleteContact(c.id)}>
                  <Trash2 size={13} color="#ba1a1a" strokeWidth={2}/>
                </TouchableOpacity>
              </View>
            ))}
            {showAddC && (
              <View style={[styles.card,{marginTop:8}]}>
                <Text style={styles.sectionLabel}>{editingC ? 'KONTAKT BEARBEITEN' : 'NEUER KONTAKT'}</Text>
                {[
                  {label:'Name *', val:newCName, set:setNewCName, ph:'Anna Muster', type:'default'},
                  {label:'Telefon *', val:newCPhone, set:setNewCPhone, ph:'+41 79 123 45 67', type:'phone-pad'},
                  {label:'Beziehung', val:newCRelation, set:setNewCRelation, ph:'Partner, Mutter ...', type:'default'},
                ].map(f => (
                  <View key={f.label} style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>{f.label}</Text>
                    <TextInput style={styles.fieldInput} value={f.val} onChangeText={f.set} placeholder={f.ph} placeholderTextColor="#c3c8bf" keyboardType={f.type as any}/>
                  </View>
                ))}
                <View style={{flexDirection:'row',gap:8,marginTop:8}}>
                  <TouchableOpacity style={[styles.primaryBtn,{flex:1},addingC&&{opacity:0.6}]} onPress={editingC ? handleEditContact : handleAddContact} disabled={addingC}>
                    <Text style={styles.primaryBtnTxt}>{addingC ? 'Speichert...' : editingC ? 'Speichern' : 'Hinzufügen'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.ghostBtn} onPress={() => { setShowAddC(false); setEditingC(null); }}>
                    <Text style={styles.ghostBtnTxt}>Abbrechen</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ══ FREUNDE ══ */}
        {tab === 'freunde' && (
          <View>

            {/* My QR */}
            <View style={[styles.card,{alignItems:'center',paddingVertical:20,gap:14}]}>
              {myQrCode ? (
                <View style={{padding:12,backgroundColor:'#fff',borderRadius:12,borderWidth:1,borderColor:'#e1e3e4'}}>
                  <QRCode value={`trailtag://friend/${shortCode}`} size={160} color="#061907" backgroundColor="#fff"/>
                </View>
              ) : (
                <View style={{width:160,height:160,backgroundColor:'#f3f4f5',borderRadius:12,alignItems:'center',justifyContent:'center'}}>
                  <ActivityIndicator color="#2c694e"/>
                </View>
              )}
              <Text style={{fontSize:18,fontWeight:'900',color:'#061907',letterSpacing:3}}>{shortCode ?? '—'}</Text>
              <TouchableOpacity style={[styles.primaryBtn,{paddingHorizontal:24}]} onPress={shareMyQR}>
                <Share2 size={14} color="#fff" strokeWidth={2}/>
                <Text style={styles.primaryBtnTxt}>Code teilen</Text>
              </TouchableOpacity>
            </View>

            {/* Pending */}
            {pendingCount > 0 && (
              <View style={{marginBottom:8}}>
                <Text style={[styles.sectionLabel,{marginTop:8}]}>ANFRAGEN ({pendingCount})</Text>
                {pending.map((f: any) => (
                  <View key={f.id} style={[styles.listRow,{borderLeftWidth:3,borderLeftColor:'#f59e0b'}]}>
                    <View style={[styles.rowIcon,{backgroundColor:'#fef3c7'}]}>
                      <User size={13} color="#92400e" strokeWidth={2}/>
                    </View>
                    <View style={{flex:1}}>
                      <Text style={styles.rowTitle}>{f.initiator?.name ?? '?'}</Text>
                      <Text style={styles.rowSub}>Freundschaftsanfrage</Text>
                    </View>
                    <TouchableOpacity style={[styles.iconBtn,{backgroundColor:'#aeeecb'}]} onPress={() => handleAccept(f.id)}>
                      <Check size={13} color="#2c694e" strokeWidth={2.5}/>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.iconBtn,{backgroundColor:'#ffdad6',marginLeft:4}]} onPress={() => handleDecline(f.id)}>
                      <X size={13} color="#ba1a1a" strokeWidth={2.5}/>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Add friend */}
            <Text style={[styles.sectionLabel,{marginTop:8}]}>FREUND HINZUFÜGEN</Text>
            <View style={styles.card}>
              {Platform.OS !== 'web' && (
                <TouchableOpacity style={styles.scanBtn} onPress={handleScanQR} disabled={addingF}>
                  <Scan size={18} color="#2c694e" strokeWidth={2}/>
                  <Text style={{fontSize:14,fontWeight:'700',color:'#2c694e'}}>QR-Code scannen</Text>
                </TouchableOpacity>
              )}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine}/><Text style={styles.dividerTxt}>ODER CODE EINGEBEN</Text><View style={styles.dividerLine}/>
              </View>
              <View style={{flexDirection:'row',gap:8}}>
                <TextInput
                  style={[styles.fieldInput,{flex:1}]}
                  value={friendCode}
                  onChangeText={setFriendCode}
                  placeholder="z.B. 00BDB196"
                  placeholderTextColor="#c3c8bf"
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.primaryBtn,{paddingHorizontal:16},(addingF||!friendCode.trim())&&{opacity:0.4}]}
                  onPress={handleAddFriend} disabled={addingF||!friendCode.trim()}>
                  {addingF ? <ActivityIndicator size="small" color="#fff"/> : <UserPlus size={16} color="#fff" strokeWidth={2}/>}
                </TouchableOpacity>
              </View>
            </View>

            {/* Friends list */}
            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:16,marginBottom:8}}>
              <Text style={styles.sectionLabel}>MEINE FREUNDE ({friends.length})</Text>
            </View>

            {/* Group chips */}
            {groups.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:12}}>
                {groups.map((g: any) => (
                  <View key={g.id} style={{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:g.color+'18',borderRadius:100,paddingHorizontal:10,paddingVertical:5,marginRight:8,borderWidth:1,borderColor:g.color+'44'}}>
                    <View style={{width:8,height:8,borderRadius:4,backgroundColor:g.color}}/>
                    <Text style={{fontSize:11,fontWeight:'700',color:g.color}}>{g.name}</Text>
                    <Text style={{fontSize:11,color:g.color+'99'}}>{friends.filter((f:any)=>f.groupId===g.id).length}</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            {friends.length === 0 ? (
              <View style={[styles.card,{alignItems:'center',padding:24}]}>
                <Users size={32} color="#c3c8bf" strokeWidth={1.5}/>
                <Text style={{fontSize:14,fontWeight:'700',color:'#434841',marginTop:10,marginBottom:4}}>Noch keine Freunde</Text>
                <Text style={styles.hint}>Teile deinen Code und verbinde dich</Text>
              </View>
            ) : friends.map((f: any) => {
              const grp = groups.find((g:any) => g.id === f.groupId);
              return (
                <View key={f.friendshipId} style={styles.listRow}>
                  <View style={[styles.rowIcon, grp && {backgroundColor:grp.color+'22'}]}>
                    <User size={14} color={grp?.color ?? '#747871'} strokeWidth={2}/>
                  </View>
                  <View style={{flex:1}}>
                    <Text style={styles.rowTitle}>{f.name}</Text>
                    <Text style={styles.rowSub}>{grp ? grp.name : 'Keine Gruppe'}</Text>
                  </View>
                  <TouchableOpacity style={[styles.iconBtn,{backgroundColor:'#f0faf4'}]} onPress={() => setGroupPickerFriend(f)}>
                    <ChevronDown size={13} color="#2c694e" strokeWidth={2}/>
                  </TouchableOpacity>
                  {f.phone && Platform.OS !== 'web' && (
                    <TouchableOpacity style={[styles.iconBtn,{backgroundColor:'#aeeecb',marginLeft:4}]} onPress={() => Linking.openURL(`tel:${f.phone}`)}>
                      <Phone size={13} color="#2c694e" strokeWidth={2}/>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.iconBtn,{backgroundColor:'#ffdad6',marginLeft:4}]} onPress={() => handleRemoveFriend(f.friendshipId)}>
                    <Trash2 size={13} color="#ba1a1a" strokeWidth={2}/>
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Groups manage */}
            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:20,marginBottom:8}}>
              <Text style={styles.sectionLabel}>GRUPPEN VERWALTEN</Text>
              <TouchableOpacity onPress={() => { setEditingGroup(null); setNewGroupName(''); setNewGroupColor('#2c694e'); setShowNewGroup(v=>!v); }}>
                <Plus size={18} color="#2c694e" strokeWidth={2}/>
              </TouchableOpacity>
            </View>
            {groups.map((g: any) => (
              <View key={g.id} style={[styles.listRow,{borderLeftWidth:3,borderLeftColor:g.color}]}>
                <View style={[styles.rowIcon,{backgroundColor:g.color+'22'}]}>
                  <View style={{width:10,height:10,borderRadius:5,backgroundColor:g.color}}/>
                </View>
                <Text style={{flex:1,fontSize:13,fontWeight:'700',color:'#061907'}}>{g.name}</Text>
                <Text style={{fontSize:12,color:'#747871',marginRight:8}}>{friends.filter((f:any)=>f.groupId===g.id).length}</Text>
                <TouchableOpacity style={styles.iconBtn} onPress={() => { setEditingGroup(g); setNewGroupName(g.name); setNewGroupColor(g.color); setShowNewGroup(true); }}>
                  <Edit3 size={13} color="#2c694e" strokeWidth={2}/>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn,{backgroundColor:'#ffdad6',marginLeft:4}]} onPress={() => handleDeleteGroup(g.id)}>
                  <Trash2 size={13} color="#ba1a1a" strokeWidth={2}/>
                </TouchableOpacity>
              </View>
            ))}
            {showNewGroup && (
              <View style={[styles.card,{marginTop:8}]}>
                <Text style={styles.sectionLabel}>{editingGroup ? 'GRUPPE BEARBEITEN' : 'NEUE GRUPPE'}</Text>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Name</Text>
                  <TextInput style={styles.fieldInput} value={newGroupName} onChangeText={setNewGroupName} placeholder="z.B. Familie" placeholderTextColor="#c3c8bf"/>
                </View>
                <Text style={[styles.fieldLabel,{marginTop:12,marginBottom:8}]}>Farbe</Text>
                <View style={{flexDirection:'row',gap:10,marginBottom:14}}>
                  {GROUP_COLORS.map(gc => (
                    <TouchableOpacity key={gc} onPress={() => setNewGroupColor(gc)}
                      style={{width:28,height:28,borderRadius:14,backgroundColor:gc,borderWidth:newGroupColor===gc?3:0,borderColor:'#fff',elevation:newGroupColor===gc?4:0}}/>
                  ))}
                </View>
                <View style={{flexDirection:'row',gap:8}}>
                  <TouchableOpacity style={[styles.primaryBtn,{flex:1}]} onPress={handleCreateGroup}>
                    <Text style={styles.primaryBtnTxt}>{editingGroup ? 'Speichern' : 'Erstellen'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.ghostBtn} onPress={() => { setShowNewGroup(false); setEditingGroup(null); }}>
                    <Text style={styles.ghostBtnTxt}>Abbrechen</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ══ EINSTELLUNGEN ══ */}
        {tab === 'einstellungen' && (
          <View>
            <Text style={styles.sectionLabel}>DATENSCHUTZ — QR-PORTAL</Text>
            <Text style={styles.hint}>Was Ersthelfer bei aktiver Tour sehen dürfen. Im Alarmfall ist immer alles sichtbar.</Text>
            <View style={styles.card}>
              {([
                {key:'privacyShowName', label:'Name', sub:'Wanderer erkennbar', val:privacyShowName, set:setPrivacyShowName},
                {key:'privacyShowPhone', label:'Telefonnummer', sub:'Direkt anrufbar', val:privacyShowPhone, set:setPrivacyShowPhone},
                {key:'privacyShowMedical', label:'Medizinische Daten', sub:'Blutgruppe, Allergien, Medis', val:privacyShowMedical, set:setPrivacyShowMedical},
                {key:'privacyShowContacts', label:'Notfallkontakte', sub:'Angehörige benachrichtigen', val:privacyShowContacts, set:setPrivacyShowContacts},
                {key:'privacyShowGps', label:'GPS-Standort', sub:'Live-Tracking sichtbar', val:privacyShowGps, set:setPrivacyShowGps},
                {key:'privacyShowNotes', label:'Notizen für Rettungskräfte', sub:'Ausrüstung, Route etc.', val:privacyShowNotes, set:setPrivacyShowNotes},
              ] as any[]).map(({key,label,sub,val,set},i,arr) => (
                <View key={key} style={{flexDirection:'row',alignItems:'center',paddingVertical:13,borderBottomWidth:i<arr.length-1?1:0,borderBottomColor:'#f3f4f5'}}>
                  <View style={{flex:1,paddingRight:12}}>
                    <Text style={{fontSize:14,fontWeight:'600',color:'#191c1d'}}>{label}</Text>
                    <Text style={{fontSize:11,color:'#c3c8bf',marginTop:1}}>{sub}</Text>
                  </View>
                  <Switch value={val} onValueChange={(v) => { set(v); savePrivacy({ [key]: v }); }} trackColor={{false:'#e1e3e4',true:'#aeeecb'}} thumbColor={val?'#2c694e':'#fff'}/>
                </View>
              ))}
              <Text style={{fontSize:11,color:'#2c694e',marginTop:10,fontStyle:'italic'}}>Im Alarmfall sind immer alle Daten sichtbar</Text>
            </View>

            <Text style={[styles.sectionLabel,{marginTop:20}]}>KONTO</Text>
            <TouchableOpacity style={[styles.listRow,{marginBottom:8}]} onPress={async () => {
              const ok = await showConfirm('Abmelden?');
              if (ok) { const { deleteToken } = require('../lib/storage'); await deleteToken(); router.replace('/login'); }
            }}>
              <View style={[styles.rowIcon,{backgroundColor:'#ffdad6'}]}><LogOut size={14} color="#ba1a1a" strokeWidth={2}/></View>
              <Text style={{flex:1,fontSize:14,fontWeight:'600',color:'#ba1a1a'}}>Abmelden</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex:1,backgroundColor:'#f8f9fa'},
  header: {flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:20,paddingBottom:14,backgroundColor:'#fff',borderBottomWidth:1,borderBottomColor:'#edeeef'},
  headerLeft: {flexDirection:'row',alignItems:'center',gap:8},
  headerTitle: {fontSize:19,fontWeight:'800',color:'#061907',letterSpacing:-0.4},
  profileStrip: {backgroundColor:'#fff',paddingHorizontal:20,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:1,borderBottomColor:'#e1e3e4'},
  avatar: {width:40,height:40,borderRadius:20,backgroundColor:'#1a2e1a',alignItems:'center',justifyContent:'center'},
  avatarLetter: {fontSize:16,fontWeight:'900',color:'#fff'},
  profileName: {fontSize:15,fontWeight:'800',color:'#061907'},
  profileEmail: {fontSize:11,color:'#747871',marginTop:1},
  codeChip: {flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'#f0faf4',borderRadius:100,paddingHorizontal:9,paddingVertical:4,borderWidth:1,borderColor:'#aeeecb'},
  codeChipTxt: {fontSize:9,fontWeight:'900',color:'#2c694e',letterSpacing:1},
  tabBar: {flexDirection:'row',backgroundColor:'#fff',borderBottomWidth:1,borderBottomColor:'#e1e3e4'},
  tab: {flex:1,alignItems:'center',paddingVertical:11},
  tabActive: {borderBottomWidth:2,borderBottomColor:'#2c694e'},
  tabTxt: {fontSize:11,fontWeight:'600',color:'#747871'},
  tabTxtActive: {color:'#2c694e',fontWeight:'800'},
  sectionLabel: {fontSize:10,fontWeight:'700',color:'#747871',letterSpacing:1,marginBottom:8},
  hint: {fontSize:12,color:'#c3c8bf',marginBottom:12,lineHeight:18},
  card: {backgroundColor:'#fff',borderRadius:10,padding:14,borderWidth:1,borderColor:'#e1e3e4',marginBottom:8},
  fieldRow: {marginBottom:10},
  fieldLabel: {fontSize:10,fontWeight:'700',color:'#747871',letterSpacing:0.5,marginBottom:5},
  fieldInput: {backgroundColor:'#f8f9fa',borderRadius:8,padding:11,fontSize:14,color:'#191c1d',borderWidth:1,borderColor:'#e1e3e4'},
  textArea: {backgroundColor:'#fff',borderRadius:8,padding:11,fontSize:14,color:'#191c1d',borderWidth:1,borderColor:'#e1e3e4',minHeight:72,textAlignVertical:'top',marginBottom:4},
  chipRow: {flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:4},
  chip: {paddingHorizontal:12,paddingVertical:7,borderRadius:8,backgroundColor:'#f8f9fa',borderWidth:1.5,borderColor:'#e1e3e4'},
  chipActive: {backgroundColor:'#ffdad6',borderColor:'#ba1a1a'},
  chipTxt: {fontSize:13,color:'#434841',fontWeight:'600'},
  chipTxtActive: {color:'#ba1a1a',fontWeight:'800'},
  primaryBtn: {backgroundColor:'#061907',borderRadius:8,padding:13,alignItems:'center',flexDirection:'row',justifyContent:'center',gap:8},
  primaryBtnTxt: {color:'#fff',fontWeight:'800',fontSize:14},
  ghostBtn: {backgroundColor:'#f3f4f5',borderRadius:8,padding:13,alignItems:'center',justifyContent:'center',paddingHorizontal:16},
  ghostBtnTxt: {fontSize:13,fontWeight:'700',color:'#747871'},
  listRow: {backgroundColor:'#fff',borderRadius:10,padding:11,flexDirection:'row',alignItems:'center',gap:10,borderWidth:1,borderColor:'#e1e3e4',marginBottom:8},
  rowIcon: {width:34,height:34,borderRadius:17,backgroundColor:'#f3f4f5',alignItems:'center',justifyContent:'center',flexShrink:0},
  rowTitle: {fontSize:14,fontWeight:'700',color:'#061907'},
  rowSub: {fontSize:12,color:'#747871',marginTop:1},
  iconBtn: {width:32,height:32,borderRadius:8,backgroundColor:'#f0faf4',alignItems:'center',justifyContent:'center',flexShrink:0},
  scanBtn: {flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10,backgroundColor:'#f0faf4',borderRadius:8,padding:13,marginBottom:12,borderWidth:1,borderColor:'#aeeecb'},
  dividerRow: {flexDirection:'row',alignItems:'center',gap:8,marginBottom:10},
  dividerLine: {flex:1,height:1,backgroundColor:'#e1e3e4'},
  dividerTxt: {fontSize:9,color:'#c3c8bf',fontWeight:'700',letterSpacing:1},
});
