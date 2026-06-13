import express, { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = express.Router()

// Debug endpoint — remove after testing
router.get('/debug/:token', async (req: Request, res: Response) => {
  const token = req.params['token'] as string
  const vehicle = await prisma.vehicle.findUnique({
    where: { qrToken: token },
    select: { id: true, plate: true, userId: true, qrToken: true }
  })
  if (!vehicle) return res.json({ error: 'Vehicle not found', token })

  const alarm = await prisma.tour.findFirst({
    where: { userId: vehicle.userId, status: 'ALARM' },
    orderBy: { startedAt: 'desc' },
    select: { id: true, status: true, startedAt: true, eta: true, vehicleId: true, userId: true }
  })
  const active = await prisma.tour.findFirst({
    where: { userId: vehicle.userId, status: 'ACTIVE' },
    orderBy: { startedAt: 'desc' },
    select: { id: true, status: true, startedAt: true, eta: true, vehicleId: true, userId: true }
  })
  const allRecent = await prisma.tour.findMany({
    where: { userId: vehicle.userId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, status: true, startedAt: true, eta: true, vehicleId: true }
  })

  return res.json({ vehicle, alarm, active, allRecent })
})

router.get('/:token', async (req: Request, res: Response) => {
  const token = req.params['token'] as string

  // Step 1: find vehicle by QR token
  const vehicle = await prisma.vehicle.findUnique({
    where: { qrToken: token },
    select: { id: true, plate: true, make: true, model: true, color: true, qrToken: true, userId: true }
  })

  if (!vehicle) return res.status(404).send(renderNotFound())

  // Step 2: find the most urgent tour — ALARM first, then ACTIVE, then most recent ACTIVE
  // Search by vehicleId OR by userId (in case vehicleId wasn't set on the tour)
  const tourInclude = {
    locations: { orderBy: { timestamp: 'asc' as const } },
    user: { include: { emergencyContacts: { orderBy: { isPrimary: 'desc' as const } } } }
  }

  // Priority 1: ALARM tour linked to this vehicle
  let activeTour: any = await prisma.tour.findFirst({
    where: { vehicleId: vehicle.id, status: 'ALARM' },
    orderBy: { startedAt: 'desc' },
    include: tourInclude
  })

  // Priority 2: ALARM tour by same user (vehicle might not be linked on tour)
  if (!activeTour) {
    activeTour = await prisma.tour.findFirst({
      where: { userId: vehicle.userId, status: 'ALARM' },
      orderBy: { startedAt: 'desc' },
      include: tourInclude
    })
  }

  // Priority 3: ACTIVE tour linked to this vehicle
  if (!activeTour) {
    activeTour = await prisma.tour.findFirst({
      where: { vehicleId: vehicle.id, status: 'ACTIVE' },
      orderBy: { startedAt: 'desc' },
      include: tourInclude
    })
  }

  // Priority 4: ACTIVE tour by same user
  if (!activeTour) {
    activeTour = await prisma.tour.findFirst({
      where: { userId: vehicle.userId, status: 'ACTIVE' },
      orderBy: { startedAt: 'desc' },
      include: tourInclude
    })
  }

  // Step 3: determine effective status
  const etaMs = activeTour?.eta ? new Date(activeTour.eta).getTime() : null
  const nowMs = Date.now()

  // Stale: ACTIVE tour with ETA > 48h ago (forgotten, ignore)
  const isStale = activeTour &&
    activeTour.status === 'ACTIVE' &&
    etaMs !== null &&
    etaMs < nowMs - 48 * 60 * 60 * 1000

  // Overdue: ETA has passed (even if DB still says ACTIVE — cron may not have run yet)
  const isOverdue = activeTour &&
    etaMs !== null &&
    etaMs < nowMs

  if (!activeTour || isStale) return res.send(renderGreen(vehicle))
  // Show ALARM view if status is ALARM OR if ETA has passed (cron bridge)
  if (activeTour.status === 'ALARM' || isOverdue) return res.send(renderAlarm(vehicle, activeTour))
  return res.send(renderActive(vehicle, activeTour))
})

// ── Helpers ──────────────────────────────────────────────────────

function fmt(d: Date | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleString('de-CH', { timeZone: 'Europe/Zurich', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtTime(d: Date | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString('de-CH', { timeZone: 'Europe/Zurich', hour: '2-digit', minute: '2-digit' })
}

const ACTIVITY_LABELS: Record<string, string> = {
  WANDERN:'Wandern', BERGTOUR:'Bergtour', KLETTERN:'Klettern', TRAILRUNNING:'Trailrunning',
  MOUNTAINBIKE:'Mountainbike', RADSPORT:'Radsport', SKI_SNOWBOARD:'Ski / Snowboard',
  SKITOUR:'Skitour', KLETTERSTEIG:'Klettersteig', KANU_KAJAK:'Kanu / Kajak',
  PARAGLIDING:'Paragliding', ANDERE:'Andere',
}

function mapScript(tour: any) {
  const lat = tour.lastLat ?? tour.startLat
  const lng = tour.lastLng ?? tour.startLng
  if (!lat || !lng) return ''

  const trackPoints = tour.locations?.length > 0
    ? tour.locations.map((l: any) => [l.lat, l.lng])
    : tour.gpxTrack?.points?.length > 0
      ? tour.gpxTrack.points.map((p: any) => [p.lat, p.lng])
      : null

  const wpPoints = tour.gpxTrack?.waypoints?.filter((w: any) => w.lat && w.lng) ?? []

  const updatedAt = tour.locationUpdatedAt ? new Date(tour.locationUpdatedAt) : null
  const minsAgo = updatedAt ? Math.floor((Date.now() - updatedAt.getTime()) / 60000) : null
  const isStaleGps = minsAgo !== null && minsAgo > 30

  return `
    <div class="section">
      <div class="section-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        Letzter bekannter Standort
        <span class="coords">${parseFloat(lat).toFixed(4)}° N, ${parseFloat(lng).toFixed(4)}° E</span>
      </div>
      <div id="map" class="map-container"></div>
      ${isStaleGps
        ? `<div class="gps-warning">⚠ Signal vor ${minsAgo} Minuten — möglicherweise kein Empfang</div>`
        : updatedAt ? `<div class="gps-ok">✓ Standort: ${fmt(updatedAt)}</div>` : '<div class="gps-warning">⚠ Noch kein GPS-Update empfangen</div>'
      }
      <a class="maps-btn" href="https://maps.google.com/?q=${lat},${lng}" target="_blank">
        In Google Maps öffnen ↗
      </a>
    </div>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      var map = L.map('map');
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{attribution:'© OSM © CARTO'}).addTo(map);
      var trackPoints = ${JSON.stringify(trackPoints)};
      if (trackPoints && trackPoints.length > 1) {
        var poly = L.polyline(trackPoints,{color:'#2c694e',weight:4,opacity:0.9}).addTo(map);
        L.circleMarker(trackPoints[0],{radius:7,fillColor:'#2c694e',color:'#fff',weight:2,fillOpacity:1}).bindPopup('Start').addTo(map);
        map.fitBounds(poly.getBounds(),{padding:[24,24]});
      } else { map.setView([${lat},${lng}],13); }
      L.circleMarker([${lat},${lng}],{radius:11,fillColor:'#dc2626',color:'#fff',weight:3,fillOpacity:1})
        .bindPopup('<b>Letzter Standort</b>${updatedAt ? '<br>' + fmt(updatedAt) : ''}').addTo(map).openPopup();
      ${wpPoints.map((wp: any) =>
        `L.circleMarker([${wp.lat},${wp.lng}],{radius:7,fillColor:'#f59e0b',color:'#fff',weight:2,fillOpacity:1}).bindPopup('${(wp.name||'Wegpunkt').replace(/'/g,"\\'")}${wp.ele ? '<br>' + Math.round(wp.ele) + ' m' : ''}').addTo(map);`
      ).join('\n      ')}
    </script>
  `
}

function trackingLogSection(tour: any) {
  const locs = tour.locations ?? []
  if (locs.length === 0) return ''
  const shown = locs.slice(-20)  // last 20 for portal
  const rows = shown.map((l: any) => {
    const t = new Date(l.timestamp).toLocaleTimeString('de-CH', { timeZone: 'Europe/Zurich', hour: '2-digit', minute: '2-digit' })
    const lat = l.lat?.toFixed(4)
    const lng = l.lng?.toFixed(4)
    const ele = l.ele ? `${Math.round(l.ele)} m` : ''
    return `<div class="info-row" style="font-size:13px">
      <span class="key">${t}</span>
      <span class="val" style="font-size:12px;color:#434841">${lat}, ${lng}${ele ? ' · ' + ele : ''}</span>
    </div>`
  }).join('')

  return `
  <div class="section">
    <div class="section-header">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
      GPS-Tracking Log
      <span style="margin-left:auto;font-size:11px;font-weight:600;color:#434841">${locs.length} Punkte total</span>
    </div>
    <div id="log-wrap" style="max-height:200px;overflow:hidden;transition:max-height 0.3s">
      ${rows}
    </div>
    ${locs.length > 5 ? `<button onclick="var w=document.getElementById('log-wrap');var btn=this;if(w.style.maxHeight==='none'){w.style.maxHeight='200px';btn.textContent='▼ Alle ${locs.length} Logs anzeigen';}else{w.style.maxHeight='none';btn.textContent='▲ Weniger anzeigen';}" 
      style="width:100%;padding:12px;font-size:12px;font-weight:700;color:#2c694e;background:#f0faf4;border:none;cursor:pointer;border-top:1px solid #f3f4f5">
      ▼ Alle ${locs.length} Logs anzeigen
    </button>` : ''}
  </div>`
}

function elevationSection(tour: any) {
  const points = tour?.gpxTrack?.points?.filter((p: any) => p.ele != null)
  if (!points?.length) return ''
  const eles = points.map((p: any) => p.ele)
  const minE = Math.min(...eles), maxE = Math.max(...eles), range = maxE - minE || 1
  const w = 800, h = 100, pad = 12
  const pts = points.map((p: any, i: number) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2)
    const y = h - pad - ((p.ele - minE) / range) * (h - pad * 2)
    return `${x},${y}`
  }).join(' ')
  const area = `${pad},${h - pad} ${pts} ${w - pad},${h - pad}`
  return `
  <div class="section">
    <div class="section-header">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
      Höhenprofil
    </div>
    <div class="elevation-wrap">
      <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:80px">
        <defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#2c694e" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#2c694e" stop-opacity="0.02"/>
        </linearGradient></defs>
        <polygon points="${area}" fill="url(#eg)"/>
        <polyline points="${pts}" fill="none" stroke="#2c694e" stroke-width="2"/>
        <text x="${pad}" y="${pad + 10}" font-size="10" fill="#747871">${Math.round(maxE)} m</text>
        <text x="${pad}" y="${h - 3}" font-size="10" fill="#747871">${Math.round(minE)} m</text>
      </svg>
    </div>
  </div>`
}

// ── Page renderers ────────────────────────────────────────────────

function shell(content: string) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
  <title>Trailtag — Ersthelfer Portal</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;color:#191c1d}
    a{color:inherit;text-decoration:none}

    /* Header */
    .top-bar{background:#fff;border-bottom:1px solid #e1e3e4;padding:0 20px;height:52px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
    .brand{display:flex;align-items:center;gap:8px;font-size:17px;font-weight:800;color:#061907;letter-spacing:-0.3px}
    .brand svg{color:#2c694e}
    .mode-badge{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;letter-spacing:0.05em;padding:5px 10px;border-radius:100px}
    .badge-alarm{background:#ffdad6;color:#ba1a1a;animation:pulse 2s infinite}
    .badge-ok{background:#f0faf4;color:#2c694e}
    .badge-gray{background:#edeeef;color:#747871}
    @keyframes pulse{0%{opacity:1}50%{opacity:0.6}100%{opacity:1}}

    /* Status Hero */
    .status-hero{padding:24px 20px;color:#fff;position:relative;overflow:hidden}
    .hero-alarm{background:#ba1a1a}
    .hero-active{background:#1a3d2b}
    .hero-green{background:#061907}
    .status-label{font-size:11px;font-weight:700;letter-spacing:0.1em;opacity:0.75;margin-bottom:6px}
    .status-title{font-size:26px;font-weight:900;letter-spacing:-0.5px;margin-bottom:6px}
    .status-sub{font-size:14px;opacity:0.85;line-height:1.5}

    /* Emergency call buttons */
    .call-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:16px 20px;background:#f3f4f5}
    .call-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:14px 8px;border-radius:10px;border:2px solid;gap:6px;transition:opacity 0.1s;-webkit-tap-highlight-color:transparent}
    .call-btn:active{opacity:0.7}
    .call-btn-police{background:#fff;border-color:#ba1a1a;color:#ba1a1a}
    .call-btn-rega{background:#ba1a1a;border-color:#ba1a1a;color:#fff}
    .call-icon{font-size:28px}
    .call-label{font-size:11px;font-weight:700;letter-spacing:0.06em}

    /* Main content */
    .content{max-width:600px;margin:0 auto;padding:16px 16px 120px}

    /* Sections */
    .section{background:#fff;border-radius:8px;border:1px solid #e1e3e4;margin-bottom:12px;overflow:hidden}
    .section-header{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;color:#747871;letter-spacing:0.08em;padding:14px 16px;border-bottom:1px solid #f3f4f5;text-transform:uppercase}
    .section-header .coords{margin-left:auto;font-size:12px;font-weight:600;color:#434841;letter-spacing:0}
    .section-body{padding:16px}

    /* Info rows */
    .info-row{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid #f3f4f5;font-size:14px}
    .info-row:last-child{border-bottom:none}
    .info-row .key{color:#747871}
    .info-row .val{font-weight:600;color:#191c1d}
    .info-row .val-red{font-weight:700;color:#ba1a1a;font-size:16px}
    .info-row a.val{color:#2c694e;font-weight:700}

    /* Person card */
    .person-card{display:flex;align-items:center;gap:14px;padding:16px}
    .person-avatar{width:56px;height:56px;border-radius:8px;background:#e7e8e9;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0}
    .person-label{font-size:10px;font-weight:700;letter-spacing:0.08em;color:#747871;margin-bottom:3px;text-transform:uppercase}
    .person-name{font-size:18px;font-weight:800;color:#061907;letter-spacing:-0.3px}
    .person-sub{font-size:13px;color:#747871;margin-top:2px}

    /* Vehicle */
    .vehicle-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#f3f4f5}
    .vehicle-cell{background:#fff;padding:12px 16px}
    .vehicle-cell .key{font-size:10px;font-weight:700;color:#747871;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px}
    .vehicle-cell .val{font-size:15px;font-weight:700;color:#061907}
    .vehicle-cell .sub{font-size:12px;color:#747871;margin-top:2px}

    /* Medical */
    .medical-section{background:#fff;border-radius:8px;border:1px solid #e1e3e4;border-left:5px solid #ba1a1a;margin-bottom:12px;overflow:hidden}
    .medical-header{display:flex;align-items:center;gap:8px;padding:14px 16px;border-bottom:1px solid #f3f4f5}
    .medical-title{font-size:13px;font-weight:800;color:#ba1a1a;text-transform:uppercase;letter-spacing:0.05em}
    .blood-type{background:#fff5f5;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f3f4f5}
    .blood-label{font-size:11px;font-weight:700;color:#747871;text-transform:uppercase;letter-spacing:0.06em}
    .blood-val{font-size:20px;font-weight:900;color:#ba1a1a}
    .allergy-tags{display:flex;flex-wrap:wrap;gap:6px;padding:12px 16px;border-bottom:1px solid #f3f4f5}
    .allergy-tag{background:#ffdad6;color:#ba1a1a;border-radius:100px;padding:4px 12px;font-size:11px;font-weight:700;letter-spacing:0.04em}

    /* Contacts */
    .contact-row{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #f3f4f5}
    .contact-row:last-child{border-bottom:none}
    .contact-name{font-size:15px;font-weight:700;color:#061907}
    .contact-sub{font-size:12px;color:#747871;margin-top:2px}
    .call-circle{width:44px;height:44px;border-radius:22px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .call-circle-primary{background:#aeeecb;color:#006838}
    .call-circle-secondary{background:#edeeef;color:#434841}

    /* Map */
    .map-container{height:260px;background:#e7e8e9}
    .gps-warning{font-size:12px;color:#f59e0b;font-weight:600;padding:8px 16px;background:#fffbf0;border-top:1px solid #fde68a}
    .gps-ok{font-size:12px;color:#2c694e;font-weight:600;padding:8px 16px;background:#f0faf4;border-top:1px solid #aeeecb}
    .maps-btn{display:block;padding:12px 16px;font-size:13px;font-weight:700;color:#2c694e;border-top:1px solid #f3f4f5;text-align:center}
    .elevation-wrap{padding:8px 16px 16px}

    /* Notes */
    .notes-body{padding:14px 16px;font-size:14px;line-height:1.6;color:#434841}

    /* Green status */
    .green-banner{background:#f0faf4;border:1px solid #aeeecb;border-radius:8px;padding:16px;margin-bottom:12px;font-size:14px;color:#2c694e;line-height:1.5}

    /* Footer */
    footer{padding:20px;text-align:center;border-top:1px solid #e1e3e4;margin-top:8px}
    .token{font-size:11px;color:#747871;margin-bottom:4px}
    .token span{font-family:monospace;font-weight:600;color:#434841}
    .legal{font-size:10px;color:#c3c8bf;text-transform:uppercase;letter-spacing:0.08em}

    /* FAB */
    .fab-wrap{position:fixed;bottom:20px;left:0;right:0;display:flex;justify-content:center;padding:0 20px;pointer-events:none;z-index:50}
    .fab-btn{pointer-events:auto;width:100%;max-width:320px;height:52px;background:#ba1a1a;color:#fff;border:none;border-radius:100px;font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 4px 20px rgba(186,26,26,0.4);-webkit-tap-highlight-color:transparent;cursor:pointer;letter-spacing:0.02em}
    .fab-btn:active{opacity:0.85}
    .fab-btn-green{background:#2c694e;box-shadow:0 4px 20px rgba(44,105,78,0.3)}

    /* Locked overlay */
    .locked{background:#f8f9fa;border:1px solid #e1e3e4;border-radius:8px;padding:24px;text-align:center;margin-bottom:12px;color:#747871;font-size:14px}
    .locked-icon{font-size:32px;margin-bottom:8px}
    .locked-title{font-size:14px;font-weight:700;color:#434841;margin-bottom:4px}

    /* Badge pill */
    .pill{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:100px;font-size:10px;font-weight:700}
    .pill-primary{background:#aeeecb;color:#006838}
  </style>
</head>
<body>
  <header class="top-bar">
    <div class="brand">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/><path d="m5 9 7 7 7-7"/></svg>
      Trailtag
    </div>
    __MODE_BADGE__
  </header>
  __CONTENT__
  <script>setTimeout(()=>location.reload(),30000);</script>
</body>
</html>`
}

function renderNotFound() {
  const content = `
  <div class="status-hero hero-green">
    <div class="status-label">STATUS</div>
    <div class="status-title">QR-Code unbekannt</div>
    <div class="status-sub">Dieser Code ist nicht im System registriert.</div>
  </div>
  <div class="content">
    <div class="locked"><div class="locked-icon">❓</div><div class="locked-title">Unbekannter QR-Code</div><p>Kein Fahrzeug zu diesem Code gefunden.</p></div>
  </div>`
  return shell(content)
    .replace('__MODE_BADGE__', '<div class="mode-badge badge-gray">UNBEKANNT</div>')
    .replace('__CONTENT__', content)
}

function renderGreen(vehicle: any) {
  const content = `
  <div class="status-hero hero-green">
    <div class="status-label">SAFETY STATUS</div>
    <div class="status-title">Alles in Ordnung</div>
    <div class="status-sub">Dieses Fahrzeug ist registriert. Aktuell keine aktive Tour.</div>
  </div>
  <div class="content">
    <div class="green-banner">✅ Keine aktive Tour — dieses Fahrzeug wurde korrekt registriert und ist im System erfasst.</div>
    <div class="section">
      <div class="section-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        Fahrzeug
      </div>
      <div class="info-row"><span class="key">Kennzeichen</span><span class="val">${vehicle.plate}</span></div>
      <div class="info-row"><span class="key">Fahrzeug</span><span class="val">${vehicle.make} ${vehicle.model}</span></div>
      <div class="info-row"><span class="key">Farbe</span><span class="val">${vehicle.color}</span></div>
    </div>
    <footer>
      <div class="token">Token: <span>${vehicle.qrToken?.slice(0,8).toUpperCase() ?? '—'}</span></div>
      <div class="legal">Authorized use only · All access is logged</div>
    </footer>
  </div>`
  return shell(content)
    .replace('__MODE_BADGE__', '<div class="mode-badge badge-ok">✓ KEIN ALARM</div>')
    .replace('__CONTENT__', content)
}

function renderActive(vehicle: any, tour: any) {
  // Active: show map + basic info, but keep personal/medical details hidden
  const eta = tour.eta ? new Date(tour.eta) : null
  const etaStr = fmtTime(eta)
  const user = tour.user

  const content = `
  <div class="status-hero hero-active">
    <div class="status-label">SAFETY STATUS</div>
    <div class="status-title">Tour aktiv</div>
    <div class="status-sub">Person ist unterwegs. Geplante Rückkehr: ${etaStr} Uhr.</div>
  </div>
  <div class="content">
    <!-- Map always visible -->
    ${mapScript(tour)}

    <!-- Basic tour info — no personal details -->
    <div class="section">
      <div class="section-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        Tour-Informationen
      </div>
      <div class="info-row"><span class="key">Aktivität</span><span class="val">${ACTIVITY_LABELS[tour.activity] ?? tour.activity}</span></div>
      ${tour.routeName ? `<div class="info-row"><span class="key">Route</span><span class="val">${tour.routeName}</span></div>` : ''}
      ${tour.distanceKm ? `<div class="info-row"><span class="key">Distanz</span><span class="val">${tour.distanceKm} km</span></div>` : ''}
      ${tour.elevationUp ? `<div class="info-row"><span class="key">Höhenmeter</span><span class="val">↑ ${tour.elevationUp} m</span></div>` : ''}
      <div class="info-row"><span class="key">Gestartet</span><span class="val">${fmt(tour.startedAt)}</span></div>
      <div class="info-row"><span class="key">Geplante Rückkehr</span><span class="val">${fmt(tour.eta)}</span></div>
    </div>

    <!-- Vehicle -->
    <div class="section">
      <div class="section-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        Fahrzeug am Parkplatz
      </div>
      <div class="info-row"><span class="key">Kennzeichen</span><span class="val">${vehicle.plate}</span></div>
      <div class="info-row"><span class="key">Fahrzeug</span><span class="val">${vehicle.make} ${vehicle.model}</span></div>
      <div class="info-row"><span class="key">Farbe</span><span class="val">${vehicle.color}</span></div>
      ${tour.parkingLocation ? `<div class="info-row"><span class="key">Parkplatz</span><span class="val">${tour.parkingLocation}</span></div>` : ''}
    </div>

    <!-- Details locked — datenschutz -->
    <div class="locked">
      <div class="locked-icon">🔒</div>
      <div class="locked-title">Persönliche Daten geschützt</div>
      <p>Name, Kontakte und medizinische Informationen werden nur bei einem Alarm-Status angezeigt.</p>
    </div>

    ${elevationSection(tour)}

    <footer>
      <div class="token">Secure Token: <span>${vehicle.qrToken?.slice(0,8).toUpperCase() ?? '—'}</span></div>
      <div class="legal">Authorized use only · All access is logged</div>
    </footer>
  </div>

`

  return shell(content)
    .replace('__MODE_BADGE__', '<div class="mode-badge badge-ok">● AKTIV</div>')
    .replace('__CONTENT__', content)
}

function renderAlarm(vehicle: any, tour: any) {
  const user = tour.user
  const overdueMs = tour.eta ? Date.now() - new Date(tour.eta).getTime() : 0
  const overdueH = Math.floor(overdueMs / 3600000)
  const overdueM = Math.floor((overdueMs % 3600000) / 60000)
  const overdueStr = overdueH > 0 ? `${overdueH}h ${overdueM}min` : `${overdueM} Minuten`

  const allergies = user.allergies ? user.allergies.split(',').map((a: string) => a.trim()).filter(Boolean) : []

  const content = `
  <div class="status-hero hero-alarm">
    <div class="status-label">SAFETY STATUS</div>
    <div class="status-title">ALARM — ÜBERFÄLLIG</div>
    <div class="status-sub">Person ist seit ${overdueStr} überfällig. Letzte Aktivität: ${fmt(tour.locationUpdatedAt ?? tour.startedAt)}.</div>
  </div>

  <!-- Emergency call buttons -->
  <div class="call-grid">
    <a class="call-btn call-btn-police" href="tel:117">
      <span class="call-icon">🚔</span>
      <span class="call-label">POLIZEI (117)</span>
    </a>
    <a class="call-btn call-btn-rega" href="tel:1414">
      <span class="call-icon">🚁</span>
      <span class="call-label">REGA (1414)</span>
    </a>
  </div>

  <div class="content">
    <!-- Map -->
    ${mapScript(tour)}

    <!-- Person -->
    <div class="section">
      <div class="section-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        Vermisste Person
      </div>
      <div class="person-card">
        <div class="person-avatar">👤</div>
        <div>
          <div class="person-label">Name</div>
          <div class="person-name">${user.name}</div>
          ${user.phone ? `<div class="person-sub"><a href="tel:${user.phone}" style="color:#2c694e;font-weight:700">${user.phone}</a></div>` : ''}
        </div>
      </div>
    </div>

    <!-- Tour -->
    <div class="section">
      <div class="section-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
        Tour-Details
      </div>
      <div class="info-row"><span class="key">Aktivität</span><span class="val">${ACTIVITY_LABELS[tour.activity] ?? tour.activity}</span></div>
      ${tour.routeName ? `<div class="info-row"><span class="key">Route</span><span class="val">${tour.routeName}</span></div>` : ''}
      ${tour.difficulty ? `<div class="info-row"><span class="key">Schwierigkeit</span><span class="val">${tour.difficulty}</span></div>` : ''}
      <div class="info-row"><span class="key">Personen</span><span class="val">${tour.persons ?? 1}</span></div>
      ${tour.distanceKm ? `<div class="info-row"><span class="key">Distanz</span><span class="val">${tour.distanceKm} km</span></div>` : ''}
      ${tour.elevationUp ? `<div class="info-row"><span class="key">Höhenmeter</span><span class="val">↑ ${tour.elevationUp} m</span></div>` : ''}
      <div class="info-row"><span class="key">Gestartet</span><span class="val">${fmt(tour.startedAt)}</span></div>
      <div class="info-row"><span class="key">Hätte zurück sein sollen</span><span class="val-red">${fmt(tour.eta)}</span></div>
    </div>

    <!-- Vehicle -->
    <div class="section">
      <div class="section-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        Fahrzeug am Parkplatz
      </div>
      <div class="vehicle-grid">
        <div class="vehicle-cell"><div class="key">Kennzeichen</div><div class="val">${vehicle.plate}</div></div>
        <div class="vehicle-cell"><div class="key">Fahrzeug</div><div class="val">${vehicle.make} ${vehicle.model}</div><div class="sub">${vehicle.color}</div></div>
      </div>
      ${tour.parkingLocation ? `<div class="info-row" style="padding:12px 16px"><span class="key">Parkplatz</span><span class="val">${tour.parkingLocation}</span></div>` : ''}
    </div>

    ${(user.bloodType || allergies.length > 0 || user.medications || user.medicalNotes) ? `
    <!-- Medical — only in alarm -->
    <div class="medical-section">
      <div class="medical-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ba1a1a" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        <span class="medical-title">Medizinische Daten</span>
      </div>
      ${user.bloodType ? `<div class="blood-type"><span class="blood-label">Blutgruppe</span><span class="blood-val">${user.bloodType}</span></div>` : ''}
      ${allergies.length > 0 ? `<div class="allergy-tags">${allergies.map((a: string) => `<span class="allergy-tag">${a}</span>`).join('')}</div>` : ''}
      ${user.medications ? `<div class="info-row"><span class="key">Medikamente</span><span class="val">${user.medications}</span></div>` : ''}
      ${user.medicalNotes ? `<div class="info-row"><span class="key">Hinweise</span><span class="val">${user.medicalNotes}</span></div>` : ''}
    </div>` : ''}

    <!-- Emergency Contacts -->
    ${user.emergencyContacts?.length > 0 ? `
    <div class="section">
      <div class="section-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12 19.79 19.79 0 0 1 1.95 3.36 2 2 0 0 1 3.92 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 5.99 5.99l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        Notfallkontakte
      </div>
      ${user.emergencyContacts.map((c: any, i: number) => `
        <div class="contact-row">
          <div>
            <div class="contact-name">${c.name} ${c.isPrimary ? '<span class="pill pill-primary">Primär</span>' : ''}</div>
            <div class="contact-sub">${c.relation ?? ''}</div>
          </div>
          <a class="call-circle ${i === 0 ? 'call-circle-primary' : 'call-circle-secondary'}" href="tel:${c.phone}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="${i === 0 ? '#006838' : '#434841'}" stroke="none"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12 19.79 19.79 0 0 1 1.95 3.36 2 2 0 0 1 3.92 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 5.99 5.99l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          </a>
        </div>
      `).join('')}
    </div>` : ''}

    ${trackingLogSection(tour)}
    ${tour.notes ? `
    <div class="section">
      <div class="section-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        Notizen für Rettungskräfte
      </div>
      <div class="notes-body">${tour.notes.replace(/\n/g, '<br>')}</div>
    </div>` : ''}

    ${elevationSection(tour)}

    <footer>
      <div class="token">Secure Token: <span>${vehicle.qrToken?.slice(0,8).toUpperCase() ?? '—'}</span></div>
      <div class="legal">Authorized use only · All access is logged and tracked</div>
    </footer>
  </div>

  <div class="fab-wrap">
    <button class="fab-btn" onclick="alert('Suchstatus-Update: Diese Funktion ist verifizierten Einsatzkräften vorbehalten.')">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
      Suchstatus aktualisieren
    </button>
  </div>`

  return shell(content)
    .replace('__MODE_BADGE__', '<div class="mode-badge badge-alarm">⚠ EMERGENCY MODE</div>')
    .replace('__CONTENT__', content)
}

export default router