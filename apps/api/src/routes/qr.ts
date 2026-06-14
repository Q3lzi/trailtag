import express, { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = express.Router()

// Debug endpoint
router.get('/debug/:token', async (req: Request, res: Response) => {
  const token = req.params['token'] as string
  const vehicle = await prisma.vehicle.findUnique({ where: { qrToken: token }, select: { id: true, plate: true, userId: true, qrToken: true } })
  if (!vehicle) return res.json({ error: 'Vehicle not found', token })
  const alarm = await prisma.tour.findFirst({ where: { userId: vehicle.userId, status: 'ALARM' }, orderBy: { startedAt: 'desc' }, select: { id: true, status: true, startedAt: true, eta: true, vehicleId: true } })
  const active = await prisma.tour.findFirst({ where: { userId: vehicle.userId, status: 'ACTIVE' }, orderBy: { startedAt: 'desc' }, select: { id: true, status: true, startedAt: true, eta: true, vehicleId: true } })
  const allRecent = await prisma.tour.findMany({ where: { userId: vehicle.userId }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, status: true, startedAt: true, eta: true, vehicleId: true } })
  return res.json({ vehicle, alarm, active, allRecent })
})

// Manual alarm trigger
router.post('/trigger-alarm/:token', async (req: Request, res: Response) => {
  const token = req.params['token'] as string
  const vehicle = await prisma.vehicle.findUnique({ where: { qrToken: token }, select: { id: true, userId: true } })
  if (!vehicle) return res.json({ error: 'Vehicle not found' })
  const tour = await prisma.tour.findFirst({ where: { userId: vehicle.userId, status: { in: ['ACTIVE', 'ALARM'] } }, orderBy: { startedAt: 'desc' } })
  if (!tour) return res.json({ error: 'No active tour found' })
  await prisma.alarmEvent.deleteMany({ where: { tourId: tour.id } })
  await prisma.tour.update({ where: { id: tour.id }, data: { status: 'ALARM', alarmStage: 2 } })
  return res.json({ success: true, tourId: tour.id })
})

// Main portal
router.get('/:token', async (req: Request, res: Response) => {
  const token = req.params['token'] as string

  const vehicle = await prisma.vehicle.findUnique({
    where: { qrToken: token },
    select: { id: true, plate: true, make: true, model: true, color: true, qrToken: true, userId: true }
  })
  if (!vehicle) return res.status(404).send(renderPage('notfound', vehicle, null))

  const tourInclude = {
    locations: { orderBy: { timestamp: 'asc' as const }, take: 200 },
    user: { include: { emergencyContacts: { orderBy: { isPrimary: 'desc' as const } } } }
  }

  // Priority: ALARM > ACTIVE by userId (vehicle might not be linked)
  let tour: any = await prisma.tour.findFirst({ where: { userId: vehicle.userId, status: 'ALARM' }, orderBy: { startedAt: 'desc' }, include: tourInclude })
  if (!tour) tour = await prisma.tour.findFirst({ where: { vehicleId: vehicle.id, status: 'ALARM' }, orderBy: { startedAt: 'desc' }, include: tourInclude })
  if (!tour) tour = await prisma.tour.findFirst({ where: { userId: vehicle.userId, status: 'ACTIVE' }, orderBy: { startedAt: 'desc' }, include: tourInclude })
  if (!tour) tour = await prisma.tour.findFirst({ where: { vehicleId: vehicle.id, status: 'ACTIVE' }, orderBy: { startedAt: 'desc' }, include: tourInclude })

  if (!tour || tour.status === 'PLANNED') return res.send(renderPage('green', vehicle, null))

  const etaMs = tour.eta ? new Date(tour.eta).getTime() : null
  const isOverdue = tour.status === 'ALARM' || (etaMs !== null && etaMs < Date.now())
  const isStale = tour.status === 'ACTIVE' && tour.eta && new Date(tour.eta).getTime() < Date.now() - 48 * 60 * 60 * 1000

  if (isStale) return res.send(renderPage('green', vehicle, null))
  if (isOverdue) return res.send(renderPage('alarm', vehicle, tour))
  return res.send(renderPage('active', vehicle, tour))
})

// ── Helpers ─────────────────────────────────────────────

