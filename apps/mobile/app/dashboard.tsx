import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { apiFetch } from '../lib/api';
import { showAlert, showConfirm } from '../lib/alert';
import { getToken, removeToken } from '../lib/storage';
import { cancelAllNotifications } from '../lib/notifications';
import { startLocationTracking, stopLocationTracking } from '../lib/tracking';
import { useRealtimeConnection } from '../lib/realtime';
import { Home, Mountain, BookOpen, User, MapPin, Clock, Car, AlertTriangle, CheckCircle, Activity, Navigation, Thermometer, Wind, Link, MessageCircle, ChevronRight } from 'lucide-react-native';
const WMO_CODES: Record<number, { text: string; icon: string }> = {
  0: { text: 'Klar', icon: '☀️' }, 1: { text: 'Überwiegend klar', icon: '🌤️' },
  2: { text: 'Teilweise bewölkt', icon: '⛅' }, 3: { text: 'Bewölkt', icon: '☁️' },
  45: { text: 'Nebel', icon: '🌫️' }, 61: { text: 'Leichter Regen', icon: '🌧️' },
  63: { text: 'Regen', icon: '🌧️' }, 71: { text: 'Schneefall', icon: '❄️' },
  80: { text: 'Schauer', icon: '🌦️' }, 95: { text: 'Gewitter', icon: '⛈️' },
};

function useCountdown(eta: string | null) {
  const [timeLeft, setTimeLeft] = useState('00:00:00');
  const [isOverdue, setIsOverdue] = useState(false);
  const [progress, setProgress] = useState(1);
  useEffect(() => {
    if (!eta) return;
    const totalDuration = 8 * 3600 * 1000;
    const interval = setInterval(() => {
      const diff = new Date(eta).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('ÜBERFÄLLIG'); setIsOverdue(true); setProgress(0); return; }
      setIsOverdue(false);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
      setProgress(Math.min(1, diff / totalDuration));
    }, 1000);
    return () => clearInterval(interval);
  }, [eta]);
  return { timeLeft, isOverdue, progress };
}

const ACTIVITY_COLORS: Record<string,string> = {
  WANDERN:'#1a3d2b', BERGTOUR:'#0f2027', KLETTERN:'#1a1a2e', TRAILRUNNING:'#1a2e1a',
  MOUNTAINBIKE:'#1f2d1f', RADSPORT:'#162616', SKI_SNOWBOARD:'#0d1b2a', SKITOUR:'#0d1b2a',
  KLETTERSTEIG:'#1a1a2e', KANU_KAJAK:'#0d2137', PARAGLIDING:'#0d1f3c', ANDERE:'#1a2e1a',
};
const ACTIVITY_LABELS: Record<string, string> = {
  WANDERN: 'Wandern', BERGTOUR: 'Bergtour', KLETTERN: 'Klettern',
  TRAILRUNNING: 'Trailrunning', MOUNTAINBIKE: 'Mountainbike', RADSPORT: 'Radsport',
  SKI_SNOWBOARD: 'Ski / Snowboard', SKITOUR: 'Skitour', KLETTERSTEIG: 'Klettersteig',
  KANU_KAJAK: 'Kanu / Kajak', PARAGLIDING: 'Paragliding', ANDERE: 'Andere',
};

