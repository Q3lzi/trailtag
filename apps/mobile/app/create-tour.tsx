import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView, TextInput } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { apiFetch } from '../lib/api';
import { getToken } from '../lib/storage';
import { showAlert } from '../lib/alert';
import { scheduleOverdueNotification } from '../lib/notifications';
import { startLocationTracking } from '../lib/tracking';
import {
  ArrowLeft, ArrowRight, Check, MapPin, Upload, Calendar, Clock,
  Car, Mountain, Flag, User, Plus, Trash2, Home, Tent,
  Building, CheckSquare, Square, AlertTriangle, Navigation,
  Activity, Wind, UserPlus, X
} from 'lucide-react-native';

const ACTIVITIES = [
  { key:'WANDERN',      label:'Wandern',      Icon:Mountain,   color:'#1a3d2b', fields:['sac','distance','elevation'] },
  { key:'BERGTOUR',     label:'Bergtour',      Icon:Mountain,   color:'#0f2027', fields:['sac','distance','elevation'] },
  { key:'KLETTERN',     label:'Klettern',      Icon:Activity,   color:'#1a1a2e', fields:['sac_klettern','equipment'] },
  { key:'KLETTERSTEIG', label:'Klettersteig',  Icon:Flag,       color:'#7c3d1a', fields:['klettersteig_grade','equipment'] },
  { key:'TRAILRUNNING', label:'Trailrunning',  Icon:Activity,   color:'#1a2e1a', fields:['distance','elevation'] },
  { key:'MOUNTAINBIKE', label:'MTB',           Icon:Navigation, color:'#1f2d1f', fields:['mtb_scale','distance','elevation','trail_type'] },
  { key:'RADSPORT',     label:'Radsport',      Icon:Navigation, color:'#162616', fields:['distance','elevation'] },
  { key:'SKI_SNOWBOARD',label:'Ski/Snowboard', Icon:Wind,       color:'#0d1b2a', fields:['piste_level','resort','avalanche'] },
  { key:'SKITOUR',      label:'Skitour',       Icon:Wind,       color:'#0d1b2a', fields:['sac','distance','elevation','avalanche'] },
  { key:'KANU_KAJAK',   label:'Kanu/Kajak',    Icon:Navigation, color:'#0d2137', fields:['distance'] },
  { key:'PARAGLIDING',  label:'Paragliding',   Icon:Wind,       color:'#0d1f3c', fields:[] },
  { key:'ANDERE',       label:'Andere',        Icon:Mountain,   color:'#1a2e1a', fields:['distance'] },
];
const SAC_LEVELS = [
  {key:'T1',desc:'Wanderweg'},{key:'T2',desc:'Bergwanderweg'},{key:'T3',desc:'Anspruchsvoll'},
  {key:'T4',desc:'Alpinwanderweg'},{key:'T5',desc:'Anspruchsvoller Alpin'},{key:'T6',desc:'Schwieriger Alpin'},
];
const KLETTERSTEIG_GRADES = ['A','B','C','D','E'];
const MTB_SCALES = ['S0','S1','S2','S3','S4','S5'];
const PISTE_LEVELS = ['Blau','Rot','Schwarz','Freeride'];
const AVALANCHE_RISKS = [
  {key:'1',desc:'Gering'},{key:'2',desc:'Mässig'},{key:'3',desc:'Erheblich'},{key:'4',desc:'Gross'},{key:'5',desc:'Sehr gross'},
];
const TRAIL_TYPES = ['Flow Trail','Enduro','Downhill','Cross Country','Technisch'];
const OVERNIGHT_TYPES = [
  {key:'huette',    label:'SAC Hütte',    Icon:Home},
  {key:'berghütte', label:'Berghütte',    Icon:Mountain},
  {key:'hotel',     label:'Hotel/B&B',    Icon:Building},
  {key:'zelt',      label:'Zelt/Biwak',   Icon:Tent},
  {key:'camping',   label:'Camping',      Icon:Flag},
  {key:'schutz',    label:'Schutzhütte',  Icon:Home},
  {key:'privat',    label:'Privat',       Icon:User},
];
const STEPS = ['Aktivität','Zeitplan','Route','Personen','Details','Übersicht'];

type OvernightStop = { night:number; type:string; name:string; address:string; lat:string; lng:string; reserved:boolean; contactName:string; contactPhone:string; notes:string; };
type PersonInfo = { name:string; age:string; notes:string };
type Waypoint = { name:string; lat:string; lng:string; notes:string };
type NewContact = { name:string; phone:string; relation:string };

// ─── Map Picker ───────────────────────────────────────────────────
// key prop forces remount when coordinates change externally (e.g. GPS)
function MapPicker({ lat, lng, onSelect, mapKey }: { lat:string; lng:string; onSelect:(lat:string,lng:string)=>void; mapKey:string }) {
  const mapId = `map-picker-${mapKey}`;
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const timer = setTimeout(() => {
      const container = document.getElementById(mapId);
      if (!container) return;
      if (!document.getElementById('leaflet-css-picker')) {
        const link = document.createElement('link');
        link.id='leaflet-css-picker'; link.rel='stylesheet';
        link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      import('leaflet').then((L) => {
        if ((container as any)._leaflet_id) { container.innerHTML=''; delete (container as any)._leaflet_id; }
        const initLat = lat ? parseFloat(lat) : 46.8182;
        const initLng = lng ? parseFloat(lng) : 8.2275;
        const zoom = lat ? 13 : 7;
        const map = L.default.map(container).setView([initLat, initLng], zoom);
        L.default.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{attribution:'© OSM © CARTO'}).addTo(map);
        // Show GPX route if available
        const gpxEl = (window as any).__trailtag_gpx;
        if (gpxEl?.points?.length > 1) {
          const pts = gpxEl.points.map((p:any) => [p.lat, p.lng]);
          L.default.polyline(pts, { color:'#2c694e', weight:3, opacity:0.7 }).addTo(map);
          map.fitBounds(L.default.latLngBounds(pts), { padding:[20,20], maxZoom:15 });
        }
        // Show existing marker if coords present
        if (lat && lng) {
          markerRef.current = L.default.circleMarker([initLat,initLng],{radius:8,fillColor:'#2c694e',color:'#fff',weight:2,fillOpacity:1})
            .bindPopup('Ausgewählt').addTo(map);
        }
        map.on('click',(e:any) => {
          const {lat:clat,lng:clng} = e.latlng;
          if (markerRef.current) { map.removeLayer(markerRef.current); }
          markerRef.current = L.default.circleMarker([clat,clng],{radius:8,fillColor:'#2c694e',color:'#fff',weight:2,fillOpacity:1})
            .bindPopup(`${clat.toFixed(4)}, ${clng.toFixed(4)}`).addTo(map).openPopup();
          onSelect(clat.toFixed(6), clng.toFixed(6));
        });
      });
    }, 350);
    return () => clearTimeout(timer);
  }, []);  // only on mount

  if (Platform.OS !== 'web') return null;
  return (
    <View style={{marginBottom:8}}>
      <Text style={styles.inputLabel}>Auf Karte klicken zum Auswählen</Text>
      <div id={mapId} style={{width:'100%',height:180,borderRadius:6,overflow:'hidden',border:'1px solid #e1e3e4'} as any} />
      {lat && lng ? (
        <Text style={{fontSize:11,color:'#2c694e',marginTop:4,fontWeight:'600'}}>Koordinaten: {parseFloat(lat).toFixed(4)}, {parseFloat(lng).toFixed(4)}</Text>
      ) : null}
    </View>
  );
}

// ─── GPX Map Preview ─────────────────────────────────────────────
function GpxMapPreview({ points, waypoints }: { points:any[]; waypoints?:any[] }) {
  const mapId = useRef(`gpx-prev-${Date.now()}`).current;
  useEffect(() => {
    if (Platform.OS !== 'web' || !points?.length) return;
    const timer = setTimeout(() => {
      const container = document.getElementById(mapId);
      if (!container) return;
      if (!document.getElementById('leaflet-css-gpx')) {
        const link = document.createElement('link');
        link.id='leaflet-css-gpx'; link.rel='stylesheet';
        link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      import('leaflet').then((L) => {
        if ((container as any)._leaflet_id) { container.innerHTML=''; delete (container as any)._leaflet_id; }
        const map = L.default.map(container);
        L.default.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{attribution:'© OSM © CARTO'}).addTo(map);
        const coords = points.map((p:any) => [p.lat,p.lng] as [number,number]);
        const poly = L.default.polyline(coords,{color:'#2c694e',weight:3}).addTo(map);
        L.default.circleMarker(coords[0],{radius:7,fillColor:'#2c694e',color:'#fff',weight:2,fillOpacity:1}).bindPopup('Start').addTo(map);
        L.default.circleMarker(coords[coords.length-1],{radius:7,fillColor:'#dc2626',color:'#fff',weight:2,fillOpacity:1}).bindPopup('Ziel').addTo(map);
        if (waypoints?.length) {
          waypoints.forEach((wp:any) => {
            L.default.circleMarker([wp.lat,wp.lng],{radius:7,fillColor:'#f59e0b',color:'#fff',weight:2,fillOpacity:1})
              .bindPopup(wp.name||'Wegpunkt').addTo(map);
          });
        }
        map.fitBounds(poly.getBounds(),{padding:[16,16]});
      });
    }, 300);
    return () => clearTimeout(timer);
  }, []);
  if (Platform.OS !== 'web') return null;
  return <div id={mapId} style={{width:'100%',height:220,borderRadius:6,overflow:'hidden',marginTop:10} as any} />;
}

