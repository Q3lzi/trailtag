import express, { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = express.Router()

router.get('/debug/:token', async (req: Request, res: Response) => {
  const token = req.params['token'] as string
  const vehicle = await prisma.vehicle.findUnique({ where: { qrToken: token }, select: { id: true, plate: true, userId: true } })
  if (!vehicle) return res.json({ error: 'Vehicle not found' })
  const tours = await prisma.tour.findMany({ where: { userId: vehicle.userId }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, status: true, startedAt: true, eta: true, alarmStage: true } })
  return res.json({ vehicle, tours })
})

router.get('/:token', async (req: Request, res: Response) => {
  const token = req.params['token'] as string
  const vehicle = await prisma.vehicle.findUnique({
    where: { qrToken: token },
    select: { id: true, plate: true, make: true, model: true, color: true, qrToken: true, userId: true }
  })
  if (!vehicle) return res.status(404).send(html404())

  const inc = {
    locations: { orderBy: { timestamp: 'desc' as const }, take: 500 },
    user: { include: { emergencyContacts: { orderBy: { isPrimary: 'desc' as const } } } }
  }
  let tour: any = await prisma.tour.findFirst({
    where: { vehicleId: vehicle.id, status: { in: ['ACTIVE','ALARM'] } },
    orderBy: { startedAt: 'desc' }, include: inc
  })
  if (!tour) tour = await prisma.tour.findFirst({
    where: { userId: vehicle.userId, status: { in: ['ACTIVE','ALARM'] } },
    orderBy: { startedAt: 'desc' }, include: inc
  })

  if (!tour) return res.send(renderGreen(vehicle))
  if (tour.status === 'ALARM') return res.send(render(vehicle, tour, 'alarm'))
  const etaMs = tour.eta ? new Date(tour.eta).getTime() : null
  return (!etaMs || etaMs > Date.now()) ? res.send(render(vehicle, tour, 'active')) : res.send(render(vehicle, tour, 'alarm'))
})