async function fetchWeather(lat: number, lng: number) {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weathercode,windspeed_10m&wind_speed_unit=kmh&timezone=Europe/Zurich`);
    const data = await res.json();
    return { temp: Math.round(data.current.temperature_2m), wind: Math.round(data.current.windspeed_10m), code: data.current.weathercode };
  } catch { return null; }
}

export default function DashboardScreen() {
  const [activeTour, setActiveTour] = useState<any>(null);
  const [vehicle, setVehicle] = useState<any>(null);
  const [friendsOnTour, setFriendsOnTour] = useState<any[]>([]);

  useRealtimeConnection((event) => {
    if (event.type === 'location_update') {
      setFriendsOnTour((prev) => prev.map((f) =>
        f.id === event.friendId
          ? { ...f, activeTour: f.activeTour ? { ...f.activeTour, lastLat: event.lat, lastLng: event.lng } : f.activeTour }
          : f
      ));
    }
    if (event.type === 'tour_status_change') {
      if (event.status === 'COMPLETED') {
        setFriendsOnTour((prev) => prev.filter((f) => f.id !== event.friendId));
      } else {
        setFriendsOnTour((prev) => prev.map((f) =>
          f.id === event.friendId
            ? { ...f, activeTour: { ...(f.activeTour ?? {}), status: event.status, activity: event.activity ?? f.activeTour?.activity, eta: event.eta ?? f.activeTour?.eta } }
            : f
        ));
        // If a friend just started a tour and wasn't in the list, refresh fully
        if (event.status === 'ACTIVE' && !friendsOnTour.some((f) => f.id === event.friendId)) {
          loadData();
        }
      }
    }
    if (event.type === 'friend_request') {
      showAlert('Neue Freundschaftsanfrage', `${event.fromName} möchte sich mit dir verbinden.`);
    }
    if (event.type === 'friend_request_accepted') {
      showAlert('Freundschaftsanfrage angenommen', `${event.byName} hat deine Anfrage angenommen.`);
      loadData();
    }
  });
  
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState<any>(null);
  const [now, setNow] = useState(Date.now());
  const [plannedTours, setPlannedTours] = useState<any[]>([]);
  const { timeLeft, isOverdue, progress } = useCountdown(activeTour?.eta ?? null);

  useEffect(() => {
    loadData();
    // Auto-refresh every 30s for live updates
    const interval = setInterval(loadData, 30000);
    // Tick every 30s to update time displays
    const ticker = setInterval(() => setNow(Date.now()), 30000);
    return () => { clearInterval(interval); clearInterval(ticker); };
  }, []);

  async function loadData() {
    try {
      const token = await getToken();
      const [tours, vehicles, profile, friendsData] = await Promise.all([
        apiFetch('/tours', {}, token ?? undefined),
        apiFetch('/vehicles', {}, token ?? undefined),
        apiFetch('/profile', {}, token ?? undefined),
        apiFetch('/friends', {}, token ?? undefined).catch(() => ({ friends: [] })),
      ]);
      const active = tours.find((t: any) => t.status === 'ACTIVE' || t.status === 'ALARM');
      setActiveTour(active ?? null);
      // Planned tours for quick start
      const planned = tours.filter((t: any) => t.status === 'PLANNED').slice(0, 3);
      setPlannedTours(planned);
      // Auto-restart tracking if active tour exists (handles app restart)
      if (active) {
        // Start tracking on all platforms (web tracking uses geolocation interval)
        startLocationTracking(active.id).catch(() => {});
      }
      if (vehicles.length > 0) setVehicle(vehicles[0]);
      setUser(profile);
      // Friends with active tours
      const activeFriends = (friendsData.friends ?? []).filter((f: any) => f.activeTour);
      setFriendsOnTour(activeFriends);
      if (active?.lastLat) fetchWeather(active.lastLat, active.lastLng).then(setWeather);
      else if (active?.startLat) fetchWeather(active.startLat, active.startLng).then(setWeather);
    } catch { console.log('Fehler'); }
    finally { setLoading(false); }
  }

  async function handleCheckout() {
    const confirmed = await showConfirm('Bist du sicher zurück?');
    if (!confirmed) return;
    try {
      const token = await getToken();
      await apiFetch(`/tours/${activeTour.id}/checkout`, { method: 'POST' }, token ?? undefined);
      await stopLocationTracking();
      await cancelAllNotifications();
      setActiveTour(null);
    } catch (err: any) { showAlert('Fehler', err.message); }
  }

  async function handleLogout() { await removeToken(); router.replace('/'); }

  const qrUrl = vehicle ? `https://trailtag-production.up.railway.app/r/${vehicle.qrToken}` : null;
  const insets = useSafeAreaInsets();
  const minutesSinceUpdate = activeTour?.locationUpdatedAt
    ? Math.floor((now - new Date(activeTour.locationUpdatedAt).getTime()) / 60000)
    : null;
  const weatherInfo = weather ? (WMO_CODES[weather.code] ?? { text: 'Unbekannt', icon: '🌡️' }) : null;
  const firstName = user?.name?.split(' ')[0] ?? '';

  if (loading) return <View style={styles.loading}><Mountain size={48} color="#2D6A4F" /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Top Nav */}
      <View style={[styles.topNav, { paddingTop: insets.top + 10 }]}>
        <View style={styles.topNavLeft}>
          <Mountain size={22} color="#061907" strokeWidth={2.5} />
          <Text style={styles.logoText}>Trailtag</Text>
        </View>