// ─── Elevation Chart ─────────────────────────────────────────────
function ElevationChart({ points }: { points:any[] }) {
  if (Platform.OS !== 'web') return null;
  const filtered = points.filter((p:any) => p.ele != null);
  if (filtered.length < 2) return null;
  const eles = filtered.map((p:any) => p.ele);
  const minE = Math.min(...eles), maxE = Math.max(...eles), range = maxE-minE||1;
  const svgW = Math.max(600, filtered.length*1.2), h=90, pad=10;
  const pts = filtered.map((p:any,i:number) => {
    const x = pad+(i/(filtered.length-1))*(svgW-pad*2);
    const y = h-pad-((p.ele-minE)/range)*(h-pad*2);
    return `${x},${y}`;
  }).join(' ');
  const area = `${pad},${h-pad} ${pts} ${svgW-pad},${h-pad}`;
  return (
    <View style={{marginTop:10}}>
      <Text style={styles.inputLabel}>Höhenprofil</Text>
      <View style={{backgroundColor:'#fff',borderRadius:4,borderWidth:1,borderColor:'#e1e3e4',overflow:'hidden'}}>
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <svg viewBox={`0 0 ${svgW} ${h}`} style={{width:svgW,height:h} as any}>
            <defs>
              <linearGradient id="eg2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2c694e" stopOpacity="0.25"/>
                <stop offset="100%" stopColor="#2c694e" stopOpacity="0.02"/>
              </linearGradient>
            </defs>
            <polygon points={area} fill="url(#eg2)"/>
            <polyline points={pts} fill="none" stroke="#2c694e" strokeWidth="2"/>
            <text x={pad+2} y={pad+12} fontSize="10" fill="#747871">{Math.round(maxE)} m</text>
            <text x={pad+2} y={h-3} fontSize="10" fill="#747871">{Math.round(minE)} m</text>
          </svg>
        </ScrollView>
      </View>
    </View>
  );
}

  // ─── DateTime Row ─────────────────────────────────────────────
function DtRow({label,dt,setDt,showD,setShowD,showT,setShowT}:any) {
  return (
    <View style={{marginBottom:14}}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.dtRow}>
        {Platform.OS==='web' ? (
          <>
            <input type="date" style={styles.webDateIn as any}
              min={`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`}
              value={`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`}
              onChange={e => {
                const [y,m,d]=e.target.value.split('-').map(Number);
                const n=new Date(dt); n.setFullYear(y,m-1,d); setDt(n);
              }}
            />
            <input type="time" style={styles.webTimeIn as any}
              value={`${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`}
              onChange={e => {
                const [h,m]=e.target.value.split(':').map(Number);
                const n=new Date(dt); n.setHours(h,m,0,0); setDt(n);
              }}
            />
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.dtBtn} onPress={()=>setShowD(true)}>
              <Calendar size={13} color="#747871" strokeWidth={2}/>
              <Text style={styles.dtBtnText}>{dt.toLocaleDateString('de-CH',{day:'2-digit',month:'2-digit',year:'2-digit'})}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dtBtn} onPress={()=>setShowT(true)}>
              <Clock size={13} color="#747871" strokeWidth={2}/>
              <Text style={styles.dtBtnText}>{dt.toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'})}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      {showD&&Platform.OS!=='web'&&(
        <DateTimePicker value={dt} mode="date" display="inline" minimumDate={new Date()}
          onChange={(e,d)=>{if(d){const n=new Date(dt);n.setFullYear(d.getFullYear(),d.getMonth(),d.getDate());setDt(n);}if(e.type==='set')setShowD(false);}}/>
      )}
      {showT&&Platform.OS!=='web'&&(
        <DateTimePicker value={dt} mode="time" display="spinner" is24Hour
          onChange={(e,d)=>{if(d){const n=new Date(dt);n.setHours(d.getHours(),d.getMinutes(),0,0);setDt(n);}if(e.type==='set')setShowT(false);}}/>
      )}
    </View>
  );
}


  // ─── Error Banner ─────────────────────────────────────────────
function ErrorBanner({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <View style={styles.errorBanner}>
      <AlertTriangle size={14} color="#ba1a1a" strokeWidth={2}/>
      <View style={{flex:1}}>
        {errors.map((e,i) => <Text key={i} style={styles.errorText}>{e}</Text>)}
      </View>
    </View>
  );
}


