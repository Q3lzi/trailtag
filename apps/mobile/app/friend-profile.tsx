import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking, Platform, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiFetch } from '../lib/api';
import { getToken } from '../lib/storage';
import { ArrowLeft, Phone, Mountain, ExternalLink, MapPin, TrendingUp, Award, Calendar } from 'lucide-react-native';

const ACTIVITY_EMOJI: Record<string, string> = {
  Wandern: '🥾', Bergsteigen: '⛰️', Klettern: '🧗', Skitouren: '⛷️',
  Mountainbike: '🚵', Velofahren: '🚴', Laufen: '🏃', Schneeschuhe: '🌨️',
};

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

  const isAlarm = profile?.activeTour?.status === 'ALARM';
  const isActive = !!profile?.activeTour;

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('de-CH', { day:'2-digit', month:'2-digit', year:'2-digit' });
  }

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

          {/* Hero */}
          <View style={styles.heroCard}>
            <View style={[styles.avatar, isAlarm && { backgroundColor:'#ba1a1a' }]}>
              <Text style={styles.avatarLetter}>{(name??'?')[0].toUpperCase()}</Text>
            </View>
            <Text style={styles.heroName}>{name}</Text>
            {profile?.birthYear && (
              <Text style={styles.heroSub}>Jahrgang {profile.birthYear}</Text>
            )}
            {profile?.stats?.favActivity && (
              <View style={styles.favBadge}>
                <Text style={styles.favTxt}>
                  {ACTIVITY_EMOJI[profile.stats.favActivity] ?? '🏔'} {profile.stats.favActivity}
                </Text>
              </View>
            )}
            {profile?.phone && (
              <TouchableOpacity
                style={styles.callBtn}
                onPress={() => Linking.openURL(`tel:${profile.phone}`)}>
                <Phone size={15} color="#fff" strokeWidth={2}/>
                <Text style={styles.callBtnTxt}>{profile.phone}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Stats Row */}
          {profile?.stats && (
            <View style={styles.statsRow}>
              <View style={styles.statCell}>
                <Text style={styles.statVal}>{profile.stats.totalTours}</Text>
                <Text style={styles.statLbl}>Touren</Text>
              </View>
              <View style={[styles.statCell, styles.statBorder]}>
                <Text style={styles.statVal}>{profile.stats.totalKm > 0 ? `${profile.stats.totalKm}` : '—'}</Text>
                <Text style={styles.statLbl}>km total</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statVal}>{profile.stats.totalElevation > 0 ? `${profile.stats.totalElevation}` : '—'}</Text>
                <Text style={styles.statLbl}>hm total</Text>
              </View>
            </View>
          )}

          {/* Aktive Tour */}
          {isActive && (
            <View style={[styles.card, isAlarm && { borderColor:'#ba1a1a', borderWidth:2 }]}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:10 }}>
                <View style={[styles.dot, { backgroundColor: isAlarm ? '#ba1a1a' : '#2c694e' }]}/>
                <Text style={{ fontSize:13, fontWeight:'800', color: isAlarm ? '#ba1a1a' : '#2c694e' }}>
                  {isAlarm ? '🚨 ALARM — ÜBERFÄLLIG' : '🏔 GERADE UNTERWEGS'}
                </Text>
              </View>
              {profile.activeTour.activity && (
                <Text style={{ fontSize:15, fontWeight:'700', color:'#061907', marginBottom:4 }}>
                  {ACTIVITY_EMOJI[profile.activeTour.activity] ?? '🏔'} {profile.activeTour.activity}
                </Text>
              )}
              {profile.activeTour.eta && (
                <Text style={{ fontSize:13, color:'#747871' }}>
                  Rückkehr: {formatDate(profile.activeTour.eta)} {new Date(profile.activeTour.eta).toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'})} Uhr
                </Text>
              )}
              {profile.activeTour.qrUrl && (
                <TouchableOpacity
                  style={[styles.portalBtn, !isAlarm && { backgroundColor:'#2c694e' }]}
                  onPress={() => {
                    Platform.OS === 'web'
                      ? (window as any).open(profile.activeTour.qrUrl, '_blank')
                      : Linking.openURL(profile.activeTour.qrUrl);
                  }}>
                  <ExternalLink size={14} color="#fff" strokeWidth={2}/>
                  <Text style={styles.portalBtnTxt}>Ersthelfer-Portal</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Letzte Touren */}
          {profile?.recentTours?.length > 0 && (
            <View>
              <Text style={styles.sectionLabel}>LETZTE TOUREN</Text>
              {profile.recentTours.map((t: any, i: number) => (
                <View key={t.id} style={[styles.tourRow, i === profile.recentTours.length-1 && { borderBottomWidth:0 }]}>
                  <Text style={styles.tourEmoji}>{ACTIVITY_EMOJI[t.activity] ?? '🏔'}</Text>
                  <View style={{ flex:1 }}>
                    <Text style={styles.tourName} numberOfLines={1}>{t.routeName || t.activity || 'Tour'}</Text>
                    <View style={{ flexDirection:'row', gap:8, marginTop:2 }}>
                      {t.distanceKm && <Text style={styles.tourStat}>📍 {t.distanceKm} km</Text>}
                      {t.elevationUp && <Text style={styles.tourStat}>↑ {t.elevationUp} hm</Text>}
                      {t.difficulty && <Text style={styles.tourStat}>{t.difficulty}</Text>}
                    </View>
                  </View>
                  {t.checkedOutAt && (
                    <Text style={styles.tourDate}>{formatDate(t.checkedOutAt)}</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {!isActive && (!profile?.recentTours?.length) && (
            <View style={[styles.card, { alignItems:'center', paddingVertical:24 }]}>
              <Mountain size={32} color="#c3c8bf" strokeWidth={1.5}/>
              <Text style={{ fontSize:14, color:'#747871', marginTop:10 }}>Noch keine Touren</Text>
            </View>
          )}

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
  heroCard: { backgroundColor:'#fff', borderRadius:14, padding:20, alignItems:'center', marginBottom:10, borderWidth:1, borderColor:'#e1e3e4' },
  avatar: { width:72, height:72, borderRadius:36, backgroundColor:'#1a2e1a', alignItems:'center', justifyContent:'center', marginBottom:12 },
  avatarLetter: { fontSize:28, fontWeight:'900', color:'#fff' },
  heroName: { fontSize:22, fontWeight:'800', color:'#061907', marginBottom:2 },
  heroSub: { fontSize:13, color:'#747871', marginBottom:8 },
  favBadge: { backgroundColor:'#f0faf4', borderRadius:100, paddingHorizontal:14, paddingVertical:5, marginBottom:12 },
  favTxt: { fontSize:13, fontWeight:'700', color:'#2c694e' },
  callBtn: { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'#2c694e', borderRadius:100, paddingHorizontal:20, paddingVertical:10 },
  callBtnTxt: { fontSize:14, fontWeight:'700', color:'#fff' },
  statsRow: { flexDirection:'row', backgroundColor:'#fff', borderRadius:12, borderWidth:1, borderColor:'#e1e3e4', marginBottom:10 },
  statCell: { flex:1, alignItems:'center', paddingVertical:14 },
  statBorder: { borderLeftWidth:1, borderRightWidth:1, borderColor:'#f3f4f5' },
  statVal: { fontSize:20, fontWeight:'900', color:'#061907' },
  statLbl: { fontSize:10, color:'#747871', marginTop:2 },
  card: { backgroundColor:'#fff', borderRadius:12, padding:14, marginBottom:10, borderWidth:1, borderColor:'#e1e3e4' },
  dot: { width:8, height:8, borderRadius:4 },
  portalBtn: { backgroundColor:'#ba1a1a', borderRadius:8, padding:11, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, marginTop:10 },
  portalBtnTxt: { fontSize:13, fontWeight:'700', color:'#fff' },
  sectionLabel: { fontSize:10, fontWeight:'700', color:'#747871', letterSpacing:1, marginBottom:8, marginTop:4 },
  tourRow: { backgroundColor:'#fff', flexDirection:'row', alignItems:'center', gap:12, paddingVertical:12, paddingHorizontal:14, borderBottomWidth:1, borderBottomColor:'#f3f4f5', borderRadius:0 },
  tourEmoji: { fontSize:20 },
  tourName: { fontSize:14, fontWeight:'700', color:'#061907' },
  tourStat: { fontSize:11, color:'#747871' },
  tourDate: { fontSize:11, color:'#c3c8bf', flexShrink:0 },
});