<TouchableOpacity style={styles.accountBtn} onPress={() => router.push('/profile')}>
  <User size={18} color="#434841" strokeWidth={1.8} />
</TouchableOpacity>
      </View>

      {user && user.emailVerified === false && (
        <TouchableOpacity style={styles.verifyBanner} onPress={() => router.push('/verify-email')}>
          <Text style={styles.verifyBannerTxt}>✉️ E-Mail nicht bestätigt — jetzt bestätigen</Text>
        </TouchableOpacity>
      )}

      {activeTour ? (
        <>
          {/* Status Banner — clickable to tour detail */}
          <TouchableOpacity
            style={[styles.statusBanner, isOverdue ? styles.statusBannerRed : styles.statusBannerGreen]}
            onPress={() => router.push(`/tour-detail?id=${activeTour.id}`)}
            activeOpacity={0.85}
          >
            <View style={styles.statusBannerLeft}>
              <View style={[styles.statusIconBox, isOverdue ? styles.statusIconRed : styles.statusIconGreen]}>
                {isOverdue
                  ? <AlertTriangle size={18} color="#fff" strokeWidth={2.5} />
                  : <CheckCircle size={18} color="#fff" strokeWidth={2.5} />
                }
              </View>
              <View>
                <Text style={styles.statusSmall}>SAFETY STATUS</Text>
                <Text style={styles.statusBig}>{isOverdue ? 'Alarm — Überfällig' : 'Aktives Tracking'}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.syncLabel}>Standort-Sync</Text>
              <Text style={[styles.syncVal, minutesSinceUpdate && minutesSinceUpdate > 30 ? { color: '#ba1a1a' } : {}]}>
                {minutesSinceUpdate !== null ? `vor ${minutesSinceUpdate} Min.` : 'Kein Signal'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Countdown Hero */}
          <View style={styles.countdownCard}>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: isOverdue ? '#dc2626' : '#2D6A4F' }]} />
            </View>
            <Text style={styles.countdownLabel}>{isOverdue ? 'ÜBERFÄLLIG SEIT' : 'VERBLEIBENDE ZEIT'}</Text>
            <Text style={[styles.countdownTime, isOverdue && { color: '#dc2626' }]}>{timeLeft}</Text>
            <Text style={styles.countdownSub}>
              Kontakte werden informiert wenn kein Checkout bis {new Date(activeTour.eta).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })} Uhr.
            </Text>
            <TouchableOpacity style={[styles.checkoutBtn, isOverdue && styles.checkoutBtnRed]} onPress={handleCheckout}>
              <CheckCircle size={18} color="#fff" strokeWidth={2.5} />
              <Text style={styles.checkoutText}>Ich bin sicher zurück</Text>
            </TouchableOpacity>
          </View>