// ── Utils ─────────────────────────────────────────────────────────────────────
const e = (s: any) => s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
const fmt  = (d: any) => d ? new Date(d).toLocaleString('de-CH',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'
const fmtT = (d: any) => d ? new Date(d).toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'}) : '—'

// Swiss plate — Wappen (SVG) left, white bg, black border
const plate = (text: string) => `<span style="display:inline-flex;align-items:stretch;border:2px solid #333;border-radius:4px;overflow:hidden;font-family:Arial,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.15);">
  <span style="background:#fff;border-right:2px solid #333;display:flex;align-items:center;justify-content:center;padding:4px 8px;">
    <svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
      <rect width="22" height="22" rx="2" fill="#D52B1E"/>
      <rect x="9" y="3" width="4" height="16" fill="#fff"/>
      <rect x="3" y="9" width="16" height="4" fill="#fff"/>
    </svg>
  </span>
  <span style="background:#fff;padding:5px 14px;font-size:17px;font-weight:900;letter-spacing:3px;color:#111;">${e(text)}</span>
</span>`

// Consistent row helper
const row = (label: string, val: string, red = false) =>
  `<tr><td style="padding:10px 16px;font-size:13px;color:#747871;white-space:nowrap;vertical-align:top;">${label}</td><td style="padding:10px 16px;font-size:14px;font-weight:700;color:${red?'#ba1a1a':'#061907'};text-align:right;vertical-align:top;">${val}</td></tr>`

// Consistent card
const card = (title: string, content: string, opts: {accent?: string; nopad?: boolean} = {}) =>
  `<div style="background:#fff;border-radius:12px;border:1px solid #e1e3e4;${opts.accent?`border-left:5px solid ${opts.accent};`:''}overflow:hidden;margin-bottom:12px;">
    ${title?`<div style="padding:12px 16px;border-bottom:1px solid #e1e3e4;display:flex;align-items:center;gap:8px;">${title}</div>`:''}
    ${opts.nopad?content:`<div style="padding:4px 0;">${content}</div>`}
  </div>`

const sectionTitle = (icon: string, label: string, color = '#747871') =>
  `<span style="font-size:11px;font-weight:700;color:${color};letter-spacing:1px;text-transform:uppercase;">${icon} ${label}</span>`

// SVG Icons
const ICONS = {
  phone: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.86a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  heli: `<svg width="26" height="26" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="28" width="40" height="12" rx="6" fill="currentColor"/><rect x="26" y="16" width="4" height="12" fill="currentColor"/><rect x="8" y="14" width="36" height="4" rx="2" fill="currentColor"/><rect x="40" y="30" width="18" height="4" rx="2" fill="currentColor" transform="rotate(-15 40 32)"/><rect x="44" y="39" width="4" height="10" rx="2" fill="currentColor" transform="rotate(-10 44 42)"/><rect x="46" y="44" width="12" height="3" rx="1" fill="currentColor"/><circle cx="16" cy="44" r="4" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="32" cy="44" r="4" fill="none" stroke="currentColor" stroke-width="3"/><rect x="14" y="40" width="20" height="3" fill="currentColor"/></svg>`,
  pin: `<svg width="14" height="14" viewBox="0 0 24 24" fill="#ba1a1a"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
  moon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2c694e" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  flag: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#747871" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`,
}

// Shell
function shell(isAlarm: boolean, heroColor: string, heroTitle: string, heroSub: string, body: string) {
  const badge = isAlarm
    ? `<span style="background:#ffdad6;color:#ba1a1a;padding:5px 12px;border-radius:100px;font-size:11px;font-weight:800;letter-spacing:.5px;animation:pulse 2s infinite;display:inline-flex;align-items:center;gap:4px;">⚠️ NOTFALL</span>`
    : `<span style="background:#aeeecb;color:#005227;padding:5px 12px;border-radius:100px;font-size:11px;font-weight:800;letter-spacing:.5px;display:inline-flex;align-items:center;gap:4px;">✅ ${heroTitle==='KEIN ALARM'?'OK':'AKTIV'}</span>`

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Trailtag – Ersthelfer-Portal</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Inter',system-ui,sans-serif;background:#f8f9fa;color:#191c1d;}
.c{max-width:480px;margin:0 auto;}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(186,26,26,.5);}70%{box-shadow:0 0 0 14px rgba(186,26,26,0);}}
details summary{list-style:none;cursor:pointer;-webkit-appearance:none;}
details summary::-webkit-details-marker{display:none;}
a{text-decoration:none;color:inherit;}
table{border-collapse:collapse;width:100%;}
</style>
</head>
<body>
<header style="background:#fff;border-bottom:1px solid #e1e3e4;position:sticky;top:0;z-index:100;box-shadow:0 1px 6px rgba(0,0,0,.07);">
  <div class="c" style="display:flex;justify-content:space-between;align-items:center;padding:0 20px;height:52px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#061907" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>
      <span style="font-size:18px;font-weight:800;color:#061907;letter-spacing:-.4px;">Trailtag</span>
    </div>
    ${badge}
  </div>
</header>
<div style="background:${heroColor};color:#fff;padding:24px 20px 28px;position:relative;overflow:hidden;${isAlarm?'box-shadow:0 4px 20px rgba(0,0,0,.2);':''}">
  <div class="c">
    <p style="font-size:10px;font-weight:700;opacity:.7;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Safety Status</p>
    <h1 style="font-size:27px;font-weight:800;letter-spacing:-.5px;margin-bottom:8px;">${heroTitle}</h1>
    <p style="font-size:14px;opacity:.9;line-height:1.5;">${heroSub}</p>
  </div>
  <div style="position:absolute;right:-12px;bottom:-12px;opacity:.08;font-size:120px;line-height:1;">${isAlarm?'🚨':'⛰'}</div>
