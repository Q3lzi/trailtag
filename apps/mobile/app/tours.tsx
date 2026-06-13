import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Platform } from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import { getToken } from '../lib/storage';
import { router } from 'expo-router';
import { showConfirm, showAlert } from '../lib/alert';
import { Mountain, Navigation, Activity, Wind, Flag, Search,
  Trash2, Copy, ChevronRight, TrendingUp, MapPin,
  AlertTriangle, Check, BookOpen, ChevronLeft, User } from 'lucide-react-native';

const ACTIVITY_COLORS: Record<string,string> = {
  WANDERN:'#1a3d2b', BERGTOUR:'#0f2027', KLETTERN:'#1a1a2e', TRAILRUNNING:'#1a2e1a',
  MOUNTAINBIKE:'#1f2d1f', RADSPORT:'#162616', SKI_SNOWBOARD:'#0d1b2a', SKITOUR:'#0d1b2a',
  KLETTERSTEIG:'#1a1a2e', KANU_KAJAK:'#0d2137', PARAGLIDING:'#0d1f3c', ANDERE:'#1a2e1a',
};
const ACTIVITY_ICONS: Record<string,any> = {
  WANDERN:Mountain, BERGTOUR:Mountain, KLETTERN:Activity, KLETTERSTEIG:Flag,
  TRAILRUNNING:Activity, MOUNTAINBIKE:Navigation, RADSPORT:Navigation,
  SKI_SNOWBOARD:Wind, SKITOUR:Wind, KANU_KAJAK:Navigation, PARAGLIDING:Wind, ANDERE:Mountain,
};
const ACTIVITY_LABELS: Record<string,string> = {
  WANDERN:'Wandern', BERGTOUR:'Bergtour', KLETTERN:'Klettern', TRAILRUNNING:'Trailrunning',
  MOUNTAINBIKE:'Mountainbike', RADSPORT:'Radsport', SKI_SNOWBOARD:'Ski/Snowboard',
  SKITOUR:'Skitour', KLETTERSTEIG:'Klettersteig', KANU_KAJAK:'Kanu/Kajak',
  PARAGLIDING:'Paragliding', ANDERE:'Andere',
};
type FilterTab = 'all'|'completed'|'planned';
const PAGE_SIZE = 5;