function fmt(d: any) {
  if (!d) return '—'
  return new Date(d).toLocaleString('de-CH', { timeZone: 'Europe/Zurich', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const ACT_LABELS: Record<string,string> = {
  WANDERN:'Wandern', BERGTOUR:'Bergtour', KLETTERN:'Klettern', TRAILRUNNING:'Trailrunning',
  MOUNTAINBIKE:'Mountainbike', RADSPORT:'Radsport', SKI_SNOWBOARD:'Ski / Snowboard',
  SKITOUR:'Skitour', KLETTERSTEIG:'Klettersteig', KANU_KAJAK:'Kanu / Kajak',
  PARAGLIDING:'Paragliding', ANDERE:'Andere'
}

function mapHtml(tour: any) {
  const lat = tour.lastLat ?? tour.startLat ?? tour.gpxTrack?.points?.[0]?.lat
  const lng = tour.lastLng ?? tour.startLng ?? tour.gpxTrack?.points?.[0]?.lng
  if (!lat || !lng) return ''

  const updatedAt = tour.locationUpdatedAt ? new Date(tour.locationUpdatedAt) : null
  const minsAgo = updatedAt ? Math.floor((Date.now() - updatedAt.getTime()) / 60000) : null
  const isStaleGps = minsAgo !== null && minsAgo > 30

  const trackPoints = tour.locations?.length > 0
    ? JSON.stringify(tour.locations.map((l: any) => [l.lat, l.lng]))
    : tour.gpxTrack?.points?.length > 0
      ? JSON.stringify(tour.gpxTrack.points.map((p: any) => [p.lat, p.lng]))
      : 'null'

  const wpPoints = tour.gpxTrack?.waypoints?.filter((w: any) => w.lat && w.lng) ?? []

  return `
  <div class="section">
    <div class="section-hdr">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      Letzter bekannter Standort
      <span class="coords">${parseFloat(lat).toFixed(4)}°N, ${parseFloat(lng).toFixed(4)}°E</span>
    </div>
    <div id="map" style="height:280px"></div>
    <div class="${isStaleGps ? 'gps-warn' : 'gps-ok'}">
      ${isStaleGps ? `⚠ Signal vor ${minsAgo} Minuten — möglicherweise kein Empfang` : updatedAt ? `✓ Standort: ${fmt(updatedAt)}` : '⚠ Noch kein GPS-Update'}
    </div>
    <a class="maps-btn" href="https://maps.google.com/?q=${lat},${lng}" target="_blank">In Google Maps öffnen ↗</a>
  </div>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map');
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{attribution:'© OSM © CARTO'}).addTo(map);
    var tp = ${trackPoints};
    if (tp && tp.length > 1) {
      var poly = L.polyline(tp,{color:'#2c694e',weight:4}).addTo(map);
      L.circleMarker(tp[0],{radius:7,fillColor:'#2c694e',color:'#fff',weight:2,fillOpacity:1}).bindPopup('Start').addTo(map);
      map.fitBounds(poly.getBounds(),{padding:[20,20],maxZoom:17});
    } else { map.setView([${lat},${lng}],17); }
    L.circleMarker([${lat},${lng}],{radius:11,fillColor:'#dc2626',color:'#fff',weight:3,fillOpacity:1}).bindPopup('Letzter Standort').addTo(map).openPopup();
    ${wpPoints.map((wp: any) => `L.circleMarker([${wp.lat},${wp.lng}],{radius:7,fillColor:'#f59e0b',color:'#fff',weight:2,fillOpacity:1}).bindPopup('${(wp.name||'Wegpunkt').replace(/'/g,"\\'")}').addTo(map);`).join('\n    ')}
  </script>`
}


function overnightSection(tour: any) {
  const stops = tour.overnightStops
  if (!stops?.length) return ''

  const typeLabel: Record<string,string> = {
    huette:'SAC Hütte', berghütte:'Berghütte', hotel:'Hotel/B&B',
    zelt:'Zelt/Biwak', camping:'Camping', schutz:'Schutzhütte', privat:'Privat'
  }

  const rows = stops.map((s: any) => `
    <div style="background:#fff;border:1px solid #e1e3e4;border-radius:8px;margin-bottom:10px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid #f3f4f5;background:#f8f9fa">
        <span style="font-size:16px">🌙</span>
        <span style="font-size:13px;font-weight:800;color:#061907">Nacht ${s.night}</span>
        ${s.type ? `<span style="margin-left:auto;font-size:10px;font-weight:700;background:#f0faf4;color:#2c694e;padding:3px 9px;border-radius:100px">${typeLabel[s.type] ?? s.type}</span>` : ''}
      </div>
      <div style="padding:12px 16px">
        ${s.name ? `<div class="row"><span class="k">Unterkunft</span><span class="v" style="font-weight:800">${s.name}</span></div>` : ''}
        ${s.address ? `<div class="row"><span class="k">Adresse</span><span class="v">${s.address}</span></div>` : ''}
        ${s.reserved ? `<div class="row"><span class="k">Reservierung</span><span class="v" style="color:#2c694e">✓ Bestätigt</span></div>` : ''}
        ${s.contactName ? `<div class="row"><span class="k">Kontakt</span><span class="v">${s.contactName}</span></div>` : ''}
        ${s.contactPhone ? `<div class="row"><span class="k">Telefon</span><a href="tel:${s.contactPhone}" class="v" style="color:#2c694e">${s.contactPhone}</a></div>` : ''}
        ${s.notes ? `<div class="row" style="flex-direction:column;gap:4px"><span class="k">Notizen</span><span style="font-size:13px;color:#434841;margin-top:4px">${s.notes}</span></div>` : ''}
        ${(s.lat && s.lng) ? `
        <div style="display:flex;gap:8px;margin-top:10px">
          <a href="https://maps.google.com/?q=${s.lat},${s.lng}" target="_blank"
            style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;background:#f0faf4;border:1px solid #aeeecb;border-radius:6px;padding:9px;font-size:12px;font-weight:700;color:#2c694e;text-decoration:none">
            📍 In Maps öffnen
          </a>
          ${s.contactPhone ? `<a href="tel:${s.contactPhone}"
            style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;background:#f0faf4;border:1px solid #aeeecb;border-radius:6px;padding:9px;font-size:12px;font-weight:700;color:#2c694e;text-decoration:none">
            📞 Anrufen
          </a>` : ''}
        </div>` : ''}
      </div>
    </div>`).join('')

  return `
  <div class="section">
    <div class="section-hdr">🌙 Übernachtungen (${stops.length} Nacht${stops.length > 1 ? 'e' : ''})</div>
    <div style="padding:12px 16px">${rows}</div>
  </div>`
}

function elevHtml(tour: any) {
  const pts = tour.gpxTrack?.points?.filter((p: any) => p.ele != null) ?? []
  if (pts.length < 2) return ''
  const eles = pts.map((p: any) => p.ele)
  const min = Math.min(...eles), max = Math.max(...eles), range = max - min || 1
  const w = 800, h = 80, pad = 12
  const polyPts = pts.map((p: any, i: number) => {
    const x = pad + (i / (pts.length - 1)) * (w - pad * 2)
    const y = h - pad - ((p.ele - min) / range) * (h - pad * 2)
    return `${x},${y}`
  }).join(' ')
  const area = `${pad},${h - pad} ${polyPts} ${w - pad},${h - pad}`
  return `
  <div class="section">
    <div class="section-hdr"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> Höhenprofil</div>
    <div style="padding:8px 16px 16px">
      <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:64px">
        <defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2c694e" stop-opacity="0.25"/><stop offset="100%" stop-color="#2c694e" stop-opacity="0.02"/></linearGradient></defs>
        <polygon points="${area}" fill="url(#eg)"/>
        <polyline points="${polyPts}" fill="none" stroke="#2c694e" stroke-width="2"/>
        <text x="${pad}" y="${pad + 8}" font-size="9" fill="#747871">${Math.round(max)} m</text>
        <text x="${pad}" y="${h - 3}" font-size="9" fill="#747871">${Math.round(min)} m</text>
      </svg>
    </div>
  </div>`
}

function shell(badge: string, badgeCls: string, heroClass: string, heroTitle: string, heroSub: string, content: string) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
  <title>Trailtag — Ersthelfer Portal</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;color:#191c1d;min-height:100dvh}

    /* Header */
    .topbar{background:#fff;border-bottom:1px solid #e1e3e4;padding:0 20px;height:52px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
    .brand{font-size:17px;font-weight:800;color:#061907;letter-spacing:-0.3px;display:flex;align-items:center;gap:7px}
    .badge{font-size:11px;font-weight:700;letter-spacing:.05em;padding:4px 10px;border-radius:100px}
    .badge-alarm{background:#ffdad6;color:#ba1a1a;animation:pulse 2s infinite}
    .badge-ok{background:#f0faf4;color:#2c694e}
    .badge-gray{background:#edeeef;color:#747871}
    @keyframes pulse{0%{opacity:1}50%{opacity:.6}100%{opacity:1}}

    /* Hero */
    .hero{padding:24px 20px;color:#fff;position:relative;overflow:hidden}
    .hero-alarm{background:#ba1a1a}
    .hero-active{background:#1a3d2b}
    .hero-green{background:#061907}
    .hero-lbl{font-size:11px;font-weight:700;letter-spacing:.1em;opacity:.7;margin-bottom:5px;text-transform:uppercase}
    .hero-title{font-size:26px;font-weight:900;letter-spacing:-.5px;margin-bottom:5px}
    .hero-sub{font-size:14px;opacity:.85;line-height:1.5}

    /* Emergency calls */
    .call-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:16px 20px;background:#f3f4f5;border-bottom:1px solid #e1e3e4}
    .call-btn{display:flex;flex-direction:column;align-items:center;padding:14px 8px;border-radius:10px;border:2px solid;gap:5px;-webkit-tap-highlight-color:transparent;text-decoration:none}
    .call-btn:active{opacity:.7}
    .call-police{background:#fff;border-color:#ba1a1a;color:#ba1a1a}
    .call-rega{background:#ba1a1a;border-color:#ba1a1a;color:#fff}
    .call-icon{font-size:28px}
    .call-label{font-size:11px;font-weight:700;letter-spacing:.05em}

    /* Content */
    .content{max-width:600px;margin:0 auto;padding:16px 16px 100px}

    /* Sections */
    .section{background:#fff;border-radius:8px;border:1px solid #e1e3e4;margin-bottom:12px;overflow:hidden}
    .section-hdr{display:flex;align-items:center;gap:8px;font-size:10px;font-weight:700;color:#747871;letter-spacing:.08em;text-transform:uppercase;padding:13px 16px;border-bottom:1px solid #f3f4f5}
    .section-hdr .coords{margin-left:auto;font-size:12px;font-weight:600;color:#434841;letter-spacing:0;text-transform:none}

    /* Info rows */
    .row{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid #f3f4f5;font-size:14px;gap:12px}
    .row:last-child{border-bottom:none}
    .row .k{color:#747871;flex-shrink:0}
    .row .v{font-weight:600;color:#191c1d;text-align:right}
    .row .v-red{font-weight:800;color:#ba1a1a;font-size:16px}
    .row a.v{color:#2c694e}

    /* Person */
    .person-card{display:flex;align-items:center;gap:14px;padding:16px}
    .person-avatar{width:52px;height:52px;border-radius:8px;background:#e7e8e9;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0}
    .person-lbl{font-size:10px;font-weight:700;letter-spacing:.07em;color:#747871;margin-bottom:3px;text-transform:uppercase}
    .person-name{font-size:18px;font-weight:800;color:#061907;letter-spacing:-.3px}
    .person-sub{font-size:13px;color:#2c694e;font-weight:600;margin-top:3px}

    /* Vehicle bento */
    .vehicle-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#f3f4f5}
    .vcell{background:#fff;padding:12px 16px}
    .vcell .vk{font-size:10px;font-weight:700;color:#747871;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
    .vcell .vv{font-size:15px;font-weight:700;color:#061907}
    .vcell .vs{font-size:12px;color:#747871;margin-top:2px}

    /* Medical */
    .med-section{background:#fff;border-radius:8px;border:1px solid #e1e3e4;border-left:5px solid #ba1a1a;margin-bottom:12px;overflow:hidden}
    .med-hdr{display:flex;align-items:center;gap:8px;padding:13px 16px;border-bottom:1px solid #f3f4f5}
    .med-title{font-size:12px;font-weight:800;color:#ba1a1a;text-transform:uppercase;letter-spacing:.05em}
    .blood{background:#fff5f5;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f3f4f5}
    .blood-lbl{font-size:10px;font-weight:700;color:#747871;text-transform:uppercase;letter-spacing:.06em}
    .blood-val{font-size:22px;font-weight:900;color:#ba1a1a}
    .allergy-tags{display:flex;flex-wrap:wrap;gap:6px;padding:12px 16px;border-bottom:1px solid #f3f4f5}
    .allergy-tag{background:#ffdad6;color:#ba1a1a;border-radius:100px;padding:4px 12px;font-size:11px;font-weight:700}

    /* Contacts */
    .contact-row{display:flex;justify-content:space-between;align-items:center;padding:13px 16px;border-bottom:1px solid #f3f4f5}
    .contact-row:last-child{border-bottom:none}
    .contact-name{font-size:15px;font-weight:700;color:#061907}
    .contact-sub{font-size:12px;color:#747871;margin-top:2px}
    .call-circle{width:44px;height:44px;border-radius:22px;display:flex;align-items:center;justify-content:center;text-decoration:none;flex-shrink:0;font-size:20px}
    .call-primary{background:#aeeecb}
    .call-secondary{background:#edeeef}

    /* Map */
    #map{height:280px;background:#e7e8e9}
    .gps-warn{font-size:12px;color:#b45309;font-weight:600;padding:8px 16px;background:#fffbeb;border-top:1px solid #fde68a}
    .gps-ok{font-size:12px;color:#2c694e;font-weight:600;padding:8px 16px;background:#f0faf4;border-top:1px solid #aeeecb}
    .maps-btn{display:block;padding:12px 16px;font-size:13px;font-weight:700;color:#2c694e;border-top:1px solid #f3f4f5;text-align:center;text-decoration:none}

    /* Green status */
    .green-banner{background:#f0faf4;border:1px solid #aeeecb;border-radius:8px;padding:16px;margin-bottom:12px;font-size:14px;color:#2c694e;line-height:1.6}

    /* Privacy */
    .privacy-box{background:#f8f9fa;border:1px solid #e1e3e4;border-radius:8px;padding:24px;text-align:center;margin-bottom:12px}
    .privacy-icon{font-size:30px;margin-bottom:8px}
    .privacy-title{font-size:14px;font-weight:700;color:#434841;margin-bottom:4px}
    .privacy-sub{font-size:13px;color:#747871}

    /* Notes */
    .notes-body{padding:14px 16px;font-size:14px;line-height:1.65;color:#434841}

    /* Footer */
    footer{padding:20px;text-align:center;border-top:1px solid #e1e3e4;margin-top:4px}
    .token{font-size:11px;color:#747871;margin-bottom:4px}
    .token span{font-family:monospace;font-weight:600;color:#434841}
    .legal{font-size:10px;color:#c3c8bf;text-transform:uppercase;letter-spacing:.07em}
  </style>
</head>
<body>
  <header class="topbar">
    <div class="brand">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2c694e" stroke-width="2.5"><polygon points="12 2 22 20 2 20"/><line x1="12" y1="8" x2="12" y2="14"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      Trailtag
    </div>
    <div class="badge ${badgeCls}">${badge}</div>
  </header>
  <div class="hero ${heroClass}">
    <div class="hero-lbl">Safety Status</div>
    <div class="hero-title">${heroTitle}</div>
    <div class="hero-sub">${heroSub}</div>
  </div>
  ${content}
  <script>setTimeout(()=>location.reload(),30000);</script>
</body>
</html>`
}

function renderPage(state: 'green' | 'active' | 'alarm' | 'notfound', vehicle: any, tour: any) {
  if (state === 'notfound') {
    return shell('UNBEKANNT', 'badge-gray', 'hero-green', 'QR-Code unbekannt', 'Dieses Fahrzeug ist nicht registriert.', '<div class="content"><div class="privacy-box"><div class="privacy-icon">❓</div><div class="privacy-title">Unbekannter QR-Code</div><div class="privacy-sub">Kein Fahrzeug zu diesem Code gefunden.</div></div></div>')
  }

  if (state === 'green' || !tour) {
    const body = `
    <div class="content">
      ${tour ? `
      <div class="green-banner">✅ Person ist planmässig unterwegs. Geplante Rückkehr: <strong>${fmt(tour.eta)}</strong></div>
      <div class="section">
        <div class="section-hdr"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg> Tour</div>
        <div class="row"><span class="k">Aktivität</span><span class="v">${ACT_LABELS[tour.activity] ?? tour.activity}</span></div>
        ${tour.routeName ? `<div class="row"><span class="k">Route</span><span class="v">${tour.routeName}</span></div>` : ''}
        <div class="row"><span class="k">Geplante Rückkehr</span><span class="v">${fmt(tour.eta)}</span></div>
      </div>
      <div class="section">
        <div class="section-hdr"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> Fahrzeug am Parkplatz</div>
        <div class="row"><span class="k">Kennzeichen</span><span class="v">${vehicle.plate}</span></div>
        <div class="row"><span class="k">Fahrzeug</span><span class="v">${vehicle.make} ${vehicle.model}</span></div>
        ${tour.parkingLocation ? `<div class="row"><span class="k">Parkplatz</span><span class="v">${tour.parkingLocation}</span></div>` : ''}
      </div>
      <div class="privacy-box">
        <div class="privacy-icon">🔒</div>
        <div class="privacy-title">Persönliche Daten geschützt</div>
        <div class="privacy-sub">Name, Kontakte und medizinische Informationen werden nur im Notfall (Alarm) angezeigt.</div>
      </div>` : `
      <div class="green-banner">✅ Dieses Fahrzeug ist registriert. Aktuell keine aktive Tour.</div>
      <div class="section">
        <div class="section-hdr"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> Fahrzeug</div>
        <div class="row"><span class="k">Kennzeichen</span><span class="v">${vehicle.plate}</span></div>
        <div class="row"><span class="k">Fahrzeug</span><span class="v">${vehicle.make} ${vehicle.model}</span></div>
        <div class="row"><span class="k">Farbe</span><span class="v">${vehicle.color}</span></div>
      </div>`}
      <footer>
        <div class="token">Token: <span>${vehicle.qrToken?.slice(0,8).toUpperCase()}</span></div>
        <div class="legal">Authorized use only · All access is logged</div>
      </footer>
    </div>`
    return shell('✓ KEIN ALARM', 'badge-ok', 'hero-green', 'Alles in Ordnung', tour ? 'Die Person ist unterwegs und der Safety-Timer ist aktiv.' : 'Kein aktiver Safety-Timer für dieses Fahrzeug.', body)
  }

  // ── ALARM ────────────────────────────────────────────────────────
  const etaMs = tour.eta ? new Date(tour.eta).getTime() : null
  const overdueMs = etaMs ? Date.now() - etaMs : 0
  const overdueH = Math.floor(overdueMs / 3600000)
  const overdueM = Math.floor((overdueMs % 3600000) / 60000)
  const overdueStr = overdueH > 0 ? `${overdueH}h ${overdueM}min` : `${overdueM} Minuten`
  const user = tour.user
  const allergies = user?.allergies ? user.allergies.split(',').map((a: string) => a.trim()).filter(Boolean) : []

  const body = `
  <div class="call-grid">
    <a class="call-btn call-police" href="tel:117"><span class="call-icon">🚔</span><span class="call-label">POLIZEI (117)</span></a>
    <a class="call-btn call-rega" href="tel:1414"><span class="call-icon">🚁</span><span class="call-label">REGA (1414)</span></a>
  </div>
  <div class="content">
    ${mapHtml(tour)}

    <div class="section">
      <div class="section-hdr"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Vermisste Person</div>
      <div class="person-card">
        <div class="person-avatar">👤</div>
        <div>
          <div class="person-lbl">Name</div>
          <div class="person-name">${user?.name ?? '—'}</div>
          ${user?.phone ? `<div class="person-sub"><a href="tel:${user.phone}" style="color:#2c694e;font-weight:700">${user.phone}</a></div>` : ''}
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-hdr"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg> Tour-Details</div>
      <div class="row"><span class="k">Aktivität</span><span class="v">${ACT_LABELS[tour.activity] ?? tour.activity}</span></div>
      ${tour.routeName ? `<div class="row"><span class="k">Route</span><span class="v">${tour.routeName}</span></div>` : ''}
      ${tour.difficulty ? `<div class="row"><span class="k">Schwierigkeit</span><span class="v">${tour.difficulty}</span></div>` : ''}
      <div class="row"><span class="k">Personen</span><span class="v">${tour.persons ?? 1}</span></div>
      ${tour.distanceKm ? `<div class="row"><span class="k">Distanz</span><span class="v">${tour.distanceKm} km</span></div>` : ''}
      ${tour.elevationUp ? `<div class="row"><span class="k">Höhenmeter</span><span class="v">↑ ${tour.elevationUp} m</span></div>` : ''}
      <div class="row"><span class="k">Gestartet</span><span class="v">${fmt(tour.startedAt)}</span></div>
      <div class="row"><span class="k">Hätte zurück sein sollen</span><span class="v-red">${fmt(tour.eta)}</span></div>
      ${tour.parkingLocation ? `<div class="row"><span class="k">Parkplatz</span><span class="v">${tour.parkingLocation}</span></div>` : ''}
    </div>

    <div class="section">
      <div class="section-hdr"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> Fahrzeug am Parkplatz</div>
      <div class="vehicle-grid">
        <div class="vcell"><div class="vk">Kennzeichen</div><div class="vv">${vehicle.plate}</div></div>
        <div class="vcell"><div class="vk">Fahrzeug</div><div class="vv">${vehicle.make} ${vehicle.model}</div><div class="vs">${vehicle.color}</div></div>
      </div>
    </div>

    ${(user?.bloodType || allergies.length > 0 || user?.medications || user?.medicalNotes) ? `
    <div class="med-section">
      <div class="med-hdr">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ba1a1a" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        <span class="med-title">Medizinische Daten</span>
      </div>
      ${user.bloodType ? `<div class="blood"><span class="blood-lbl">Blutgruppe</span><span class="blood-val">${user.bloodType}</span></div>` : ''}
      ${allergies.length > 0 ? `<div class="allergy-tags">${allergies.map((a: string) => `<span class="allergy-tag">${a}</span>`).join('')}</div>` : ''}
      ${user.medications ? `<div class="row"><span class="k">Medikamente</span><span class="v">${user.medications}</span></div>` : ''}
      ${user.medicalNotes ? `<div class="row"><span class="k">Hinweise</span><span class="v">${user.medicalNotes}</span></div>` : ''}
    </div>` : ''}

    ${user?.emergencyContacts?.length > 0 ? `
    <div class="section">
      <div class="section-hdr"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12 19.79 19.79 0 0 1 1.95 3.36 2 2 0 0 1 3.92 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 5.99 5.99l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg> Notfallkontakte</div>
      ${user.emergencyContacts.map((c: any, i: number) => `
        <div class="contact-row">
          <div>
            <div class="contact-name">${c.name}${c.isPrimary ? ' <span style="font-size:10px;background:#aeeecb;color:#006838;padding:2px 7px;border-radius:100px;font-weight:700">Primär</span>' : ''}</div>
            <div class="contact-sub">${c.relation ?? ''}</div>
          </div>
          <a class="call-circle ${i === 0 ? 'call-primary' : 'call-secondary'}" href="tel:${c.phone}">📞</a>
        </div>`).join('')}
    </div>` : ''}

    ${tour.notes ? `
    <div class="section">
      <div class="section-hdr"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Notizen für Rettungskräfte</div>
      <div class="notes-body">${tour.notes.replace(/\n/g, '<br>')}</div>
    </div>` : ''}

    ${overnightSection(tour)}
    ${elevHtml(tour)}

    <footer>
      <div class="token">Secure Token: <span>${vehicle.qrToken?.slice(0,8).toUpperCase()}</span></div>
      <div class="legal">Authorized use only · All access is logged and tracked</div>
    </footer>
  </div>`

  return shell('⚠ EMERGENCY MODE', 'badge-alarm', 'hero-alarm',
    `ALARM — ÜBERFÄLLIG`,
    `Person ist seit ${overdueStr} überfällig. Letzte Aktivität: ${fmt(tour.locationUpdatedAt ?? tour.startedAt)}.`,
    body)
}

export default router