export default function CreateTourScreen() {
  const params = useLocalSearchParams<{prefill?:string}>();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  const [activity, setActivity] = useState('');
  const [multiDay, setMultiDay] = useState(false);
  const [startDateTime, setStartDateTime] = useState<Date>(() => { const d=new Date(); d.setHours(8,0,0,0); return d; });
  const [etaDateTime, setEtaDateTime] = useState<Date>(() => { const d=new Date(); d.setHours(17,0,0,0); return d; });
  const [returnDays, setReturnDays] = useState(2);
  const [overnightStops, setOvernightStops] = useState<OvernightStop[]>([]);
  const [showSD,setShowSD]=useState(false); const [showST,setShowST]=useState(false);
  const [showED,setShowED]=useState(false); const [showET,setShowET]=useState(false);

  const [routeName, setRouteName] = useState('');
  const [startLat, setStartLat] = useState('');
  const [startLng, setStartLng] = useState('');
  // parkingMap key forces MapPicker remount when GPS sets coords
  const [parkingMapKey, setParkingMapKey] = useState(0);
  const [parkingLocation, setParkingLocation] = useState('');
  const [parkingLat, setParkingLat] = useState('');
  const [parkingLng, setParkingLng] = useState('');
  const [locationStatus, setLocationStatus] = useState<'idle'|'loading'|'ok'|'denied'>('idle');
  const [gpxData, setGpxData] = useState<any>(null);
  const [gpxFileContent, setGpxFileContent] = useState<string|null>(null);
  const [gpxLoading, setGpxLoading] = useState(false);
  const [distanceKm, setDistanceKm] = useState('');
  const [elevationUp, setElevationUp] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [klettersteigGrade, setKlettersteigGrade] = useState('');
  const [mtbScale, setMtbScale] = useState('');
  const [pisteLevel, setPisteLevel] = useState('');
  const [resort, setResort] = useState('');
  const [avalancheRisk, setAvalancheRisk] = useState('');
  const [trailType, setTrailType] = useState('');
  const [equipmentNotes, setEquipmentNotes] = useState('');
  // Manual waypoints (separate from GPX waypoints)
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [newWpName, setNewWpName] = useState('');
  const [newWpLat, setNewWpLat] = useState('');
  const [newWpLng, setNewWpLng] = useState('');
  const [newWpNotes, setNewWpNotes] = useState('');
  const [showAddWp, setShowAddWp] = useState(false);

  const [persons, setPersons] = useState<PersonInfo[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [profileContacts, setProfileContacts] = useState<any[]>([]);
  const [profileFriends, setProfileFriends] = useState<any[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState<NewContact>({name:'',phone:'',relation:''});
  const [vehicleId, setVehicleId] = useState<string|null>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [routeDesc, setRouteDesc] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const actCfg = ACTIVITIES.find(a => a.key === activity);
  const hasField = (f:string) => actCfg?.fields?.includes(f) ?? false;

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const [v,p,fr] = await Promise.all([
          apiFetch('/vehicles',{},token??undefined),
          apiFetch('/profile',{},token??undefined),
          apiFetch('/friends',{},token??undefined).catch(()=>({friends:[]})),
        ]);
        setVehicles(v);
        if (v.length>0) setVehicleId(v[0].id);
        const contacts = p.emergencyContacts ?? [];
        setProfileContacts(contacts);
        setSelectedContacts(contacts.filter((c:any)=>c.isPrimary).map((c:any)=>c.id));
        setProfileFriends((fr.friends??[]).filter((f:any)=>f.name));
      } catch {}
    }
    load();
  },[]);

  useEffect(() => {
    if (multiDay && returnDays > 1) {
      const nights = returnDays-1;
      setOvernightStops(prev => Array.from({length:nights},(_,i) =>
        prev[i] ?? {night:i+1,type:'',name:'',address:'',lat:'',lng:'',reserved:false,contactName:'',contactPhone:'',notes:''}
      ));
    } else {
      setOvernightStops([]);
    }
  },[returnDays,multiDay]);

  useEffect(() => {
    if (!params.prefill) return;
    try {
      const p = JSON.parse(params.prefill);
      if (p.activity) setActivity(p.activity);
      if (p.routeName) setRouteName(p.routeName);
      if (p.difficulty) setDifficulty(p.difficulty);
      if (p.distanceKm) setDistanceKm(String(p.distanceKm));
      if (p.elevationUp) setElevationUp(String(p.elevationUp));
      if (p.parkingLocation) setParkingLocation(p.parkingLocation);
      if (p.notes) setNotes(p.notes);
      if (p.vehicleId) setVehicleId(p.vehicleId);
      if (p.persons && Number(p.persons)>0) setPersons(Array(Number(p.persons)).fill(null).map(()=>({name:'',age:'',notes:''})));
    } catch {}
  },[params.prefill]);

  function updateStop(i:number, patch:Partial<OvernightStop>) {
    setOvernightStops(prev => prev.map((s,j) => j===i ? {...s,...patch} : s));
  }

  async function handleGetLocation() {
    if (Platform.OS==='web') {
      setLocationStatus('loading');
      navigator.geolocation.getCurrentPosition(
        pos => {
          const lat = pos.coords.latitude.toFixed(6);
          const lng = pos.coords.longitude.toFixed(6);
          setStartLat(lat); setStartLng(lng);
          // Always overwrite parking coords with GPS
          setParkingLat(lat); setParkingLng(lng);
          setParkingMapKey(k => k+1);
          setLocationStatus('ok');
        },
        () => setLocationStatus('denied')
      );
      return;
    }
    const {status} = await Location.requestForegroundPermissionsAsync();
    if (status!=='granted') { setLocationStatus('denied'); return; }
    setLocationStatus('loading');
    const pos = await Location.getCurrentPositionAsync({});
    const lat = pos.coords.latitude.toFixed(6);
    const lng = pos.coords.longitude.toFixed(6);
    setStartLat(lat); setStartLng(lng);
    setParkingLat(lat); setParkingLng(lng); setParkingMapKey(k=>k+1);
    setLocationStatus('ok');
  }

  async function handleGpxUpload(event?:any) {
    setGpxLoading(true);
    try {
      let text = '';
      if (Platform.OS==='web') {
        const file = event?.target?.files?.[0];
        if (!file) { setGpxLoading(false); return; }
        text = await file.text();
      } else {
        const result = await DocumentPicker.getDocumentAsync({type:'*/*',copyToCacheDirectory:true});
        if (result.canceled) { setGpxLoading(false); return; }
        text = await (await fetch(result.assets[0].uri)).text();
      }
      setGpxFileContent(text);
      const token = await getToken();
      const data = await apiFetch('/gpx/parse',{method:'POST',body:JSON.stringify({gpxContent:text})},token??undefined);
setGpxData(data);
      if (Platform.OS === 'web') { (window as any).__trailtag_gpx = data; }
if (data.distanceKm) setDistanceKm(String(data.distanceKm));
if (data.elevationUp) setElevationUp(String(data.elevationUp));
// NEU: Routenname aus GPX übernehmen wenn Feld leer
if (data.routeName && !routeName) setRouteName(data.routeName);
if (data.startLat) {
  setStartLat(String(data.startLat));
  setStartLng(String(data.startLng));
  if (!parkingLat) {
    setParkingLat(String(data.startLat));
    setParkingLng(String(data.startLng));
    setParkingMapKey(k => k + 1); // MapPicker neu laden
  }
  setLocationStatus('ok');
}
    } catch { showAlert('Fehler','GPX konnte nicht gelesen werden.'); }
    finally { setGpxLoading(false); }
  }

  // Per-step validation
  function validateStep(s: number): string[] {
    const errs: string[] = [];
    if (s === 0 && !activity) errs.push('Bitte eine Aktivität wählen');
    if (s === 1 && etaDateTime <= startDateTime) errs.push('Rückkehrzeit muss nach dem Start liegen');
    return errs;
  }

  function tryNext() {
    const errs = validateStep(step);
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    setStep(s => s+1);
  }

  async function handleSubmit(planOnly:boolean) {
    if (!activity) { setErrors(['Bitte eine Aktivität wählen']); return; }
    if (etaDateTime.getTime()<Date.now()) { setErrors(['Rückkehrzeit muss in der Zukunft liegen']); return; }
    setLoading(true);
    try {
      const token = await getToken();
      const allWaypoints = [
        ...waypoints.map(w=>w.name),
        ...(gpxData?.waypoints?.map((w:any)=>w.name)||[]),
      ].filter(Boolean);
      const allNotes = [
        notes,
        routeDesc ? `Route: ${routeDesc}` : '',
        equipmentNotes ? `Ausrüstung: ${equipmentNotes}` : '',
      ].filter(Boolean).join('\n');
      // overnightStops saved as structured JSON separately

      const diffLabel = difficulty||klettersteigGrade||mtbScale||pisteLevel||null;
      const tour = await apiFetch('/tours',{
        method:'POST',
        body:JSON.stringify({
          activity, routeName:routeName||null, difficulty:diffLabel,
          persons: persons.length + 1,
          companions: persons.length > 0 ? persons.map(p => ({ name: p.name.trim(), age: p.age.trim(), notes: p.notes.trim() })).filter(p => p.name || p.age || p.notes) : null,
          distanceKm: distanceKm ? parseFloat(distanceKm) : null,
          elevationUp: elevationUp ? parseInt(elevationUp) : null,
          parkingLocation: parkingLocation||null, notes: allNotes||null,
          overnightStops: overnightStops.length>0 ? overnightStops : null,
          startLat: startLat ? parseFloat(startLat) : null, startLng: startLng ? parseFloat(startLng) : null,
          vehicleId: vehicleId??null,
        }),
      },token??undefined);

      // Preserve device local timezone so alarm fires at correct local time
      const _pad = (n: number) => String(n).padStart(2,'0');
      const _off = -etaDateTime.getTimezoneOffset();
      const _sign = _off >= 0 ? '+' : '-';
      const _tzStr = `${_sign}${_pad(Math.floor(Math.abs(_off)/60))}:${_pad(Math.abs(_off)%60)}`;
      const eta = `${etaDateTime.getFullYear()}-${_pad(etaDateTime.getMonth()+1)}-${_pad(etaDateTime.getDate())}T${_pad(etaDateTime.getHours())}:${_pad(etaDateTime.getMinutes())}:00${_tzStr}`;
      if (!planOnly) {
        await apiFetch(`/tours/${tour.id}/start`,{method:'POST',body:JSON.stringify({eta})},token??undefined);
        if (gpxData&&gpxFileContent) await apiFetch(`/gpx/attach/${tour.id}`,{method:'POST',body:JSON.stringify({gpxContent:gpxFileContent})},token??undefined);
        await startLocationTracking(tour.id);
        await scheduleOverdueNotification(etaDateTime);
        router.replace('/dashboard');
      } else {
        await apiFetch(`/tours/${tour.id}/plan`,{method:'POST',body:JSON.stringify({eta})},token??undefined);
        if (gpxData&&gpxFileContent) await apiFetch(`/gpx/attach/${tour.id}`,{method:'POST',body:JSON.stringify({gpxContent:gpxFileContent})},token??undefined);
        showAlert('Gespeichert','Tour wurde geplant.');
        router.replace('/tours');
      }
    } catch(err:any) { setErrors([err.message]); }
    finally { setLoading(false); }
  }

  // ─── Steps ────────────────────────────────────────────────────
  function S0() {
    return (
      <View>
        <Text style={styles.stepTitle}>Aktivität wählen</Text>
        <Text style={styles.stepSub}>Sicherheitsparameter werden angepasst</Text>
        <View style={styles.actGrid}>
          {ACTIVITIES.map(a => {
            const on = activity===a.key;
            return (
              <TouchableOpacity key={a.key}
                style={[styles.actCard, on&&{borderColor:a.color,backgroundColor:`${a.color}12`}]}
                onPress={()=>{setActivity(a.key);setErrors([]);}}>
                <a.Icon size={22} color={on?a.color:'#c3c8bf'} strokeWidth={on?2.5:1.8}/>
                <Text style={[styles.actLabel, on&&{color:a.color,fontWeight:'800'}]}>{a.label}</Text>
                {on ? <View style={[styles.actDot,{backgroundColor:a.color}]}/> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  function S1() {
    return (
      <View>
        <Text style={styles.stepTitle}>Zeitplan</Text>
        <Text style={styles.stepSub}>Start und geplante Rückkehr</Text>
        <View style={styles.toggle}>
          <TouchableOpacity style={[styles.toggleBtn,!multiDay&&styles.toggleOn]} onPress={()=>setMultiDay(false)}>
            <Text style={[styles.toggleTxt,!multiDay&&styles.toggleTxtOn]}>Tagestour</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toggleBtn,multiDay&&styles.toggleOn]} onPress={()=>setMultiDay(true)}>
            <Text style={[styles.toggleTxt,multiDay&&styles.toggleTxtOn]}>Mehrtagestour</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          <DtRow label="GEPLANTER START" dt={startDateTime} setDt={setStartDateTime} showD={showSD} setShowD={setShowSD} showT={showST} setShowT={setShowST}/>
          <DtRow label="GEPLANTE RÜCKKEHR" dt={etaDateTime} setDt={setEtaDateTime} showD={showED} setShowD={setShowED} showT={showET} setShowT={setShowET}/>
          <Text style={styles.hint}>Alarm wird ausgelöst wenn kein Checkout bis zur Rückkehrzeit erfolgt</Text>
        </View>
        {multiDay ? (
          <View style={[styles.card,{marginTop:12}]}>
            <Text style={styles.fieldLabel}>ANZAHL NÄCHTE</Text>
            <View style={styles.counterRow}>
              <TouchableOpacity style={styles.cBtn} onPress={()=>setReturnDays(d=>Math.max(2,d-1))}>
                <Text style={styles.cBtnTxt}>−</Text>
              </TouchableOpacity>
              <Text style={styles.cVal}>{returnDays-1} {returnDays===2?'Nacht':'Nächte'}</Text>
              <TouchableOpacity style={styles.cBtn} onPress={()=>setReturnDays(d=>d+1)}>
                <Text style={styles.cBtnTxt}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  function S2() {
    return (
      <View>
        <Text style={styles.stepTitle}>Route</Text>
        <Text style={styles.stepSub}>GPX und Streckendetails</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>GPX DATEI</Text>
          {Platform.OS==='web' ? (
            <View style={[styles.gpxZone,gpxData&&styles.gpxDone]}>
              <Upload size={22} color={gpxData?'#2c694e':'#c3c8bf'} strokeWidth={gpxData?2.5:1.8}/>
              <Text style={[styles.gpxTitle,gpxData&&{color:'#2c694e'}]}>
                {gpxLoading?'Analysiere...' : gpxData?'GPX erfolgreich geladen' : 'GPX Datei wählen'}
              </Text>
              {!gpxData ? <Text style={styles.gpxSub}>Distanz, Höhenmeter, Routenname und Wegpunkte werden ausgelesen</Text> : null}
              <input type="file" accept=".gpx" style={{opacity:0,position:'absolute',inset:0,cursor:'pointer'} as any} onChange={handleGpxUpload}/>
            </View>
          ) : (
            <TouchableOpacity style={[styles.gpxZone,gpxData&&styles.gpxDone]} onPress={()=>handleGpxUpload()}>
              <Upload size={22} color={gpxData?'#2c694e':'#c3c8bf'} strokeWidth={gpxData?2.5:1.8}/>
              <Text style={[styles.gpxTitle,gpxData&&{color:'#2c694e'}]}>
                {gpxLoading?'Analysiere...' : gpxData?'GPX geladen' : 'GPX Datei laden'}
              </Text>
            </TouchableOpacity>
          )}
          {gpxData ? (
  <View>
    {/* Summary Line wie WP Version */}
    <View style={styles.gpxSummary}>
      <Text style={styles.gpxSummaryText}>{gpxData.summaryLine}</Text>
    </View>
    <View style={styles.gpxStats}>
      <View style={styles.gpxStat}><Text style={styles.gpxVal}>{gpxData.distanceKm}</Text><Text style={styles.gpxKey}>km</Text></View>
      <View style={styles.gpxDiv}/>
      <View style={styles.gpxStat}><Text style={styles.gpxVal}>{gpxData.elevationUp}</Text><Text style={styles.gpxKey}>hm ↑</Text></View>
      <View style={styles.gpxDiv}/>
      <View style={styles.gpxStat}><Text style={styles.gpxVal}>{gpxData.elevationDown}</Text><Text style={styles.gpxKey}>hm ↓</Text></View>
      <View style={styles.gpxDiv}/>
      <View style={styles.gpxStat}><Text style={styles.gpxVal}>{gpxData.pointCount}</Text><Text style={styles.gpxKey}>Punkte</Text></View>
      {gpxData.waypointCount > 0 ? (
        <View style={{flexDirection:'row',alignItems:'center',gap:16}}>
          <View style={styles.gpxDiv}/>
          <View style={styles.gpxStat}><Text style={styles.gpxVal}>{gpxData.waypointCount}</Text><Text style={styles.gpxKey}>Stopps</Text></View>
        </View>
      ) : null}
      {gpxData.durationMinutes ? (
        <View style={{flexDirection:'row',alignItems:'center',gap:16}}>
          <View style={styles.gpxDiv}/>
          <View style={styles.gpxStat}>
            <Text style={styles.gpxVal}>{Math.floor(gpxData.durationMinutes/60)}h {gpxData.durationMinutes%60}m</Text>
            <Text style={styles.gpxKey}>Dauer</Text>
          </View>
        </View>
      ) : null}
    </View>
    <GpxMapPreview points={gpxData.points} waypoints={gpxData.waypoints}/>
    <ElevationChart points={gpxData.points}/>
    {gpxData.waypoints?.length > 0 ? (
      <View style={{marginTop:10}}>
        <Text style={styles.inputLabel}>Wegpunkte aus GPX ({gpxData.waypointCount})</Text>
        {gpxData.waypoints.map((wp:any, i:number) => (
          <View key={i} style={styles.wpRow}>
            <Flag size={12} color="#f59e0b" strokeWidth={2}/>
            <View style={{flex:1}}>
              <Text style={styles.wpTxt}>{wp.name}</Text>
              {wp.ele ? <Text style={styles.wpSub}>{Math.round(wp.ele)} m</Text> : null}
            </View>
          </View>
        ))}
      </View>
    ) : null}
  </View>
) : null}
        </View>

        {/* Übernachtungen — nur bei Mehrtagestour, nach GPX damit man Route sieht */}
        {multiDay && overnightStops.map((stop,i) => (
          <View key={i} style={[styles.card,{marginTop:12}]}>
            <Text style={styles.sectionLabel}>🌙 ÜBERNACHTUNG — NACHT {stop.night}</Text>
            <Text style={styles.inputLabel}>Art der Unterkunft</Text>
            <View style={styles.typeRow}>
              {OVERNIGHT_TYPES.map(ot => (
                <TouchableOpacity key={ot.key}
                  style={[styles.typeBtn, stop.type===ot.key&&styles.typeBtnOn]}
                  onPress={()=>updateStop(i,{type:ot.key})}>
                  <ot.Icon size={16} color={stop.type===ot.key?'#2c694e':'#c3c8bf'} strokeWidth={1.8}/>
                  <Text style={[styles.typeTxt, stop.type===ot.key&&{color:'#2c694e',fontWeight:'700'}]}>{ot.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.inputLabel}>Name / Bezeichnung</Text>
            <TextInput style={styles.input} placeholder="z.B. Muttseehütte SAC" placeholderTextColor="#bbb"
              value={stop.name} onChangeText={v=>updateStop(i,{name:v})}/>
            <Text style={styles.inputLabel}>Adresse / Gebiet</Text>
            <TextInput style={styles.input} placeholder="z.B. Muttsee, Glarus" placeholderTextColor="#bbb"
              value={stop.address} onChangeText={v=>updateStop(i,{address:v})}/>
            <Text style={styles.inputLabel}>Koordinaten (auf Karte klicken)</Text>
            <View style={{flexDirection:'row',gap:8}}>
              <TextInput style={[styles.input,{flex:1}]} placeholder="Breitengrad" placeholderTextColor="#bbb"
                keyboardType="numeric" value={stop.lat} onChangeText={v=>updateStop(i,{lat:v})}/>
              <TextInput style={[styles.input,{flex:1}]} placeholder="Längengrad" placeholderTextColor="#bbb"
                keyboardType="numeric" value={stop.lng} onChangeText={v=>updateStop(i,{lng:v})}/>
            </View>
            {Platform.OS==='web' ? (
              <MapPicker key={`stop-${i}-${stop.lat}-${stop.lng}`} lat={stop.lat} lng={stop.lng} mapKey={`overnight_${i}`} onSelect={(lat,lng)=>updateStop(i,{lat,lng})}/>
            ) : null}
            {(stop.lat&&stop.lng&&Platform.OS==='web') ? (
              <TouchableOpacity onPress={()=>(window as any).open(`https://maps.google.com/?q=${stop.lat},${stop.lng}`,'_blank')}>
                <Text style={styles.mapLink}>↗ In Google Maps öffnen</Text>
              </TouchableOpacity>
            ) : null}
            {['biwak','zelt','camping'].includes(stop.type) ? (
              <View style={{backgroundColor:'#f0faf4',borderRadius:6,padding:10,marginBottom:8}}>
                <Text style={{fontSize:12,color:'#2c694e'}}>ℹ️ Keine Reservierung nötig</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.checkRow} onPress={()=>updateStop(i,{reserved:!stop.reserved})}>
                {stop.reserved ? <CheckSquare size={18} color="#2c694e" strokeWidth={2}/> : <Square size={18} color="#c3c8bf" strokeWidth={1.8}/>}
                <Text style={[styles.checkTxt,stop.reserved&&{color:'#2c694e'}]}>Reservierung bestätigt</Text>
              </TouchableOpacity>
            )}
            {['biwak','zelt','camping'].includes(stop.type) ? null : (
              <View>
                <Text style={styles.inputLabel}>Kontaktperson</Text>
                <TextInput style={styles.input} placeholder="Name Hüttenwart / Kontakt" placeholderTextColor="#bbb"
                  value={stop.contactName} onChangeText={v=>updateStop(i,{contactName:v})}/>
                <TextInput style={styles.input} placeholder="Telefonnummer" placeholderTextColor="#bbb"
                  keyboardType="phone-pad" value={stop.contactPhone} onChangeText={v=>updateStop(i,{contactPhone:v})}/>
              </View>
            )}
            <Text style={styles.inputLabel}>Notizen</Text>
            <TextInput style={[styles.input,{height:56}]} placeholder="z.B. Matratzenlager, kein Empfang" placeholderTextColor="#bbb"
              multiline value={stop.notes} onChangeText={v=>updateStop(i,{notes:v})}/>
          </View>
        ))}

                <View style={[styles.card,{marginTop:12}]}>
          <Text style={styles.fieldLabel}>STARTDETAILS</Text>
          <Text style={styles.inputLabel}>Routenname</Text>
          <TextInput style={styles.input} placeholder="z.B. Diesbacher Höhen-Loop" placeholderTextColor="#bbb"
            value={routeName} onChangeText={setRouteName}/>
          <Text style={styles.inputLabel}>Parkplatz / Startort</Text>
          <TextInput style={styles.input} placeholder="z.B. Wanderparkplatz Schwägalp" placeholderTextColor="#bbb"
            value={parkingLocation} onChangeText={setParkingLocation}/>
          <Text style={styles.inputLabel}>Parkplatz Koordinaten — auf Karte klicken oder GPS</Text>
          {/* Key forces remount when GPS or GPX sets coords */}
          {Platform.OS==='web' ? (
            <MapPicker key={`parking-${parkingMapKey}`} lat={parkingLat} lng={parkingLng} mapKey="parking"
              onSelect={(lat,lng)=>{setParkingLat(lat);setParkingLng(lng);}}/>
          ) : null}
          <View style={{flexDirection:'row',gap:8}}>
            <TextInput style={[styles.input,{flex:1}]} placeholder="Breitengrad" placeholderTextColor="#bbb"
              keyboardType="numeric" value={parkingLat} onChangeText={setParkingLat}/>
            <TextInput style={[styles.input,{flex:1}]} placeholder="Längengrad" placeholderTextColor="#bbb"
              keyboardType="numeric" value={parkingLng} onChangeText={setParkingLng}/>
          </View>
          <TouchableOpacity style={[styles.gpsBtn,locationStatus==='ok'&&styles.gpsBtnOk]} onPress={handleGetLocation}>
            <MapPin size={14} color={locationStatus==='ok'?'#2c694e':'#747871'} strokeWidth={2}/>
            <Text style={[styles.gpsTxt,locationStatus==='ok'&&{color:'#2c694e'}]}>
              {locationStatus==='idle'?'Aktuellen GPS-Standort ermitteln':
               locationStatus==='loading'?'Ermittle...':
               locationStatus==='ok'?`GPS: ${parseFloat(startLat).toFixed(4)}, ${parseFloat(startLng).toFixed(4)}`:
               'Kein GPS-Zugriff'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Manual waypoints + GPX waypoints */}
        <View style={[styles.card,{marginTop:12}]}>
          <Text style={styles.fieldLabel}>MANUELLE WEGPUNKTE / ZWISCHENSTOPPS</Text>
          {/* GPX Waypoints (read-only) */}
          {gpxData?.waypoints?.length > 0 ? (
            <View style={{marginBottom:8}}>
              {gpxData.waypoints.map((wp:any,i:number) => (
                <View key={`gpx-${i}`} style={[styles.wpRow,{backgroundColor:'#fffbf0',borderRadius:4,paddingHorizontal:8}]}>
                  <Flag size={12} color="#f59e0b" strokeWidth={2}/>
                  <View style={{flex:1}}>
                    <Text style={styles.wpTxt}>{wp.name}</Text>
                    {wp.ele ? <Text style={styles.wpSub}>{Math.round(wp.ele)} m ü.M.</Text> : null}
                    {(wp.lat&&wp.lng) ? <Text style={styles.wpSub}>{parseFloat(wp.lat).toFixed(4)}, {parseFloat(wp.lng).toFixed(4)}</Text> : null}
                  </View>
                  <View style={{backgroundColor:'#f59e0b',paddingHorizontal:6,paddingVertical:2,borderRadius:4}}>
                    <Text style={{fontSize:9,color:'#fff',fontWeight:'800'}}>GPX</Text>
                  </View>
                </View>
              ))}
              {waypoints.length > 0 ? <View style={{height:1,backgroundColor:'#e1e3e4',marginVertical:8}}/> : null}
            </View>
          ) : null}
          {/* Manual waypoints */}
          {waypoints.map((wp,i) => (
            <View key={i} style={styles.wpRow}>
              <Flag size={12} color="#2c694e" strokeWidth={2}/>
              <View style={{flex:1}}>
                <Text style={styles.wpTxt}>{wp.name}</Text>
                {(wp.lat&&wp.lng) ? <Text style={styles.wpSub}>{parseFloat(wp.lat).toFixed(4)}, {parseFloat(wp.lng).toFixed(4)}</Text> : null}
                {wp.notes ? <Text style={styles.wpSub}>{wp.notes}</Text> : null}
              </View>
              <TouchableOpacity onPress={()=>setWaypoints(prev=>prev.filter((_,j)=>j!==i))}>
                <Trash2 size={14} color="#e1e3e4" strokeWidth={1.8}/>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addCBtn} onPress={()=>setShowAddWp(v=>!v)}>
            <Plus size={15} color="#2c694e" strokeWidth={2}/>
            <Text style={styles.addCTxt}>Wegpunkt hinzufügen</Text>
          </TouchableOpacity>
          {showAddWp ? (
            <View style={[styles.addCForm,{marginTop:8}]}>
              <Text style={styles.inputLabel}>Name / Bezeichnung</Text>
              <TextInput style={styles.input} placeholder="z.B. Gipfel Säntis" placeholderTextColor="#bbb"
                value={newWpName} onChangeText={setNewWpName}/>
              <Text style={styles.inputLabel}>Koordinaten (optional)</Text>
              <View style={{flexDirection:'row',gap:8}}>
                <TextInput style={[styles.input,{flex:1}]} placeholder="Breitengrad" placeholderTextColor="#bbb"
                  keyboardType="numeric" value={newWpLat} onChangeText={setNewWpLat}/>
                <TextInput style={[styles.input,{flex:1}]} placeholder="Längengrad" placeholderTextColor="#bbb"
                  keyboardType="numeric" value={newWpLng} onChangeText={setNewWpLng}/>
              </View>
              {Platform.OS==='web' ? (
                <MapPicker key={`wp-new`} lat={newWpLat} lng={newWpLng} mapKey="newwp"
                  onSelect={(lat,lng)=>{setNewWpLat(lat);setNewWpLng(lng);}}/>
              ) : null}
              <Text style={styles.inputLabel}>Notizen</Text>
              <TextInput style={styles.input} placeholder="z.B. Hütte, Aussichtspunkt" placeholderTextColor="#bbb"
                value={newWpNotes} onChangeText={setNewWpNotes}/>
              <TouchableOpacity style={styles.saveCBtn} onPress={()=>{
                if (!newWpName.trim()) { showAlert('Fehler','Name erforderlich'); return; }
                setWaypoints(prev=>[...prev,{name:newWpName.trim(),lat:newWpLat,lng:newWpLng,notes:newWpNotes}]);
                setNewWpName(''); setNewWpLat(''); setNewWpLng(''); setNewWpNotes('');
                setShowAddWp(false);
              }}>
                <Text style={styles.saveCTxt}>Wegpunkt speichern</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={[styles.card,{marginTop:12}]}>
          <Text style={styles.fieldLabel}>STRECKE & SCHWIERIGKEIT</Text>
          <View style={{flexDirection:'row',gap:10}}>
            <View style={{flex:1}}>
              <Text style={styles.inputLabel}>Distanz (km)</Text>
              <TextInput style={styles.input} placeholder="z.B. 12" placeholderTextColor="#bbb"
                value={distanceKm} onChangeText={setDistanceKm} keyboardType="numeric"/>
            </View>
            <View style={{flex:1}}>
              <Text style={styles.inputLabel}>Höhenmeter ↑</Text>
              <TextInput style={styles.input} placeholder="z.B. 800" placeholderTextColor="#bbb"
                value={elevationUp} onChangeText={setElevationUp} keyboardType="numeric"/>
            </View>
          </View>
          {hasField('sac') ? (
            <View>
              <Text style={styles.fieldLabel}>SAC SCHWIERIGKEIT</Text>
              <View style={styles.diffGrid}>
                {SAC_LEVELS.map(l => (
                  <TouchableOpacity key={l.key} style={[styles.diffCard,difficulty===l.key&&styles.diffOn]}
                    onPress={()=>setDifficulty(difficulty===l.key?'':l.key)}>
                    <Text style={[styles.diffLabel,difficulty===l.key&&{color:'#fff'}]}>{l.key}</Text>
                    <Text style={[styles.diffDesc,difficulty===l.key&&{color:'rgba(255,255,255,0.7)'}]}>{l.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
          {hasField('klettersteig_grade') ? (
            <View>
              <Text style={styles.fieldLabel}>KLETTERSTEIG-GRAD</Text>
              <View style={styles.chipRow}>
                {KLETTERSTEIG_GRADES.map(g => (
                  <TouchableOpacity key={g} style={[styles.chip,klettersteigGrade===g&&styles.chipOn]}
                    onPress={()=>setKlettersteigGrade(klettersteigGrade===g?'':g)}>
                    <Text style={[styles.chipTxt,klettersteigGrade===g&&{color:'#fff'}]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
          {hasField('mtb_scale') ? (
            <View>
              <Text style={styles.fieldLabel}>MTB S-SKALA</Text>
              <View style={styles.chipRow}>
                {MTB_SCALES.map(s => (
                  <TouchableOpacity key={s} style={[styles.chip,mtbScale===s&&styles.chipOn]}
                    onPress={()=>setMtbScale(mtbScale===s?'':s)}>
                    <Text style={[styles.chipTxt,mtbScale===s&&{color:'#fff'}]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>TRAIL TYP</Text>
              <View style={styles.chipRow}>
                {TRAIL_TYPES.map(t => (
                  <TouchableOpacity key={t} style={[styles.chip,trailType===t&&styles.chipOn]}
                    onPress={()=>setTrailType(trailType===t?'':t)}>
                    <Text style={[styles.chipTxt,trailType===t&&{color:'#fff'}]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
          {hasField('piste_level') ? (
            <View>
              <Text style={styles.fieldLabel}>PISTENNIVEAU</Text>
              <View style={styles.chipRow}>
                {PISTE_LEVELS.map(p => (
                  <TouchableOpacity key={p} style={[styles.chip,pisteLevel===p&&styles.chipOn]}
                    onPress={()=>setPisteLevel(pisteLevel===p?'':p)}>
                    <Text style={[styles.chipTxt,pisteLevel===p&&{color:'#fff'}]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.inputLabel}>Skigebiet / Resort</Text>
              <TextInput style={styles.input} placeholder="z.B. Laax" placeholderTextColor="#bbb"
                value={resort} onChangeText={setResort}/>
            </View>
          ) : null}
          {hasField('avalanche') ? (
            <View>
              <Text style={styles.fieldLabel}>LAWINENGEFAHR</Text>
              <View style={styles.diffGrid}>
                {AVALANCHE_RISKS.map(r => (
                  <TouchableOpacity key={r.key}
                    style={[styles.diffCard,avalancheRisk===r.key&&{backgroundColor:'#dc2626',borderColor:'#dc2626'}]}
                    onPress={()=>setAvalancheRisk(avalancheRisk===r.key?'':r.key)}>
                    <Text style={[styles.diffLabel,avalancheRisk===r.key&&{color:'#fff'}]}>{r.key}</Text>
                    <Text style={[styles.diffDesc,avalancheRisk===r.key&&{color:'rgba(255,255,255,0.7)'}]}>{r.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
          {hasField('equipment') ? (
            <View>
              <Text style={styles.fieldLabel}>AUSRÜSTUNG</Text>
              <TextInput style={styles.input} placeholder="z.B. Kletterset, Helm, Sicherungsgerät" placeholderTextColor="#bbb"
                value={equipmentNotes} onChangeText={setEquipmentNotes} multiline/>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  function S3() {
    return (
      <View>
        <Text style={styles.stepTitle}>Personen</Text>
        <Text style={styles.stepSub}>Infos für Rettungskräfte</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>ANZAHL PERSONEN</Text>
          <View style={styles.counterRow}>
            <TouchableOpacity style={styles.cBtn} onPress={()=>setPersons(p=>p.length>0?p.slice(0,-1):p)}>
              <Text style={styles.cBtnTxt}>−</Text>
            </TouchableOpacity>
            <View style={{alignItems:'center',minWidth:80}}>
              <Text style={styles.cVal}>{persons.length===0?'Solo':`${persons.length+1}`}</Text>
              <Text style={{fontSize:10,color:'#747871'}}>{persons.length===0?'Solo':persons.length===1?'+ 1 Begl.':'+ '+persons.length+' Begl.'}</Text>
            </View>
            <TouchableOpacity style={styles.cBtn} onPress={()=>setPersons(p=>[...p,{name:'',age:'',notes:''}])}>
              <Text style={styles.cBtnTxt}>+</Text>
            </TouchableOpacity>
          </View>
          {persons.length===0 ? (
            <View style={styles.soloHint}>
              <Text style={styles.soloTxt}>Solo-Tour — nur du bist unterwegs</Text>
            </View>
          ) : null}
        </View>
        {persons.map((p,i) => (
          <View key={i} style={[styles.card,{marginTop:12}]}>
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
              <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
                <User size={15} color="#2c694e" strokeWidth={2}/>
                <Text style={{fontSize:14,fontWeight:'800',color:'#061907'}}>Begleitperson {i+1}</Text>
              </View>
              <TouchableOpacity onPress={()=>setPersons(prev=>prev.filter((_,j)=>j!==i))} style={{padding:4}}>
                <X size={14} color="#ba1a1a" strokeWidth={2}/>
              </TouchableOpacity>
            </View>
            {profileFriends.length > 0 && (
              <View style={{marginBottom:10}}>
                <Text style={styles.inputLabel}>Aus Freundesliste</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop:4}}>
                  {profileFriends.map((f:any) => (
                    <TouchableOpacity key={f.friendshipId}
                      style={{paddingHorizontal:12,paddingVertical:6,borderRadius:100,borderWidth:1,marginRight:8,
                        backgroundColor: persons[i].name===f.name?'#aeeecb':'#f8f9fa',
                        borderColor: persons[i].name===f.name?'#2c694e':'#e1e3e4'}}
                      onPress={()=>setPersons(prev=>prev.map((x,j)=>j===i?{...x,name:f.name,phone:f.phone??x.phone??''}:x))}>
                      <Text style={{fontSize:12,fontWeight:'700',color:persons[i].name===f.name?'#2c694e':'#434841'}}>{f.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput style={styles.input} placeholder="Vor- und Nachname" placeholderTextColor="#bbb"
              value={p.name} onChangeText={v=>setPersons(prev=>prev.map((x,j)=>j===i?{...x,name:v}:x))}/>
            <Text style={styles.inputLabel}>Funktion / Rolle</Text>
            <TextInput style={styles.input} placeholder="z.B. Tourführer, Teilnehmer, Arzt" placeholderTextColor="#bbb"
              value={(p as any).role??''} onChangeText={v=>setPersons(prev=>prev.map((x,j)=>j===i?{...x,role:v}:x))}/>
            <Text style={styles.inputLabel}>Telefon</Text>
            <TextInput style={styles.input} placeholder="+41 79 123 45 67" placeholderTextColor="#bbb" keyboardType="phone-pad"
              value={(p as any).phone??''} onChangeText={v=>setPersons(prev=>prev.map((x,j)=>j===i?{...x,phone:v}:x))}/>
            <Text style={styles.inputLabel}>Alter</Text>
            <TextInput style={styles.input} placeholder="z.B. 34" placeholderTextColor="#bbb" keyboardType="numeric"
              value={p.age} onChangeText={v=>setPersons(prev=>prev.map((x,j)=>j===i?{...x,age:v}:x))}/>
            <Text style={styles.inputLabel}>Med. Infos / Ausrüstung</Text>
            <TextInput style={[styles.input,{height:60}]} placeholder="z.B. Knieprobleme, roter Rucksack" placeholderTextColor="#bbb" multiline
              value={p.notes} onChangeText={v=>setPersons(prev=>prev.map((x,j)=>j===i?{...x,notes:v}:x))}/>
          </View>
        ))}
        <View style={[styles.card,{marginTop:12}]}>
          <Text style={styles.fieldLabel}>NOTFALLKONTAKTE</Text>
          {profileFriends.length > 0 && (
            <View style={{marginBottom:10}}>
              <Text style={styles.inputLabel}>Aus Freundesliste</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop:4}}>
                {profileFriends.map((f:any) => {
                  const isSel = selectedContacts.includes('friend-'+f.friendshipId);
                  return (
                    <TouchableOpacity key={f.friendshipId}
                      style={{paddingHorizontal:12,paddingVertical:6,borderRadius:100,borderWidth:1,marginRight:8,
                        backgroundColor:isSel?'#aeeecb':'#f8f9fa',borderColor:isSel?'#2c694e':'#e1e3e4'}}
                      onPress={()=>setSelectedContacts(prev=>isSel?prev.filter(id=>id!=='friend-'+f.friendshipId):[...prev,'friend-'+f.friendshipId])}>
                      <Text style={{fontSize:12,fontWeight:'700',color:isSel?'#2c694e':'#434841'}}>{f.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
          {profileContacts.length>0 ? (
            <View>
              <Text style={styles.inputLabel}>Aus Profil wählen</Text>
              {profileContacts.map((c:any) => {
                const sel = selectedContacts.includes(c.id);
                return (
                  <TouchableOpacity key={c.id} style={styles.contactRow}
                    onPress={()=>setSelectedContacts(prev=>sel?prev.filter(id=>id!==c.id):[...prev,c.id])}>
                    {sel ? <CheckSquare size={18} color="#2c694e" strokeWidth={2}/> : <Square size={18} color="#c3c8bf" strokeWidth={1.8}/>}
                    <View style={{flex:1}}>
                      <Text style={[styles.contactName,sel&&{color:'#2c694e'}]}>{c.name}</Text>
                      <Text style={styles.contactSub}>{c.relation} · {c.phone}</Text>
                    </View>
                    {c.isPrimary ? <Text style={styles.primBadge}>Primär</Text> : null}
                  </TouchableOpacity>
                );
              })}
              <View style={{height:1,backgroundColor:'#f3f4f5',marginVertical:12}}/>
            </View>
          ) : null}
          <TouchableOpacity style={styles.addCBtn} onPress={()=>setShowAddContact(v=>!v)}>
            <UserPlus size={15} color="#2c694e" strokeWidth={2}/>
            <Text style={styles.addCTxt}>Neuen Notfallkontakt hinzufügen</Text>
          </TouchableOpacity>
          {showAddContact ? (
            <View style={[styles.addCForm,{marginTop:8}]}>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput style={styles.input} placeholder="z.B. Max Muster" placeholderTextColor="#bbb"
                value={newContact.name} onChangeText={v=>setNewContact(c=>({...c,name:v}))}/>
              <Text style={styles.inputLabel}>Telefon</Text>
              <TextInput style={styles.input} placeholder="+41 79 123 45 67" placeholderTextColor="#bbb" keyboardType="phone-pad"
                value={newContact.phone} onChangeText={v=>setNewContact(c=>({...c,phone:v}))}/>
              <Text style={styles.inputLabel}>Beziehung</Text>
              <TextInput style={styles.input} placeholder="z.B. Partner, Freund, Eltern" placeholderTextColor="#bbb"
                value={newContact.relation} onChangeText={v=>setNewContact(c=>({...c,relation:v}))}/>
              <TouchableOpacity style={styles.saveCBtn} onPress={async()=>{
                if (!newContact.name||!newContact.phone) { showAlert('Fehler','Name und Telefon erforderlich'); return; }
                try {
                  const token = await getToken();
                  const saved = await apiFetch('/emergency-contacts',{method:'POST',body:JSON.stringify(newContact)},token??undefined);
                  setProfileContacts(prev=>[...prev,saved]);
                  setSelectedContacts(prev=>[...prev,saved.id]);
                  setNewContact({name:'',phone:'',relation:''});
                  setShowAddContact(false);
                } catch { showAlert('Fehler','Kontakt konnte nicht gespeichert werden'); }
              }}>
                <Text style={styles.saveCTxt}>Kontakt speichern</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  function S4() {
    return (
      <View>
        <Text style={styles.stepTitle}>Details</Text>
        <Text style={styles.stepSub}>Fahrzeug und Routenbeschrieb</Text>
        {vehicles.length>0 ? (
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>FAHRZEUG AM PARKPLATZ</Text>
            {vehicles.map(v => (
              <TouchableOpacity key={v.id} style={[styles.vehicleRow,vehicleId===v.id&&styles.vehicleOn]}
                onPress={()=>setVehicleId(v.id)}>
                <Car size={15} color={vehicleId===v.id?'#2c694e':'#747871'} strokeWidth={vehicleId===v.id?2.5:1.8}/>
                <View style={{flex:1}}>
                  <Text style={[styles.vehicleLabel,vehicleId===v.id&&{color:'#2c694e'}]}>{v.make} {v.model}</Text>
                  <Text style={styles.vehicleSub}>{v.plate} · {v.color}</Text>
                </View>
                {vehicleId===v.id ? <Check size={15} color="#2c694e" strokeWidth={2.5}/> : null}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.vehicleRow,vehicleId===null&&styles.vehicleOn]} onPress={()=>setVehicleId(null)}>
              <Text style={[styles.vehicleLabel,{color:vehicleId===null?'#747871':'#c3c8bf'}]}>Kein Fahrzeug</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={[styles.card,{marginTop:12}]}>
          <Text style={styles.fieldLabel}>ROUTENBESCHRIEB FÜR RETTUNGSKRÄFTE</Text>
          <TextInput style={[styles.input,{height:100}]} placeholder="Detaillierter Verlauf: Start → Zwischenstopps → Ziel" placeholderTextColor="#bbb"
            value={routeDesc} onChangeText={setRouteDesc} multiline/>
          <Text style={styles.fieldLabel}>SONSTIGES</Text>
          <TextInput style={[styles.input,{height:64}]} placeholder="z.B. Zelt dabei, Hund, spezielle Ausrüstung" placeholderTextColor="#bbb"
            value={notes} onChangeText={setNotes} multiline/>
        </View>
      </View>
    );
  }

  function S5() {
    const act = ACTIVITIES.find(a=>a.key===activity);
    const diffLabel = difficulty||klettersteigGrade||mtbScale||pisteLevel;
    const selC = profileContacts.filter(c=>selectedContacts.includes(c.id));
    const allWps = [...waypoints.map(w=>w.name), ...(gpxData?.waypoints?.map((w:any)=>w.name)||[])].filter(Boolean);
    const rows: [string,string][] = [
      ['Start', startDateTime.toLocaleString('de-CH',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})],
      ['Rückkehr', etaDateTime.toLocaleString('de-CH',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})],
    ];
    if (multiDay) rows.push(['Nächte',`${returnDays-1}`]);
    if (distanceKm) rows.push(['Distanz',`${distanceKm} km`]);
    if (elevationUp) rows.push(['Höhenmeter',`+${elevationUp} m`]);
    if (diffLabel) rows.push(['Schwierigkeit',diffLabel]);
    rows.push(['Personen', persons.length===0?'Solo':`${persons.length + 1} (ich + ${persons.length} Begleit${persons.length===1?'person':'personen'})`]);
    if (allWps.length>0) rows.push(['Wegpunkte',allWps.join(' → ')]);
    if (parkingLocation) rows.push(['Parkplatz',parkingLocation]);
    if (vehicleId) rows.push(['Fahrzeug',vehicles.find(v=>v.id===vehicleId)?.plate??'']);
    if (selC.length>0) rows.push(['Notfallkontakte',selC.map(c=>c.name).join(', ')]);
    return (
      <View>
        <Text style={styles.stepTitle}>Übersicht</Text>
        <Text style={styles.stepSub}>Alles korrekt?</Text>
        <View style={[styles.sumHero,{borderColor:act?.color??'#e1e3e4',backgroundColor:`${act?.color??'#1a2e1a'}10`}]}>
          {act ? <act.Icon size={30} color={act.color} strokeWidth={2}/> : null}
          <View style={{flex:1}}>
            <Text style={styles.sumActivity}>{act?.label}</Text>
            {routeName ? <Text style={styles.sumRoute}>{routeName}</Text> : null}
          </View>
        </View>
        <View style={[styles.card,{marginTop:12}]}>
          {rows.map(([k,v],i) => (
            <View key={i} style={styles.sumRow}>
              <Text style={styles.sumKey}>{k}</Text>
              <Text style={styles.sumVal} numberOfLines={2}>{v}</Text>
            </View>
          ))}
        </View>
        <View style={styles.warnBox}>
          <AlertTriangle size={14} color="#92400e" strokeWidth={2}/>
          <Text style={styles.warnTxt}>Mit dem Start bestätigst du die SOS-Protokolle. Alarm wird ausgelöst wenn kein Checkout bis {etaDateTime.toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'})} erfolgt.</Text>
        </View>
        <TouchableOpacity style={styles.startBtn} onPress={()=>handleSubmit(false)} disabled={loading}>
          <Text style={styles.startTxt}>{loading?'Startet...':'Safety-Timer aktivieren'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.planBtn} onPress={()=>handleSubmit(true)} disabled={loading}>
          <Calendar size={15} color="#434841" strokeWidth={2}/>
          <Text style={styles.planTxt}>Tour planen (später starten)</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderStep() {
    switch(step) {
      case 0: return S0();
      case 1: return S1();
      case 2: return S2();
      case 3: return S3();
      case 4: return S4();
      case 5: return S5();
      default: return null;
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={()=>step===0?router.back():setStep(s=>s-1)}>
          <ArrowLeft size={20} color="#061907" strokeWidth={2}/>
        </TouchableOpacity>
        <View style={{flex:1,alignItems:'center'}}>
          <Text style={styles.topTitle}>{STEPS[step]}</Text>
          <Text style={styles.topCount}>{step+1} / {STEPS.length}</Text>
        </View>
        <View style={{width:36}}/>
      </View>
      <View style={styles.progressBg}>
        <View style={[styles.progressFill,{width:`${((step+1)/STEPS.length)*100}%` as any}]}/>
      </View>
      <View style={styles.dotsRow}>
        {STEPS.map((_,i)=>(
          <View key={i} style={[styles.dot, i<=step&&styles.dotDone, i===step&&styles.dotCur]}/>
        ))}
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollC}>
        <ErrorBanner errors={errors}/>
        {renderStep()}
        <View style={{height:20}}/>
      </ScrollView>
      {step < STEPS.length - 1 ? (
        <View style={styles.bottomBar}>
          {step > 0 ? (
            <TouchableOpacity style={styles.backBtnBottom} onPress={()=>setStep(s=>s-1)}>
              <ArrowLeft size={16} color="#747871" strokeWidth={2}/>
              <Text style={styles.backBtnBottomTxt}>Zurück</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.nextBtn, step===0&&!activity&&styles.nextOff]}
            onPress={tryNext}
            disabled={step===0&&!activity}>
            <Text style={styles.nextTxt}>{step===STEPS.length-2?'Zur Übersicht':'Weiter'}</Text>
            <ArrowRight size={18} color="#fff" strokeWidth={2.5}/>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#f8f9fa'},
  topBar:{flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingTop:52,paddingBottom:12,backgroundColor:'#fff',borderBottomWidth:1,borderBottomColor:'#e1e3e4'},
  backBtn:{width:36,height:36,alignItems:'center',justifyContent:'center'},
  topTitle:{fontSize:16,fontWeight:'800',color:'#061907'},
  topCount:{fontSize:11,color:'#747871',marginTop:1},
  progressBg:{height:3,backgroundColor:'#e1e3e4'},
  progressFill:{height:3,backgroundColor:'#2c694e'},
  dotsRow:{flexDirection:'row',justifyContent:'center',gap:6,paddingVertical:10,backgroundColor:'#fff',borderBottomWidth:1,borderBottomColor:'#f3f4f5'},
  dot:{width:6,height:6,borderRadius:3,backgroundColor:'#e1e3e4'},
  dotDone:{backgroundColor:'#aeeecb'},
  dotCur:{backgroundColor:'#2c694e',width:20},
  scroll:{flex:1},
  scrollC:{padding:20},
  stepTitle:{fontSize:24,fontWeight:'900',color:'#061907',letterSpacing:-0.5,marginBottom:4},
  stepSub:{fontSize:13,color:'#747871',marginBottom:20},
  card:{backgroundColor:'#fff',borderRadius:6,padding:16,borderWidth:1,borderColor:'#e1e3e4'},
  sectionLabel:{fontSize:10,fontWeight:'700',color:'#2c694e',letterSpacing:1,marginBottom:12},
  fieldLabel:{fontSize:10,fontWeight:'700',color:'#747871',letterSpacing:1,marginBottom:8,marginTop:8},
  inputLabel:{fontSize:11,color:'#747871',fontWeight:'600',marginBottom:4},
  input:{backgroundColor:'#f8f8f8',borderRadius:6,padding:12,fontSize:14,color:'#222',marginBottom:8,borderWidth:1,borderColor:'#e1e3e4'},
  hint:{fontSize:11,color:'#747871',lineHeight:16,marginTop:4},
  soloHint:{backgroundColor:'#f0faf4',borderRadius:4,padding:10,marginTop:4},
  soloTxt:{fontSize:12,color:'#2c694e',textAlign:'center',fontWeight:'600'},
  errorBanner:{flexDirection:'row',alignItems:'flex-start',gap:8,backgroundColor:'#ffdad6',borderRadius:6,padding:14,marginBottom:16,borderLeftWidth:3,borderLeftColor:'#ba1a1a'},
  errorText:{fontSize:13,color:'#ba1a1a',fontWeight:'600'},
  actGrid:{flexDirection:'row',flexWrap:'wrap',gap:10},
  actCard:{width:'30%',aspectRatio:1,alignItems:'center',justifyContent:'center',backgroundColor:'#fff',borderRadius:8,borderWidth:1.5,borderColor:'#e1e3e4',position:'relative' as any,gap:8},
  actLabel:{fontSize:11,color:'#747871',fontWeight:'600',textAlign:'center'},
  actDot:{position:'absolute' as any,top:6,right:6,width:8,height:8,borderRadius:4},
  toggle:{flexDirection:'row',backgroundColor:'#edeeef',borderRadius:8,padding:4,marginBottom:16,gap:4},
  toggleBtn:{flex:1,paddingVertical:10,alignItems:'center',borderRadius:6},
  toggleOn:{backgroundColor:'#fff'},
  toggleTxt:{fontSize:13,color:'#747871',fontWeight:'600'},
  toggleTxtOn:{color:'#061907',fontWeight:'800'},
  dtRow:{flexDirection:'row',gap:8},
  dtBtn:{flex:1,flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#f8f8f8',borderRadius:6,padding:11,borderWidth:1,borderColor:'#e1e3e4'},
  dtBtnText:{fontSize:13,color:'#222',fontWeight:'600'},
  webDateIn:{flex:1.4,backgroundColor:'#f8f8f8',borderRadius:6,padding:10,fontSize:14,color:'#222',border:'1px solid #e1e3e4',fontFamily:'inherit',minWidth:0} as any,
  webTimeIn:{flex:1,backgroundColor:'#f8f8f8',borderRadius:6,padding:10,fontSize:14,color:'#222',border:'1px solid #e1e3e4',fontFamily:'inherit',minWidth:0} as any,
  counterRow:{flexDirection:'row',alignItems:'center',gap:16,marginBottom:8},
  cBtn:{width:36,height:36,borderRadius:18,backgroundColor:'#1a2e1a',alignItems:'center',justifyContent:'center'},
  cBtnTxt:{color:'#fff',fontSize:18,fontWeight:'700'},
  cVal:{fontSize:22,fontWeight:'900',color:'#061907'},
  typeRow: {flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:12},
typeBtn: {alignItems:'center',gap:5,padding:10,borderRadius:6,borderWidth:1.5,borderColor:'#e1e3e4',backgroundColor:'#fff',minWidth:'30%'},
  typeBtnOn:{borderColor:'#2c694e',backgroundColor:'#f0faf4'},
  typeTxt:{fontSize:11,color:'#747871',fontWeight:'600'},
  checkRow:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:10,borderTopWidth:1,borderTopColor:'#f3f4f5',marginBottom:8},
  checkTxt:{fontSize:14,color:'#747871',fontWeight:'600'},
  mapLink:{fontSize:12,color:'#2c694e',fontWeight:'700',marginBottom:8},
  gpxZone:{borderWidth:2,borderColor:'#e1e3e4',borderStyle:'dashed',borderRadius:8,padding:20,alignItems:'center',gap:6,position:'relative' as any,overflow:'hidden' as any},
  gpxDone:{borderColor:'#2c694e',borderStyle:'solid' as any,backgroundColor:'#f0faf4'},
  gpxTitle:{fontSize:14,fontWeight:'700',color:'#434841'},
  gpxSub:{fontSize:11,color:'#c3c8bf',textAlign:'center'},
  gpxStats:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:16,backgroundColor:'#f0faf4',borderRadius:6,padding:12,marginTop:12},
  gpxStat:{alignItems:'center'},
  gpxVal:{fontSize:20,fontWeight:'900',color:'#2c694e'},
  gpxKey:{fontSize:10,color:'#747871',fontWeight:'600'},
  gpxDiv:{width:1,height:28,backgroundColor:'#c3c8bf'},
  gpsBtn:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#f8f8f8',borderRadius:6,padding:12,borderWidth:1,borderColor:'#e1e3e4'},
  gpsBtnOk:{borderColor:'#2c694e',backgroundColor:'#f0faf4'},
  gpsTxt:{fontSize:13,color:'#747871',fontWeight:'600',flex:1},
  wpRow:{flexDirection:'row',alignItems:'flex-start',gap:8,paddingVertical:8,borderBottomWidth:1,borderBottomColor:'#f3f4f5'},
  wpTxt:{fontSize:13,color:'#434841',fontWeight:'600',flex:1},
  wpSub:{fontSize:11,color:'#747871',marginTop:1},
  diffGrid:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:8},
  diffCard:{flex:1,minWidth:'30%',padding:10,borderRadius:6,borderWidth:1.5,borderColor:'#e1e3e4',backgroundColor:'#fff',alignItems:'center'},
  diffOn:{backgroundColor:'#1a2e1a',borderColor:'#1a2e1a'},
  diffLabel:{fontSize:16,fontWeight:'900',color:'#061907'},
  diffDesc:{fontSize:9,color:'#747871',textAlign:'center',marginTop:2},
  chipRow:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:8},
  chip:{paddingHorizontal:14,paddingVertical:8,borderRadius:6,backgroundColor:'#fff',borderWidth:1.5,borderColor:'#e1e3e4'},
  chipOn:{backgroundColor:'#1a2e1a',borderColor:'#1a2e1a'},
  chipTxt:{fontSize:13,color:'#434841',fontWeight:'700'},
  contactRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:11,borderBottomWidth:1,borderBottomColor:'#f3f4f5'},
  contactName:{fontSize:14,fontWeight:'700',color:'#061907'},
  contactSub:{fontSize:12,color:'#747871'},
  primBadge:{fontSize:10,fontWeight:'700',color:'#2c694e',backgroundColor:'#f0faf4',paddingHorizontal:8,paddingVertical:3,borderRadius:100},
  addCBtn:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:12},
  addCTxt:{fontSize:14,color:'#2c694e',fontWeight:'700'},
  addCForm:{backgroundColor:'#f8f9fa',borderRadius:6,padding:12,borderWidth:1,borderColor:'#e1e3e4'},
  saveCBtn:{backgroundColor:'#2c694e',borderRadius:6,paddingVertical:12,alignItems:'center'},
  saveCTxt:{color:'#fff',fontWeight:'800',fontSize:14},
  vehicleRow:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#f3f4f5'},
  vehicleOn:{backgroundColor:'#f0faf4',borderRadius:6,paddingHorizontal:8,marginHorizontal:-8},
  vehicleLabel:{fontSize:14,fontWeight:'700',color:'#061907'},
  vehicleSub:{fontSize:12,color:'#747871'},
  sumHero:{flexDirection:'row',alignItems:'center',gap:14,borderRadius:8,padding:18,borderWidth:1.5},
  sumActivity:{fontSize:18,fontWeight:'900',color:'#061907'},
  sumRoute:{fontSize:13,color:'#747871',marginTop:2},
  sumRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#f3f4f5'},
  sumKey:{fontSize:13,color:'#747871'},
  sumVal:{fontSize:13,fontWeight:'600',color:'#061907',flex:1,textAlign:'right',marginLeft:16},
  warnBox:{flexDirection:'row',alignItems:'flex-start',gap:8,backgroundColor:'#fff8e1',borderRadius:6,padding:14,marginTop:12,borderLeftWidth:3,borderLeftColor:'#f59e0b'},
  warnTxt:{fontSize:12,color:'#92400e',lineHeight:18,flex:1},
  startBtn:{backgroundColor:'#061907',borderRadius:6,padding:18,alignItems:'center',marginTop:16},
  startTxt:{color:'#fff',fontWeight:'800',fontSize:15},
  planBtn:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#fff',borderRadius:6,padding:16,marginTop:10,borderWidth:1.5,borderColor:'#e1e3e4'},
  planTxt:{color:'#434841',fontWeight:'700',fontSize:14},
  bottomBar:{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:20,paddingVertical:16,backgroundColor:'#fff',borderTopWidth:1,borderTopColor:'#e1e3e4',paddingBottom:Platform.OS==='ios'?32:16},
  backBtnBottom:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:14,paddingVertical:14,borderRadius:6,borderWidth:1.5,borderColor:'#e1e3e4'},
  backBtnBottomTxt:{fontSize:13,color:'#747871',fontWeight:'700'},
  nextBtn:{flex:1,backgroundColor:'#061907',borderRadius:6,paddingVertical:16,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
  nextOff:{opacity:0.4},
  nextTxt:{color:'#fff',fontWeight:'800',fontSize:15},
  gpxSummary: {backgroundColor:'#f0faf4',borderRadius:6,padding:12,marginTop:12,borderWidth:1,borderColor:'#aeeecb'},
gpxSummaryText: {fontSize:13,color:'#2c694e',fontWeight:'600',textAlign:'center',lineHeight:18},
});