</div>
<div class="c" style="padding:16px 16px 40px;">${body}</div>
<footer style="text-align:center;padding:16px;color:#747871;font-size:11px;border-top:1px solid #e1e3e4;background:#f8f9fa;">
  Zuletzt aktualisiert: ${new Date().toLocaleTimeString('de-CH')} · Seite aktualisiert automatisch alle 30 Sek.
</footer>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>setTimeout(()=>location.reload(),30000)</script>
</body></html>`
}

// ── GREEN ──────────────────────────────────────────────────────────────────────
function renderGreen(vehicle: any) {
  const veh = card(sectionTitle('🚗','Fahrzeug am Parkplatz'),
    `<div style="padding:16px;display:flex;align-items:center;gap:16px;">${plate(vehicle.plate)}
    <div>${vehicle.make?`<p style="font-size:15px;font-weight:700;color:#061907;">${e(vehicle.make)}${vehicle.model?' '+e(vehicle.model):''}</p>`:''}
    ${vehicle.color?`<p style="font-size:13px;color:#747871;margin-top:3px;">${e(vehicle.color)}</p>`:''}
    </div></div>`, {nopad:true})
  return shell(false,'#2c694e','KEIN ALARM','Kein aktiver Wanderer an diesem Fahrzeug.',veh)
}

// ── Shared blocks ──────────────────────────────────────────────────────────────

function buildWandererCard(user: any, isAlarm: boolean) {
  return `<div style="background:#fff;border-radius:12px;border:1px solid #e1e3e4;overflow:hidden;margin-bottom:12px;">
    <div style="padding:16px;display:flex;align-items:center;gap:14px;">
      <div style="width:64px;height:64px;border-radius:10px;background:#f3f4f5;border:1px solid #e1e3e4;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#747871" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
      </div>
      <div style="flex:1;">
        <p style="font-size:10px;font-weight:700;color:#747871;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">${isAlarm?'Vermisste Person':'Wanderer'}</p>
        <h2 style="font-size:22px;font-weight:800;color:#061907;margin-bottom:3px;">${e(user?.name)||'—'}</h2>
        <p style="font-size:13px;color:#434841;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          ${user?.birthYear?`<span>Jg. ${e(user.birthYear)}</span>`:''}
          ${user?.phone?`${user?.birthYear?'<span style="color:#c3c8bf;">·</span>':''}<a href="tel:${e(user.phone)}" style="color:#2c694e;font-weight:700;">${e(user.phone)}</a>`:''}
        </p>
      </div>
    </div>
  </div>`
}

function buildTourCard(tour: any, compact: boolean, isAlarm = false) {
  const stops: any[] = Array.isArray(tour.overnightStops) ? tour.overnightStops : (tour.overnightStops ? [tour.overnightStops] : [])
  const gpx: any = tour.gpxTrack || null
  const manualWPs: any[] = gpx?.waypoints || []

  const stopTypeLabel: Record<string,string> = {
    huette:'SAC-Hütte', zelt:'Zelt/Biwak', camping:'Camping',
    hotel:'Hotel/B&B', schutz:'Schutzhütte', privat:'Privat'
  }

  const rows = compact
    ? `<table><tbody>
        ${row('Aktivität', e(tour.activity||'—'))}
        ${row('Gestartet', fmt(tour.startedAt))}
        ${row('Rückkehr', fmt(tour.eta), true)}
        ${tour.difficulty?row('Schwierigkeit', e(tour.difficulty)):''}
        ${tour.persons>1?row('Personen', tour.persons+' Personen'):''}
      </tbody></table>`
    : `<table><tbody>
        ${row('Gestartet', fmt(tour.startedAt))}
        ${row('Geplante Rückkehr', fmt(tour.eta))}
        ${tour.activity?row('Aktivität', e(tour.activity)):''}
        ${tour.difficulty?row('Schwierigkeit', e(tour.difficulty)):''}
        ${tour.distanceKm?row('Distanz', tour.distanceKm+' km'):''}
        ${tour.elevationUp?row('Höhenmeter', '+'+tour.elevationUp+' m'):''}
        ${tour.persons>1?row('Personen', tour.persons+' Personen'):''}
        ${tour.parkingLocation?row('Parkplatz / Start', e(tour.parkingLocation)):''}
      </tbody></table>
      ${isAlarm&&tour.notes?`<div style="padding:12px 16px;border-top:1px solid #f3f4f5;">
        <p style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;">Notizen für Rettungskräfte</p>
        <p style="font-size:13px;color:#191c1d;line-height:1.6;">${e(tour.notes)}</p>
      </div>`:''}
      ${isAlarm&&manualWPs.length>0?`<div style="padding:12px 16px;border-top:1px solid #f3f4f5;">
        <p style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Wegpunkte / Route (${manualWPs.length})</p>
        ${manualWPs.map((wp: any, i: number)=>`
        <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;${i<manualWPs.length-1?'border-bottom:1px solid #f3f4f5;':''}">
          <span style="background:#f3f4f5;border-radius:100px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#747871;flex-shrink:0;margin-top:1px;">${i+1}</span>
          <div style="flex:1;">
            <p style="font-size:13px;font-weight:700;color:#061907;">${e(wp.name||'Wegpunkt')}</p>
            ${wp.lat&&wp.lng?`<a href="https://maps.google.com/?q=${wp.lat},${wp.lng}" target="_blank" style="font-size:11px;color:#2c694e;font-family:monospace;">${Number(wp.lat).toFixed(5)}, ${Number(wp.lng).toFixed(5)} ↗</a>`:''}
            ${wp.notes?`<p style="font-size:12px;color:#747871;margin-top:2px;">${e(wp.notes)}</p>`:''}
          </div>
        </div>`).join('')}
      </div>`:''}
      ${stops.length>0?`<div style="padding:12px 16px;border-top:1px solid #f3f4f5;">
        <p style="font-size:11px;font-weight:700;color:#2c694e;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">${ICONS.moon} Übernachtungen (${stops.length} Nacht${stops.length>1?'e':''})</p>
        ${stops.map((s: any, i: number)=>`
        <div style="padding:10px 0;${i<stops.length-1?'border-bottom:1px solid #f3f4f5;':''}">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <p style="font-size:13px;font-weight:700;color:#061907;">Nacht ${s.night}: ${e(s.name||stopTypeLabel[s.type]||s.type||'Unterkunft')}</p>
            ${s.type?`<span style="background:#f0faf4;color:#2c694e;font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;">${e(stopTypeLabel[s.type]||s.type)}</span>`:''}
          </div>
          ${s.address?`<p style="font-size:12px;color:#747871;">${e(s.address)}</p>`:''}
          ${s.contactName?`<p style="font-size:12px;color:#434841;margin-top:2px;">${e(s.contactName)}${s.contactPhone?` · <a href="tel:${e(s.contactPhone)}" style="color:#2c694e;font-weight:700;">${e(s.contactPhone)}</a>`:''}</p>`:''}
          ${s.lat&&s.lng?`<a href="https://maps.google.com/?q=${s.lat},${s.lng}" target="_blank" style="font-size:11px;color:#2c694e;display:inline-block;margin-top:3px;">Auf Karte zeigen ↗</a>`:''}
          ${s.notes?`<p style="font-size:12px;color:#747871;margin-top:2px;">${e(s.notes)}</p>`:''}
        </div>`).join('')}
      </div>`:''}
      `

  return card(sectionTitle('🥾','Tour'), rows)
}

function buildGpsCard(locs: any[], lastLoc: any) {
  if (!lastLoc) return card(sectionTitle('📍','Letzter bekannter Standort'),
    `<p style="padding:20px 16px;font-size:13px;color:#747871;text-align:center;">Noch keine GPS-Daten verfügbar</p>`)

  return `<div style="background:#fff;border-radius:12px;border:1px solid #e1e3e4;overflow:hidden;margin-bottom:12px;">
    <div style="padding:12px 16px;border-bottom:1px solid #e1e3e4;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:14px;font-weight:700;display:flex;align-items:center;gap:6px;">${ICONS.pin} Letzter bekannter Standort</span>
      <span style="font-size:11px;color:#747871;font-family:monospace;">${lastLoc.lat.toFixed(5)}°N ${lastLoc.lng.toFixed(5)}°E</span>
    </div>
    <div id="tt-map" style="height:240px;background:#e8eef0;"></div>
    <div style="padding:12px 16px;background:#f8f9fa;border-top:1px solid #e1e3e4;">
      <p style="font-size:12px;color:#747871;margin-bottom:10px;">Aufgezeichnet: <strong style="color:#191c1d;">${fmt(lastLoc.timestamp)}</strong></p>
      <a href="https://maps.google.com/?q=${lastLoc.lat},${lastLoc.lng}" target="_blank"
         style="display:inline-flex;align-items:center;gap:6px;background:#061907;color:#fff;padding:10px 16px;border-radius:8px;font-weight:700;font-size:13px;">
        In Google Maps öffnen ↗
      </a>
      ${locs.length>1?`<details style="margin-top:12px;">
        <summary style="font-size:13px;font-weight:700;color:#2c694e;">▼ Alle ${locs.length} GPS-Punkte anzeigen</summary>
        <div style="margin-top:10px;max-height:240px;overflow-y:auto;border:1px solid #e1e3e4;border-radius:8px;">
          <table><thead><tr style="background:#f3f4f5;position:sticky;top:0;">
            <th style="padding:7px 8px;text-align:left;color:#747871;font-size:11px;font-weight:700;">#</th>
            <th style="padding:7px 8px;text-align:left;color:#747871;font-size:11px;font-weight:700;">Zeit</th>
            <th style="padding:7px 8px;text-align:left;color:#747871;font-size:11px;font-weight:700;">Koordinaten</th>
            <th style="padding:7px 8px;text-align:right;color:#747871;font-size:11px;font-weight:700;">Höhe</th>
          </tr></thead><tbody>
          ${locs.map((l: any, i: number)=>`
          <tr style="border-top:1px solid #f3f4f5;${i===0?'background:#fff8f0;':''}">
            <td style="padding:6px 8px;color:#c3c8bf;font-size:12px;">${locs.length-i}</td>
            <td style="padding:6px 8px;font-size:12px;">${fmtT(l.timestamp)}</td>
            <td style="padding:6px 8px;"><a href="https://maps.google.com/?q=${l.lat},${l.lng}" target="_blank" style="font-family:monospace;font-size:11px;color:#2c694e;">${l.lat.toFixed(5)}, ${l.lng.toFixed(5)} ↗</a></td>
            <td style="padding:6px 8px;text-align:right;font-size:12px;color:#747871;">${l.ele!=null?Math.round(l.ele)+' m':'—'}</td>
          </tr>`).join('')}
          </tbody></table>
        </div>
      </details>`:''}
    </div>
  </div>
  <script>
  (function(){
    var lat=${lastLoc.lat},lng=${lastLoc.lng};
    var map=L.map('tt-map',{attributionControl:false});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    map.setView([lat,lng],14);
    var pts=[${locs.slice(0,100).reverse().map((l: any)=>`[${l.lat},${l.lng}]`).join(',')}];
    if(pts.length>1)L.polyline(pts,{color:'#ba1a1a',weight:3,opacity:.6}).addTo(map);
    L.circleMarker([lat,lng],{radius:10,fillColor:'#ba1a1a',color:'#fff',weight:3,fillOpacity:1}).bindPopup('Letzter Standort').addTo(map);
  })();
  </script>`
}

function buildMedCard(user: any) {
  const hasMed = user?.bloodType||user?.allergies||user?.medications||user?.medicalNotes
  return card(`<div style="width:28px;height:28px;background:#ffdad6;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg width="16" height="16" viewBox="0 0 24 24" fill="#ba1a1a"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-6 14h-2v-4H7v-2h4V7h2v4h4v2h-4v4z"/></svg></div><span style="font-size:14px;font-weight:800;color:#ba1a1a;text-transform:uppercase;letter-spacing:.3px;">Medizinische Daten</span>`,
    `<div style="padding:14px 16px;">
      ${!hasMed?`<p style="font-size:13px;color:#747871;font-style:italic;">Keine medizinischen Daten hinterlegt.</p>`:''}
      ${user?.bloodType?`<div style="background:#fff8f8;border:1px solid #ffdad6;border-radius:10px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1.5px;">BLUTGRUPPE</span>
        <span style="font-size:28px;font-weight:900;color:#ba1a1a;">${e(user.bloodType)}</span>
      </div>`:''}
      ${user?.allergies?`<div style="margin-bottom:12px;"><p style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;text-transform:uppercase;margin-bottom:7px;">Allergien</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">${user.allergies.split(',').map((a: string)=>`<span style="background:#ffdad6;color:#93000a;padding:5px 12px;border-radius:100px;font-size:12px;font-weight:700;">${e(a.trim())}</span>`).join('')}</div>
      </div>`:''}
      ${user?.medications?`<div style="${user.medicalNotes?'margin-bottom:12px;':''}"><p style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;">Medikamente</p>
        <p style="font-size:14px;line-height:1.6;color:#191c1d;">${e(user.medications)}</p></div>`:''}
      ${user?.medicalNotes?`<div><p style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;">Weitere Hinweise</p>
        <p style="font-size:14px;line-height:1.6;color:#191c1d;">${e(user.medicalNotes)}</p></div>`:''}
    </div>`, {accent:'#ba1a1a', nopad:true})
}