{/* Tour + Wetter */}
<View style={styles.infoGrid}>
  <TouchableOpacity style={styles.infoCard} onPress={() => router.push(`/tour-detail?id=${activeTour.id}`)} activeOpacity={0.7}>
    <Text style={styles.cardLabel}>AKTIVE TOUR</Text>
    <Text style={styles.tourName}>{ACTIVITY_LABELS[activeTour.activity] ?? activeTour.activity}</Text>
    {activeTour.routeName && <Text style={styles.tourRoute}>{activeTour.routeName}</Text>}
    <View style={styles.divider} />
    <View style={styles.statsList}>
      {activeTour.distanceKm && <View style={styles.statLine}><Text style={styles.statLineKey}>Distanz</Text><Text style={styles.statLineVal}>{activeTour.distanceKm} km</Text></View>}
      {activeTour.elevationUp && <View style={styles.statLine}><Text style={styles.statLineKey}>Höhenmeter</Text><Text style={styles.statLineVal}>{activeTour.elevationUp} hm</Text></View>}
      {activeTour.difficulty && <View style={styles.statLine}><Text style={styles.statLineKey}>Schwierigkeit</Text><Text style={styles.statLineVal}>{activeTour.difficulty} SAC</Text></View>}
      <View style={styles.statLine}><Text style={styles.statLineKey}>Gestartet</Text><Text style={styles.statLineVal}>{new Date(activeTour.startedAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</Text></View>
    </View>
    <Text style={styles.detailLink}>Details ansehen →</Text>
  </TouchableOpacity>

  {weather && weatherInfo && (
    <View style={styles.infoCard}>
      <Text style={styles.cardLabel}>WETTER AM STANDORT</Text>
      <Text style={styles.weatherTempLarge}>{weather.temp}°</Text>
      <Text style={styles.weatherCondition}>{weatherInfo.text}</Text>
      <View style={styles.divider} />
      <View style={styles.statLine}><Text style={styles.statLineKey}>Wind</Text><Text style={styles.statLineVal}>{weather.wind} km/h</Text></View>
    </View>
  )}
</View>

          {/* Standort Info */}
         {activeTour.parkingLocation && (
  <View style={[styles.card, { marginTop: 12, marginHorizontal: 16 }]}>
    <Text style={styles.cardLabel}>FAHRZEUG & PARKPLATZ</Text>
    <View style={styles.miniStat}>


      <Car size={14} color="#2D6A4F" />
      <Text style={[styles.miniStatText, { color: '#111', fontWeight: '600' }]}>
        {vehicle ? `${vehicle.plate} · ${vehicle.make} ${vehicle.model}` : 'Kein Fahrzeug'}
      </Text>
    </View>
    <TouchableOpacity
      onPress={() => {
        const query = encodeURIComponent(activeTour.parkingLocation);
        const url = `https://maps.google.com/?q=${query}`;
        if (Platform.OS === 'web') { window.open(url, '_blank'); }
        else { Linking.openURL(url); }
      }}
    >
      <View style={styles.miniStat}>
        <MapPin size={14} color="#2c694e" />
        <Text style={[styles.miniStatText, { color: '#2c694e', fontWeight: '600', textDecorationLine: 'underline' }]}>
          {activeTour.parkingLocation}
        </Text>
      </View>
    </TouchableOpacity>
  </View>
)}

          {/* Rescue Portal */}
          {qrUrl && (
            <TouchableOpacity
              style={styles.rescueCard}
              onPress={() => Platform.OS === 'web' ? window.open(qrUrl!, '_blank') : Linking.openURL(qrUrl!)}
              activeOpacity={0.8}
            >
              <View style={styles.rescueTop}>
                <AlertTriangle size={28} color="#93000a" strokeWidth={2} />
                <View style={styles.rescueBadge}><Text style={styles.rescueBadgeText}>KRITISCH</Text></View>
              </View>
              <Text style={styles.rescueTitle}>Erstretter-Portal</Text>
              <Text style={styles.rescueSub}>
                Ersthelfer können den QR-Code am Fahrzeug scannen um Notfalldaten, Standort und Medizininfos abzurufen — ohne App.
              </Text>
              <View style={styles.rescueBtn}>
                <Link size={14} color="#ba1a1a" />
                <Text style={styles.rescueBtnText}>Portal öffnen</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* iMessage / SMS an Notfallkontakt */}
          {user?.emergencyContacts?.length > 0 && qrUrl && Platform.OS !== 'web' && (
            <TouchableOpacity
              style={[styles.card, {marginHorizontal:16, marginTop:8, flexDirection:'row', alignItems:'center', gap:12, padding:14}]}
              onPress={() => {
                const contact = user?.emergencyContacts.find((c:any) => c.isPrimary) ?? user?.emergencyContacts[0];
                const msg = `Hallo ${contact.name}, ich bin auf einer Wanderung. Mein Trailtag Sicherheitsportal: ${qrUrl}`;
                Linking.openURL(`sms:${contact.phone}?body=${encodeURIComponent(msg)}`);
              }}
            >
              <View style={{width:36,height:36,borderRadius:18,backgroundColor:'#aeeecb',alignItems:'center',justifyContent:'center'}}>
                <MessageCircle size={18} color="#2c694e" strokeWidth={2}/>
              </View>
              <View style={{flex:1}}>
                <Text style={{fontSize:13,fontWeight:'700',color:'#061907'}}>Portal-Link per iMessage senden</Text>
                <Text style={{fontSize:11,color:'#747871',marginTop:1}}>
                  An {user?.emergencyContacts.find((c:any)=>c.isPrimary)?.name ?? user?.emergencyContacts[0]?.name}
                </Text>
              </View>
              <ChevronRight size={16} color="#c3c8bf"/>
            </TouchableOpacity>
          )}
        </>
      ) : (
        <>
          <View style={styles.noTourCard}>
            <Mountain size={56} color="#2D6A4F" strokeWidth={1.5} />
            <Text style={styles.noTourTitle}>Keine aktive Tour</Text>
            <Text style={styles.noTourSub}>Aktiviere den Safety-Timer bevor du losgehst</Text>
            <TouchableOpacity style={styles.startBtn} onPress={() => router.push('/create-tour')}>
              <Text style={styles.startBtnText}>Tour starten</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Freunde auf Tour — immer sichtbar */}
          {friendsOnTour.length > 0 && (
            <View style={{marginHorizontal:16, marginBottom:12}}>
              <Text style={styles.sectionTitle}>FREUNDE UNTERWEGS ({friendsOnTour.length})</Text>
              <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
                {friendsOnTour.map((f: any) => {
                  const eta = f.activeTour?.eta ? new Date(f.activeTour.eta) : null;
                  const isAlarm = f.activeTour?.status === 'ALARM';
                  const etaStr = eta ? eta.toLocaleDateString('de-CH',{day:'2-digit',month:'2-digit'}) + ' ' + eta.toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'}) : '—';
                  return (
                    <TouchableOpacity key={f.friendshipId} style={{width:'47%',backgroundColor:isAlarm?'#fff8f8':'#fff',borderRadius:10,borderWidth:1,borderColor:isAlarm?'#ffdad6':'#e1e3e4',padding:10}} onPress={()=>router.push({pathname:'/friend-profile',params:{friendshipId:f.friendshipId,name:f.name}})}>
                      <View style={{flexDirection:'row',alignItems:'center',gap:6,marginBottom:4}}>
                        <View style={{width:28,height:28,borderRadius:14,backgroundColor:isAlarm?'#ffdad6':'#f0faf4',alignItems:'center',justifyContent:'center'}}>
                          <Mountain size={13} color={isAlarm?'#ba1a1a':'#2c694e'} strokeWidth={2}/>
                        </View>
                        {isAlarm && <View style={{backgroundColor:'#ba1a1a',borderRadius:4,paddingHorizontal:5,paddingVertical:1}}><Text style={{fontSize:8,fontWeight:'800',color:'#fff'}}>ALARM</Text></View>}
                      </View>
                      <Text style={{fontSize:13,fontWeight:'700',color:'#061907'}} numberOfLines={1}>{f.name}</Text>
                      <Text style={{fontSize:10,color:'#747871',marginTop:1}} numberOfLines={1}>{f.activeTour?.activity ?? 'Tour'}</Text>
                      <Text style={{fontSize:10,color:isAlarm?'#ba1a1a':'#2c694e',fontWeight:'600',marginTop:2}}>↩ {etaStr}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

      {/* Geplante Touren */}
          {plannedTours.length > 0 && (
            <View style={styles.plannedSection}>
              <Text style={styles.sectionTitle}>GEPLANTE TOUREN</Text>
              {plannedTours.map((pt: any) => {
                const hasEta = !!pt.eta;
                const etaDate = pt.eta ? new Date(pt.eta) : null;
                const isToday = etaDate && etaDate.toDateString() === new Date().toDateString();
                const etaStr = etaDate
                  ? (isToday
                    ? `Heute · ${etaDate.toLocaleTimeString('de-CH', {hour:'2-digit',minute:'2-digit'})} Uhr`
                    : etaDate.toLocaleDateString('de-CH', {weekday:'short',day:'2-digit',month:'2-digit'}) + ' · ' + etaDate.toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'}) + ' Uhr')
                  : null;
                return (
                  <TouchableOpacity key={pt.id} style={styles.plannedCard}
                    onPress={() => router.push(`/tour-detail?id=${pt.id}`)}>
                    {/* Color bar */}
                    <View style={[styles.plannedBar, { backgroundColor: ACTIVITY_COLORS[pt.activity] ?? '#1a2e1a' }]}>
                      <Mountain size={12} color="rgba(255,255,255,0.8)" strokeWidth={2}/>
                      <Text style={styles.plannedActLabel}>{ACTIVITY_LABELS[pt.activity] ?? pt.activity}</Text>
                      <View style={{flex:1}}/>
                      {pt.distanceKm ? <Text style={styles.plannedBarStat}>{pt.distanceKm} km</Text> : null}
                      {pt.difficulty ? <Text style={styles.plannedBarStat}>{pt.difficulty}</Text> : null}
                    </View>
                    {/* Body */}
                    <View style={styles.plannedBody}>
                      <View style={{flex:1}}>
                        <Text style={styles.plannedName} numberOfLines={1}>
                          {pt.routeName || (ACTIVITY_LABELS[pt.activity] ?? pt.activity)}
                        </Text>
                        <View style={{flexDirection:'row', alignItems:'center', gap:6, marginTop:3}}>
                          {etaStr
                            ? <Text style={styles.plannedEta}>🕐 Rückkehr: {etaStr}</Text>
                            : <Text style={[styles.plannedEta, {color:'#dc2626'}]}>⚠ Keine Rückkehrzeit gesetzt</Text>
                          }
                        </View>
                        {pt.parkingLocation
                          ? <Text style={styles.plannedMeta} numberOfLines={1}>📍 {pt.parkingLocation}</Text>
                          : null}
                      </View>
                      <TouchableOpacity
                        style={[styles.startPlannedBtn, !hasEta && styles.startPlannedBtnDisabled]}
                        onPress={async (e) => {
                          e.stopPropagation();
                          if (!hasEta) {
                            showAlert('Rückkehrzeit fehlt', 'Bitte zuerst eine Rückkehrzeit in der Tour einstellen bevor du startest.');
                            return;
                          }
                          try {
                            const token = await getToken();
                            await apiFetch(`/tours/${pt.id}/start`, { method: 'POST', body: JSON.stringify({ eta: pt.eta }) }, token ?? undefined);
                            await startLocationTracking(pt.id);
                            loadData();
                          } catch (err: any) { showAlert('Fehler', err.message); }
                        }}>
                        <Text style={styles.startPlannedBtnTxt}>{hasEta ? '▶ Starten' : '⚠ ETA fehlt'}</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <Text style={styles.sectionTitle}>SCHNELLZUGRIFF</Text>
          <View style={styles.quickGrid}>
            <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/vehicle')}>
              <Car size={26} color="#2D6A4F" strokeWidth={1.8} />
              <Text style={styles.quickTitle}>{vehicle ? `${vehicle.make} ${vehicle.model}` : 'Fahrzeug'}</Text>
              <Text style={styles.quickSub}>{vehicle ? vehicle.plate : 'Hinzufügen'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/tours')}>
              <BookOpen size={26} color="#2D6A4F" strokeWidth={1.8} />
              <Text style={styles.quickTitle}>Archiv</Text>
              <Text style={styles.quickSub}>Vergangene Touren</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/profile')}>
              <User size={26} color="#2D6A4F" strokeWidth={1.8} />
              <Text style={styles.quickTitle}>Profil</Text>
              <Text style={styles.quickSub}>Notfallinfos</Text>
            </TouchableOpacity>
          </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' },
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { paddingBottom: 50 },

  verifyBanner: { backgroundColor: '#fff3cd', paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#ffe69c' },
  verifyBannerTxt: { color: '#856404', fontSize: 12, fontWeight: '700' },
  topNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#edeeef' },
  topNavLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoText: { fontSize: 20, fontWeight: '800', color: '#061907', letterSpacing: -0.5 },
  accountBtn: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#f3f4f5', alignItems: 'center', justifyContent: 'center' },

  statusBanner: { marginHorizontal: 16, marginTop: 16, borderRadius: 6, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1 },
  statusBannerGreen: { backgroundColor: '#aeeecb', borderColor: '#2c694e' },
  statusBannerRed: { backgroundColor: '#ffdad6', borderColor: '#ba1a1a' },
  statusBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusIconBox: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  statusIconGreen: { backgroundColor: '#2c694e' },
  statusIconRed: { backgroundColor: '#ba1a1a' },
  statusSmall: { fontSize: 10, fontWeight: '700', color: '#374151', letterSpacing: 1, opacity: 0.8 },
  statusBig: { fontSize: 14, fontWeight: '700', color: '#111' },
  syncLabel: { fontSize: 10, fontWeight: '700', color: '#666', letterSpacing: 0.5 },
  syncVal: { fontSize: 12, color: '#333', fontWeight: '600' },

  countdownCard: { marginHorizontal: 16, marginTop: 12, backgroundColor: '#fff', borderRadius: 8, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: '#edeeef', overflow: 'hidden' },
  progressBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: '#edeeef' },
  progressFill: { height: 3 },
  countdownLabel: { fontSize: 11, fontWeight: '700', color: '#aaa', letterSpacing: 1, marginBottom: 10, marginTop: 8 },
  countdownTime: { fontSize: 52, fontWeight: '900', color: '#061907', letterSpacing: -2, marginBottom: 10 },
  countdownSub: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 18, marginBottom: 20, maxWidth: 280 },
  checkoutBtn: { backgroundColor: '#061907', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 6, width: '100%', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  checkoutBtnRed: { backgroundColor: '#dc2626' },
  checkoutText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  row: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 12 },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#edeeef' },
  cardLabel: { fontSize: 10, fontWeight: '700', color: '#aaa', letterSpacing: 1, marginBottom: 10 },
  tourName: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 2 },
  tourRoute: { fontSize: 12, color: '#888', marginBottom: 8 },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 10 },
  miniStat: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  miniStatText: { fontSize: 12, color: '#888', fontWeight: '500' },
  detailLink: { fontSize: 12, color: '#2D6A4F', fontWeight: '700' },
  weatherTemp: { fontSize: 28, fontWeight: '900', color: '#061907', letterSpacing: -1 },
  weatherDesc: { fontSize: 11, color: '#888', marginTop: 2, marginBottom: 4 },

  rescueCard: { marginHorizontal: 16, marginTop: 12, backgroundColor: '#ffdad6', borderRadius: 8, padding: 20, borderWidth: 1, borderColor: 'rgba(186,26,26,0.15)' },
  rescueTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  rescueBadge: { backgroundColor: '#ba1a1a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  rescueBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  rescueTitle: { fontSize: 18, fontWeight: '800', color: '#93000a', marginBottom: 6 },
  rescueSub: { fontSize: 12, color: '#93000a', opacity: 0.8, lineHeight: 18, marginBottom: 14 },
  rescueBtn: { backgroundColor: '#fff', borderRadius: 6, padding: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(186,26,26,0.15)' },
  rescueBtnText: { color: '#ba1a1a', fontWeight: '700', fontSize: 13 },

  noTourCard: { marginHorizontal: 16, marginTop: 20, backgroundColor: '#fff', borderRadius: 8, padding: 36, alignItems: 'center', borderWidth: 1, borderColor: '#edeeef', gap: 8 },
  noTourTitle: { fontSize: 20, fontWeight: '800', color: '#111', marginTop: 8 },
  noTourSub: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 18, marginBottom: 8 },
  startBtn: { backgroundColor: '#1a2e1a', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 6, marginTop: 8 },
  startBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  sectionTitle: { fontSize: 10, fontWeight: '700', color: '#aaa', letterSpacing: 1, marginHorizontal: 16, marginTop: 20, marginBottom: 10 },
  quickGrid: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 12 },
  quickCard: { flex: 1, backgroundColor: '#fff', borderRadius: 6, padding: 14, borderWidth: 1, borderColor: '#edeeef', gap: 6 },
  quickTitle: { fontSize: 12, fontWeight: '700', color: '#111' },
  quickSub: { fontSize: 10, color: '#aaa' },
  plannedSection: { marginHorizontal: 16, marginTop: 8, marginBottom: 4 },
  plannedCard: { backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#e1e3e4', marginBottom: 10, elevation: 1 },
  plannedBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10 },
  plannedActLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.9)', letterSpacing: 0.3 },
  plannedBarStat: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.65)', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  plannedBody: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  plannedName: { fontSize: 15, fontWeight: '800', color: '#061907', letterSpacing: -0.2 },
  plannedEta: { fontSize: 12, color: '#2c694e', fontWeight: '600' },
  plannedMeta: { fontSize: 11, color: '#747871', marginTop: 3 },
  startPlannedBtn: { backgroundColor: '#061907', borderRadius: 6, paddingVertical: 10, paddingHorizontal: 14, minWidth: 80, alignItems: 'center' },
  startPlannedBtnDisabled: { backgroundColor: '#e1e3e4' },
  startPlannedBtnTxt: { fontSize: 12, fontWeight: '800', color: '#fff' },


  tourCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
activityIconBox: { width: 36, height: 36, borderRadius: 6, backgroundColor: '#f0faf4', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
weatherIcon: { fontSize: 28, marginBottom: 4 },
weatherTemp: { fontSize: 26, fontWeight: '900', color: '#061907', letterSpacing: -1 },
weatherDesc: { fontSize: 11, color: '#888', marginTop: 2, marginBottom: 4 },

infoGrid: { marginHorizontal: 16, marginTop: 12, flexDirection: 'row', gap: 10 },
infoCard: { flex: 1, backgroundColor: '#fff', borderRadius: 4, padding: 16, borderWidth: 1, borderColor: '#e1e3e4' },
statsList: { gap: 6, marginBottom: 12 },
statLine: { flexDirection: 'row', justifyContent: 'space-between' },
statLineKey: { fontSize: 12, color: '#747871' },
statLineVal: { fontSize: 12, fontWeight: '700', color: '#191c1d' },
weatherTempLarge: { fontSize: 42, fontWeight: '900', color: '#061907', letterSpacing: -2, marginTop: 4, marginBottom: 2 },
weatherCondition: { fontSize: 12, color: '#747871', marginBottom: 4 },
detailLink: { fontSize: 12, color: '#2c694e', fontWeight: '700' },
});