export default function ToursScreen() {
  const [tours, setTours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [page, setPage] = useState(0);
  const insets = useSafeAreaInsets();

  useEffect(() => { loadTours(); }, []);

  async function loadTours() {
    try {
      const token = await getToken();
      const data = await apiFetch('/tours', {}, token ?? undefined);
      setTours(data);
    } catch {}
    finally { setLoading(false); }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('de-CH',{day:'2-digit',month:'2-digit',year:'2-digit'});
  }
  function formatDuration(start: string, end: string) {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return `${Math.floor(diff/3600000)}h ${Math.floor((diff%3600000)/60000)}m`;
  }

  const filtered = useMemo(() => {
    let list = tours;
    if (filter==='completed') list = list.filter(t=>t.status==='COMPLETED'||t.status==='ALARM');
    if (filter==='planned') list = list.filter(t=>t.status==='PLANNED');
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        (t.routeName??'').toLowerCase().includes(q) ||
        ACTIVITY_LABELS[t.activity]?.toLowerCase().includes(q) ||
        (t.parkingLocation??'').toLowerCase().includes(q)
      );
    }
    return list;
  }, [tours, filter, search]);

  useEffect(() => { setPage(0); }, [filter, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalKm = Math.round(tours.reduce((s,t) => s+(t.distanceKm??0), 0));
  const totalHm = Math.round(tours.reduce((s,t) => s+(t.elevationUp??0), 0));
  const completed = tours.filter(t=>t.status==='COMPLETED'||t.status==='ALARM').length;

  if (loading) return (
    <View style={styles.loading}>
      <BookOpen size={32} color="#c3c8bf" strokeWidth={1.5}/>
      <Text style={styles.loadingTxt}>Touren laden...</Text>
    </View>
  );

  const TABS: {key:FilterTab;label:string}[] = [
    {key:'all',label:'Alle'},
    {key:'completed',label:'Abgeschlossen'},
    {key:'planned',label:'Geplant'},
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* ── Top Nav — identical to dashboard ── */}
      <View style={[styles.topNav, { paddingTop: insets.top + 10 }]}>
        <View style={styles.topNavLeft}>
          <Mountain size={22} color="#061907" strokeWidth={2.5}/>
          <Text style={styles.logoText}>Trailtag</Text>
        </View>
        <TouchableOpacity style={styles.accountBtn} onPress={() => router.push('/profile')}>
          <User size={18} color="#434841" strokeWidth={1.8}/>
        </TouchableOpacity>
      </View>

      {/* ── Archive sub-header ── */}
      <View style={styles.archiveHead}>
        <Text style={styles.archiveTitle}>Archiv</Text>
        <Text style={styles.archiveSub}>{tours.length} Touren erfasst</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{totalKm}</Text>
            <Text style={styles.statLbl}>km total</Text>
          </View>
          <View style={styles.statDiv}/>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{totalHm}</Text>
            <Text style={styles.statLbl}>hm total</Text>
          </View>
          <View style={styles.statDiv}/>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{completed}</Text>
            <Text style={styles.statLbl}>abgeschlossen</Text>
          </View>
        </View>
      </View>

      {/* ── Search + Filter ── */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={15} color="#747871" strokeWidth={2}/>
          <TextInput
            style={styles.searchInput}
            placeholder="Touren suchen..."
            placeholderTextColor="#c3c8bf"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={()=>setSearch('')}>
              <Text style={{fontSize:13,color:'#747871',fontWeight:'700'}}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
          {TABS.map(tab=>(
            <TouchableOpacity key={tab.key} style={[styles.tab, filter===tab.key&&styles.tabActive]} onPress={()=>setFilter(tab.key)}>
              <Text style={[styles.tabTxt, filter===tab.key&&styles.tabTxtActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Empty ── */}
      {filtered.length===0 ? (
        <View style={styles.empty}>
          <Mountain size={40} color="#c3c8bf" strokeWidth={1.2}/>
          <Text style={styles.emptyTitle}>{search?'Keine Ergebnisse':'Noch keine Touren'}</Text>
          <Text style={styles.emptySub}>{search?`Nichts gefunden für "${search}"`:'Starte deine erste Tour'}</Text>
        </View>
      ) : null}

      {/* ── Tour Cards ── */}
      <View style={styles.list}>
        {paginated.map(tour=>{
          const actLabel = ACTIVITY_LABELS[tour.activity]??tour.activity;
          const ActIcon = ACTIVITY_ICONS[tour.activity]??Mountain;
          const heroColor = ACTIVITY_COLORS[tour.activity]??'#1a2e1a';
          const wasAlarm = tour.status==='ALARM';
          const isPlanned = tour.status==='PLANNED';

          return (
            <TouchableOpacity key={tour.id} style={styles.card}
              onPress={()=>router.push({pathname:'/tour-detail',params:{id:tour.id}})}
              activeOpacity={0.88}>

              {/* Hero strip */}
              <View style={[styles.cardHero,{backgroundColor:heroColor}]}>
                <View style={styles.cardHeroLeft}>
                  <ActIcon size={14} color="rgba(255,255,255,0.8)" strokeWidth={2}/>
                  <Text style={styles.cardActLabel}>{actLabel}</Text>
                </View>
                {isPlanned
                  ? <View style={styles.pillGray}><Text style={styles.pillTxtGray}>Geplant</Text></View>
                  : <View style={styles.pillGreen}><Check size={9} color="#006838" strokeWidth={3}/><Text style={styles.pillTxtGreen}>Abgeschlossen</Text></View>
                }
              </View>

              {/* Body */}
              <View style={styles.cardBody}>
                {wasAlarm && (
                  <View style={styles.alarmInfo}>
                    <AlertTriangle size={11} color="#b45309" strokeWidth={2}/>
                    <Text style={styles.alarmInfoTxt}>Safety-Timer wurde ausgelöst</Text>
                  </View>
                )}
                <View style={styles.cardTop}>
                  <View style={{flex:1}}>
                    <Text style={styles.cardName} numberOfLines={1}>{tour.routeName||actLabel}</Text>
                    <Text style={styles.cardDate}>
                      {formatDate(tour.createdAt)}
                      {tour.startedAt&&tour.checkedOutAt?` · ${formatDuration(tour.startedAt,tour.checkedOutAt)}`:''}
                    </Text>
                  </View>
                  <ChevronRight size={15} color="#c3c8bf" strokeWidth={2}/>
                </View>

                {(tour.distanceKm||tour.elevationUp||tour.difficulty||tour.parkingLocation) ? (
                  <View style={styles.cardStats}>
                    {tour.distanceKm?<View style={styles.cardStat}><Navigation size={10} color="#747871" strokeWidth={2}/><Text style={styles.cardStatTxt}>{tour.distanceKm} km</Text></View>:null}
                    {tour.elevationUp?<View style={styles.cardStat}><TrendingUp size={10} color="#747871" strokeWidth={2}/><Text style={styles.cardStatTxt}>{tour.elevationUp} hm</Text></View>:null}
                    {tour.difficulty?<View style={styles.cardStat}><Flag size={10} color="#747871" strokeWidth={2}/><Text style={styles.cardStatTxt}>{tour.difficulty}</Text></View>:null}
                    {tour.parkingLocation?<View style={styles.cardStat}><MapPin size={10} color="#747871" strokeWidth={2}/><Text style={styles.cardStatTxt} numberOfLines={1}>{tour.parkingLocation}</Text></View>:null}
                  </View>
                ) : null}

                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.actionBtn}
                    onPress={()=>router.push({pathname:'/create-tour',params:{prefill:JSON.stringify({
                      activity:tour.activity, routeName:tour.routeName, difficulty:tour.difficulty,
                      persons:tour.persons, distanceKm:tour.distanceKm, elevationUp:tour.elevationUp,
                      parkingLocation:tour.parkingLocation, vehicleId:tour.vehicleId,
                    })}})}>
                    <Copy size={11} color="#2c694e" strokeWidth={2}/>
                    <Text style={styles.actionBtnTxt}>Wiederverwenden</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn,styles.actionBtnDanger]}
                    onPress={async()=>{
                      const ok = await showConfirm('Tour wirklich löschen?');
                      if (!ok) return;
                      try {
                        const token = await getToken();
                        await apiFetch(`/tours/${tour.id}`,{method:'DELETE'},token??undefined);
                        setTours(prev=>prev.filter(t=>t.id!==tour.id));
                      } catch { showAlert('Fehler','Löschen fehlgeschlagen.'); }
                    }}>
                    <Trash2 size={11} color="#dc2626" strokeWidth={2}/>
                    <Text style={[styles.actionBtnTxt,{color:'#dc2626'}]}>Löschen</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <View style={styles.pagination}>
          <TouchableOpacity style={[styles.pgBtn, page===0&&styles.pgBtnDis]} disabled={page===0} onPress={()=>setPage(p=>p-1)}>
            <ChevronLeft size={16} color={page===0?'#c3c8bf':'#191c1d'} strokeWidth={2}/>
          </TouchableOpacity>
          {Array.from({length:totalPages},(_,i)=>(
            <TouchableOpacity key={i} style={[styles.pgNum, i===page&&styles.pgNumActive]} onPress={()=>setPage(i)}>
              <Text style={[styles.pgNumTxt, i===page&&styles.pgNumTxtActive]}>{i+1}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.pgBtn, page===totalPages-1&&styles.pgBtnDis]} disabled={page===totalPages-1} onPress={()=>setPage(p=>p+1)}>
            <ChevronRight size={16} color={page===totalPages-1?'#c3c8bf':'#191c1d'} strokeWidth={2}/>
          </TouchableOpacity>
        </View>
      )}
      {filtered.length > 0 && (
        <Text style={styles.pageInfo}>{page*PAGE_SIZE+1}–{Math.min((page+1)*PAGE_SIZE,filtered.length)} von {filtered.length} Touren</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#f8f9fa', gap:12 },
  loadingTxt: { fontSize:14, color:'#c3c8bf' },
  container: { flex:1, backgroundColor:'#f8f9fa' },
  content: { paddingBottom:110 },

  // ── Top Nav — pixel-identical to dashboard ──
  topNav: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:20, paddingTop:18, paddingBottom:16, backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#edeeef' },
  topNavLeft: { flexDirection:'row', alignItems:'center', gap:8 },
  logoText: { fontSize:20, fontWeight:'800', color:'#061907', letterSpacing:-0.5 },
  accountBtn: { width:40, height:40, borderRadius:8, backgroundColor:'#f3f4f5', alignItems:'center', justifyContent:'center' },

  // ── Archive sub-header ──
  archiveHead: { backgroundColor:'#fff', paddingHorizontal:20, paddingTop:16, paddingBottom:20, borderBottomWidth:1, borderBottomColor:'#edeeef' },
  archiveTitle: { fontSize:24, fontWeight:'900', color:'#061907', letterSpacing:-0.5, marginBottom:2 },
  archiveSub: { fontSize:12, color:'#aaa', marginBottom:16 },
  statsRow: { flexDirection:'row', alignItems:'center', backgroundColor:'#f3f4f5', borderRadius:8, padding:14 },
  statItem: { flex:1, alignItems:'center' },
  statNum: { fontSize:18, fontWeight:'900', color:'#061907', letterSpacing:-0.5 },
  statLbl: { fontSize:10, color:'#aaa', fontWeight:'600', marginTop:2 },
  statDiv: { width:1, height:24, backgroundColor:'#e1e3e4' },

  // ── Search / Filter ──
  searchSection: { backgroundColor:'#fff', paddingHorizontal:16, paddingTop:14, paddingBottom:2, borderBottomWidth:1, borderBottomColor:'#f3f4f5' },
  searchBar: { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:'#f3f4f5', borderRadius:8, paddingHorizontal:12, paddingVertical:9, marginBottom:12 },
  searchInput: { flex:1, fontSize:14, color:'#191c1d', ...(Platform.OS==='web'?{outlineStyle:'none'} as any:{}) },
  tabsContent: { paddingBottom:12, gap:8 },
  tab: { paddingHorizontal:14, paddingVertical:6, borderRadius:100, backgroundColor:'#f3f4f5' },
  tabActive: { backgroundColor:'#aeeecb' },
  tabTxt: { fontSize:12, fontWeight:'700', color:'#747871' },
  tabTxtActive: { color:'#006838' },

  // ── Empty state ──
  empty: { alignItems:'center', paddingVertical:52, paddingHorizontal:40, gap:10 },
  emptyTitle: { fontSize:16, fontWeight:'700', color:'#434841' },
  emptySub: { fontSize:13, color:'#c3c8bf', textAlign:'center' },

  // ── Cards ──
  list: { padding:14, gap:10 },
  card: { backgroundColor:'#fff', borderRadius:6, overflow:'hidden', borderWidth:1, borderColor:'#e1e3e4' },

  cardHero: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:13, paddingVertical:10 },
  cardHeroLeft: { flexDirection:'row', alignItems:'center', gap:6 },
  cardActLabel: { fontSize:11, fontWeight:'700', color:'rgba(255,255,255,0.85)', letterSpacing:0.2 },
  pillGreen: { flexDirection:'row', alignItems:'center', gap:3, backgroundColor:'#f0faf4', paddingHorizontal:7, paddingVertical:3, borderRadius:100 },
  pillTxtGreen: { fontSize:10, fontWeight:'700', color:'#006838' },
  pillGray: { backgroundColor:'rgba(255,255,255,0.15)', paddingHorizontal:7, paddingVertical:3, borderRadius:100 },
  pillTxtGray: { fontSize:10, fontWeight:'700', color:'rgba(255,255,255,0.8)' },

  cardBody: { padding:12 },
  alarmInfo: { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'#fffbeb', borderRadius:4, paddingHorizontal:9, paddingVertical:6, marginBottom:9, borderWidth:1, borderColor:'#fde68a' },
  alarmInfoTxt: { fontSize:11, color:'#b45309', fontWeight:'600' },
  cardTop: { flexDirection:'row', alignItems:'center', marginBottom:7 },
  cardName: { fontSize:14, fontWeight:'800', color:'#061907', letterSpacing:-0.2 },
  cardDate: { fontSize:11, color:'#747871', marginTop:2 },
  cardStats: { flexDirection:'row', flexWrap:'wrap', gap:9, marginBottom:11 },
  cardStat: { flexDirection:'row', alignItems:'center', gap:3 },
  cardStatTxt: { fontSize:11, color:'#747871' },

  actionRow: { flexDirection:'row', gap:7, borderTopWidth:1, borderTopColor:'#f3f4f5', paddingTop:10, marginTop:2 },
  actionBtn: { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:5, paddingVertical:8, borderRadius:4, backgroundColor:'#f0faf4', borderWidth:1, borderColor:'#aeeecb' },
  actionBtnDanger: { backgroundColor:'#fff5f5', borderColor:'#fca5a5' },
  actionBtnTxt: { fontSize:11, fontWeight:'700', color:'#2c694e' },

  // ── Pagination ──
  pagination: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, paddingVertical:16 },
  pgBtn: { width:36, height:36, borderRadius:4, borderWidth:1, borderColor:'#e1e3e4', alignItems:'center', justifyContent:'center', backgroundColor:'#fff' },
  pgBtnDis: { borderColor:'#f3f4f5', backgroundColor:'#f8f9fa' },
  pgNum: { minWidth:36, height:36, borderRadius:4, alignItems:'center', justifyContent:'center', paddingHorizontal:8 },
  pgNumActive: { backgroundColor:'#061907' },
  pgNumTxt: { fontSize:13, fontWeight:'700', color:'#747871' },
  pgNumTxtActive: { color:'#fff' },
  pageInfo: { textAlign:'center', fontSize:12, color:'#c3c8bf', paddingBottom:8 },
});
