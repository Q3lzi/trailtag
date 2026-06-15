import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking, Platform, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiFetch } from '../lib/api';
import { getToken } from '../lib/storage';
import { ArrowLeft, Phone, AlertTriangle, Shield, Mountain, ExternalLink } from 'lucide-react-native';

export default function FriendProfileScreen() {
  const { friendshipId, name } = useLocalSearchParams<{ friendshipId: string; name: string }>();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const token = await getToken();
      const data = await apiFetch(`/friends/${friendshipId}/profile`, {}, token ?? undefined);
      setProfile(data);
    } catch (err) {
      console.log('Friend profile error:', err);
    } finally {
      setLoading(false);
    }
  }

  const hasActiveTour = !!profile?.activeTour;
  const isAlarm = profile?.activeTour?.status === 'ALARM';
  const priv = profile?.privacySettings ?? {};

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#061907" strokeWidth={2.5}/>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{name ?? 'Freund'}</Text>
        <View style={{ width: 44 }}/>
      </View>

      {loading ? (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
          <ActivityIndicator color="#2c694e" size="large"/>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding:16, paddingBottom:60 }}>

          {/* Avatar + Name */}
          <View style={styles.heroCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>{(name??'?')[0].toUpperCase()}</Text>
            </View>
            <Text style={styles.heroName}>{name}</Text>
            {profile?.birthYear && (
              <Text style={styles.heroSub}>Jahrgang {profile.birthYear}</Text>
            )}
            {profile?.phone ? (
              <TouchableOpacity
                style={styles.callBtn}
                onPress={() => Linking.openURL(`tel:${profile.phone}`)}>
                <Phone size={15} color="#fff" strokeWidth={2}/>
                <Text style={styles.callBtnTxt}>{profile.phone}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Active Tour Status */}
          {hasActiveTour ? (
            <View style={[styles.card, isAlarm && { borderColor:'#ba1a1a', borderWidth:2 }]}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:12 }}>
                <View style={[styles.statusDot, { backgroundColor: isAlarm ? '#ba1a1a' : '#2c694e' }]}/>
                <Text style={{ fontSize:14, fontWeight:'800', color: isAlarm ? '#ba1a1a' : '#2c694e' }}>
                  {isAlarm ? '🚨 ALARM — ÜBERFÄLLIG' : '🏔 TOUR AKTIV'}
                </Text>
              </View>
              {profile.activeTour.activity && (
                <View style={styles.infoRow}>
                  <Mountain size={13} color="#747871" strokeWidth={2}/>
                  <Text style={styles.infoTxt}>{profile.activeTour.activity}</Text>
                </View>
              )}
              {profile.activeTour.eta && (
                <View style={styles.infoRow}>
                  <AlertTriangle size={13} color="#747871" strokeWidth={2}/>
                  <Text style={styles.infoTxt}>
                    Rückkehr: {new Date(profile.activeTour.eta).toLocaleDateString('de-CH',{day:'2-digit',month:'2-digit'})} {new Date(profile.activeTour.eta).toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'})}
                  </Text>
                </View>
              )}
              {profile.activeTour.qrUrl && (
                <TouchableOpacity
                  style={[styles.portalBtn, !isAlarm && { backgroundColor:'#2c694e' }]}
                  onPress={() => {
                    if (Platform.OS === 'web') { (window as any).open(profile.activeTour.qrUrl, '_blank'); }
                    else { Linking.openURL(profile.activeTour.qrUrl); }
                  }}>
                  <ExternalLink size={14} color="#fff" strokeWidth={2}/>
                  <Text style={styles.portalBtnTxt}>
                    {isAlarm ? 'Ersthelfer-Portal öffnen' : 'Tour-Portal anzeigen'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={[styles.card, { alignItems:'center', paddingVertical:20 }]}>
              <Shield size={28} color="#c3c8bf" strokeWidth={1.5}/>
              <Text style={{ fontSize:13, color:'#747871', marginTop:8 }}>Keine aktive Tour</Text>
            </View>
          )}

          <Text style={styles.privacyNote}>
            {name} entscheidet welche Informationen im Portal sichtbar sind.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#f8f9fa' },
  header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingBottom:14, backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#e1e3e4' },
  backBtn: { width:44, height:44, alignItems:'center', justifyContent:'center' },
  headerTitle: { fontSize:17, fontWeight:'800', color:'#061907' },
  heroCard: { backgroundColor:'#fff', borderRadius:14, padding:20, alignItems:'center', marginBottom:12, borderWidth:1, borderColor:'#e1e3e4' },
  avatar: { width:72, height:72, borderRadius:36, backgroundColor:'#1a2e1a', alignItems:'center', justifyContent:'center', marginBottom:12 },
  avatarLetter: { fontSize:28, fontWeight:'900', color:'#fff' },
  heroName: { fontSize:22, fontWeight:'800', color:'#061907', marginBottom:4 },
  heroSub: { fontSize:13, color:'#747871', marginBottom:12 },
  callBtn: { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'#2c694e', borderRadius:100, paddingHorizontal:20, paddingVertical:10 },
  callBtnTxt: { fontSize:14, fontWeight:'700', color:'#fff' },
  card: { backgroundColor:'#fff', borderRadius:12, padding:14, marginBottom:12, borderWidth:1, borderColor:'#e1e3e4' },
  statusDot: { width:10, height:10, borderRadius:5 },
  infoRow: { flexDirection:'row', alignItems:'center', gap:8, marginBottom:6 },
  infoTxt: { fontSize:13, color:'#434841' },
  portalBtn: { backgroundColor:'#ba1a1a', borderRadius:8, padding:12, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, marginTop:8 },
  portalBtnTxt: { fontSize:14, fontWeight:'700', color:'#fff' },
  sectionLabel: { fontSize:10, fontWeight:'700', color:'#747871', letterSpacing:1, marginBottom:8, marginTop:4 },
  privacyNote: { fontSize:11, color:'#c3c8bf', textAlign:'center', marginTop:4, lineHeight:16 },
});