function buildContactsCard(contacts: any[]) {
  if (!contacts.length) return ''
  return card(`<div style="width:28px;height:28px;background:#aeeecb;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#005227" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.86a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg></div><span style="font-size:15px;font-weight:700;color:#061907;">Notfallkontakte</span>`,
    contacts.map((c: any, i: number)=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;${i<contacts.length-1?'border-bottom:1px solid #f3f4f5;':''}">
      <div>
        <p style="font-size:16px;font-weight:700;color:#061907;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          ${e(c.name)}${c.isPrimary?'<span style="font-size:10px;background:#aeeecb;color:#005227;padding:2px 8px;border-radius:100px;font-weight:700;">Primär</span>':''}
        </p>
        ${c.relation?`<p style="font-size:13px;color:#747871;margin-top:2px;">${e(c.relation)}</p>`:''}
        <p style="font-size:13px;color:#2c694e;font-weight:600;margin-top:2px;">${e(c.phone)}</p>
      </div>
      <a href="tel:${e(c.phone)}" style="width:50px;height:50px;border-radius:50%;background:${c.isPrimary?'#aeeecb':'#f3f4f5'};display:flex;align-items:center;justify-content:center;flex-shrink:0;" ontouchstart="this.style.transform='scale(.9)'" ontouchend="this.style.transform='scale(1)'">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${c.isPrimary?'#005227':'#434841'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.86a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      </a>
    </div>`).join(''), {nopad:true})
}

function buildVehicleCard(vehicle: any, compact: boolean) {
  if (compact) return `<div style="background:#fff;border-radius:12px;border:1px solid #e1e3e4;padding:14px;margin-bottom:0;">
    <p style="font-size:10px;font-weight:700;color:#747871;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Fahrzeug</p>
    ${vehicle.make?`<p style="font-size:14px;font-weight:700;color:#061907;margin-bottom:8px;">${e(vehicle.make)}${vehicle.model?' '+e(vehicle.model):''}</p>`:''}
    ${plate(vehicle.plate)}
    ${vehicle.color?`<p style="font-size:12px;color:#747871;margin-top:6px;">${e(vehicle.color)}</p>`:''}
  </div>`
  return card(sectionTitle('🚗','Fahrzeug am Parkplatz'),
    `<div style="padding:16px;display:flex;align-items:center;gap:16px;">${plate(vehicle.plate)}
    <div>${vehicle.make?`<p style="font-size:15px;font-weight:700;color:#061907;">${e(vehicle.make)}${vehicle.model?' '+e(vehicle.model):''}</p>`:''}
    ${vehicle.color?`<p style="font-size:13px;color:#747871;margin-top:3px;">${e(vehicle.color)}</p>`:''}
    </div></div>`, {nopad:true})
}

// ── RENDER ─────────────────────────────────────────────────────────────────────
function render(vehicle: any, tour: any, state: 'active'|'alarm') {
  const isAlarm = state === 'alarm'
  const user = tour.user
  const contacts: any[] = user?.emergencyContacts ?? []
  const locs: any[] = tour?.locations ?? []
  const lastLoc = locs[0] ?? null
  const etaMs = tour?.eta ? new Date(tour.eta).getTime() : null
  const minsOver = (isAlarm && etaMs) ? Math.floor((Date.now()-etaMs)/60000) : null

  const overdue = minsOver!==null ? `<div style="background:#fff3cd;border:1px solid #f59e0b;border-radius:12px;padding:13px 16px;margin-bottom:12px;display:flex;align-items:center;gap:10px;">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    <span style="font-size:13px;">Geplante Rückkehr war vor <strong>${minsOver} Minuten</strong> (${fmt(tour.eta)})</span>
  </div>` : ''

  const callBtns = isAlarm ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
    <a href="tel:117" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:#fff;border:2.5px solid #ba1a1a;color:#ba1a1a;padding:20px 12px;border-radius:14px;font-weight:800;font-size:15px;" ontouchstart="this.style.opacity='.7'" ontouchend="this.style.opacity='1'">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ba1a1a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.86a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      Polizei 117
    </a>
    <a href="tel:1414" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:#ba1a1a;color:#fff;padding:20px 12px;border-radius:14px;font-weight:800;font-size:15px;animation:pulse 2s infinite;" ontouchstart="this.style.opacity='.7'" ontouchend="this.style.opacity='1'">
      <svg width="28" height="28" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="#fff"><path d="M56 26c0-2-1-3-3-3H38l-4-10c-1-2-3-3-5-3s-4 1-5 3l-4 10H8c-2 0-3 1-3 3s2 4 4 5l8 3v6c0 2 1 3 3 3h24c2 0 3-1 3-3v-6l8-3c2-1 4-3 4-5zm-14 2v8H22v-8l-10-4h40l-10 4zm-22 14v4h16v-4H20z"/><circle cx="26" cy="52" r="3"/><circle cx="38" cy="52" r="3"/></svg>
      REGA 1414
    </a>
  </div>` : ''

  const bentoCols = '' // removed - vehicle now full width, tour goes after map

  const heroSub = isAlarm
    ? `${minsOver!==null?`Wanderer ${minsOver} Min. überfällig. `:''}${lastLoc?`Letztes GPS-Update: ${fmt(lastLoc.timestamp)}.`:'Noch kein GPS-Signal.'}`
    : `Aktive Tour · Geplante Rückkehr: ${fmt(tour.eta)}`

  let body = ''
  if (isAlarm) {
    body = overdue + callBtns + buildWandererCard(user, true) + buildVehicleCard(vehicle, false) + buildGpsCard(locs, lastLoc) + buildTourCard(tour, false, true) + buildMedCard(user) + buildContactsCard(contacts)
  } else {
    body = buildWandererCard(user, false) + buildTourCard(tour, false) + buildVehicleCard(vehicle, false)
  }

  return shell(isAlarm, isAlarm?'#ba1a1a':'#2c694e',
    isAlarm?'ALARM — ÜBERFÄLLIG':'TOUR AKTIV', heroSub, body)
}

function html404() {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Trailtag</title></head>
<body style="font-family:sans-serif;padding:40px;text-align:center;background:#f8f9fa;"><h2 style="color:#ba1a1a;margin-bottom:12px;">❌ QR-Code nicht gefunden</h2></body></html>`
}

export default router