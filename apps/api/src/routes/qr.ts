import express, { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = express.Router()

router.get('/:token', async (req: Request, res: Response) => {

const vehicle = await prisma.vehicle.findUnique({
  where: { qrToken: token },
  include: {
    tours: {
      where: { 
        status: { in: ['ACTIVE', 'ALARM'] },
      },
      orderBy: { startedAt: 'desc' },
      take: 1,
      include: {
        locations: { orderBy: { timestamp: 'asc' } },
        user: {
          include: {
            emergencyContacts: { orderBy: { isPrimary: 'desc' } }
          }
        }
      }
    }
  }
})


  if (!vehicle) {
    return res.status(404).send(renderNotFound())
  }

  const activeTour = vehicle.tours[0]

  // Tour ist veraltet wenn sie älter als 24h ist
  const isStale = activeTour &&
    activeTour.startedAt &&
    new Date(activeTour.startedAt).getTime() < Date.now() - 24 * 60 * 60 * 1000

  if (!activeTour || isStale) {
    return res.send(renderGreen(vehicle))
  }

  if (activeTour.status === 'ACTIVE') {
    return res.send(renderGreen(vehicle, activeTour))
  }

  return res.send(renderRed(vehicle, activeTour))
})

function formatDate(d: Date | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleString('de-CH', { timeZone: 'Europe/Zurich' })
}

function mapSection(tour: any) {
  if (!tour?.startLat || !tour?.startLng) return ''

  const lat = tour.lastLat ?? tour.startLat
  const lng = tour.lastLng ?? tour.startLng

  // Verlauf aus TourLocation Tabelle
  const trackPoints = tour.locations?.length > 0
    ? tour.locations.map((l: any) => [l.lat, l.lng])
    : tour.gpxTrack?.points?.length > 0
      ? tour.gpxTrack.points.map((p: any) => [p.lat, p.lng])
      : null

  const trackJs = trackPoints
    ? `var trackPoints = ${JSON.stringify(trackPoints)};`
    : 'var trackPoints = null;'

  return `
    <div class="card">
      <div class="card-title">📍 Letzter bekannter Standort</div>
      <div id="map" style="height:300px;border-radius:8px;overflow:hidden;"></div>
      <a class="maps-link" href="https://maps.google.com/?q=${lat},${lng}" target="_blank">
        🗺️ In Google Maps öffnen
      </a>
    ${tour.locationUpdatedAt ? (() => {
  const updatedAt = new Date(tour.locationUpdatedAt);
  const minutesAgo = Math.floor((Date.now() - updatedAt.getTime()) / 60000);
  const isStale = minutesAgo > 30;
  return `
    <div class="meta" style="${isStale ? 'color:#e67e22;font-weight:600' : ''}">
      ${isStale ? '⚠️' : '✅'} Standort aktualisiert: ${formatDate(tour.locationUpdatedAt)}
      ${isStale ? `(vor ${minutesAgo} Minuten — möglicherweise kein Signal)` : ''}
    </div>
  `;
})() : '<div class="meta" style="color:#e67e22">⚠️ Noch kein Standort-Update empfangen</div>'}
      ${tour.locations?.length > 0 ? `<div class="meta">${tour.locations.length} GPS-Punkte aufgezeichnet</div>` : ''}
    </div>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      ${trackJs}
      var map = L.map('map');
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO'
      }).addTo(map);

      if (trackPoints && trackPoints.length > 1) {
        var poly = L.polyline(trackPoints, {color:'#2D6A4F', weight:4, opacity:0.9}).addTo(map);
        L.circleMarker(trackPoints[0], {radius:8,fillColor:'#2D6A4F',color:'#fff',weight:2,fillOpacity:1}).bindPopup('🟢 Start').addTo(map);
        map.fitBounds(poly.getBounds(), {padding:[20,20]});
      } else {
        map.setView([${lat}, ${lng}], 13);
      }

      L.circleMarker([${lat}, ${lng}], {radius:10,fillColor:'#e63946',color:'#fff',weight:3,fillOpacity:1})
        .bindPopup('📍 Letzter Standort<br>${tour.locationUpdatedAt ? formatDate(tour.locationUpdatedAt) : ''}').addTo(map).openPopup();
    </script>
  `
}



function elevationSection(tour: any) {
  const points = tour?.gpxTrack?.points?.filter((p: any) => p.ele != null)
  if (!points || points.length === 0) return ''

  const eles = points.map((p: any) => p.ele)
  const minEle = Math.min(...eles)
  const maxEle = Math.max(...eles)
  const range = maxEle - minEle || 1
  const w = 800, h = 120, pad = 10

  const pts = points.map((p: any, i: number) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2)
    const y = h - pad - ((p.ele - minEle) / range) * (h - pad * 2)
    return `${x},${y}`
  }).join(' ')

  const area = `${pad},${h - pad} ${pts} ${w - pad},${h - pad}`

  return `
    <div class="card">
      <div class="card-title">📈 Höhenprofil</div>
      <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto">
        <defs>
          <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#2D6A4F" stop-opacity="0.4"/>
            <stop offset="100%" stop-color="#2D6A4F" stop-opacity="0.05"/>
          </linearGradient>
        </defs>
        <polygon points="${area}" fill="url(#eg)"/>
        <polyline points="${pts}" fill="none" stroke="#2D6A4F" stroke-width="2"/>
        <text x="${pad}" y="${pad + 12}" font-size="11" fill="#666">${Math.round(maxEle)} m</text>
        <text x="${pad}" y="${h - pad - 2}" font-size="11" fill="#666">${Math.round(minEle)} m</text>
      </svg>
    </div>
  `
}

function tourDetails(tour: any, vehicle: any) {
  const activityLabels: Record<string, string> = {
    WANDERN: '🥾 Wandern', BERGTOUR: '🏔️ Bergtour', KLETTERN: '🧗 Klettern',
    TRAILRUNNING: '🏃 Trailrunning', MOUNTAINBIKE: '🚵 Mountainbike',
    RADSPORT: '🚴 Radsport', SKI_SNOWBOARD: '🎿 Ski/Snowboard',
    SKITOUR: '⛷️ Skitour', KLETTERSTEIG: '🪝 Klettersteig',
    KANU_KAJAK: '🛶 Kanu/Kajak', PARAGLIDING: '🪂 Paragliding', ANDERE: '🏕️ Andere'
  }

  

  return `
    <div class="card">
      <div class="card-title">👤 Person</div>
      <div class="detail-row"><span>Name</span><strong>${tour.user.name}</strong></div>
      ${tour.user.phone ? `<div class="detail-row"><span>Telefon</span><a href="tel:${tour.user.phone}">${tour.user.phone}</a></div>` : ''}
    </div>

    <div class="card">
      <div class="card-title">🏔️ Tour</div>
      <div class="detail-row"><span>Aktivität</span><strong>${activityLabels[tour.activity] ?? tour.activity}</strong></div>
      ${tour.routeName ? `<div class="detail-row"><span>Route</span><strong>${tour.routeName}</strong></div>` : ''}
      ${tour.difficulty ? `<div class="detail-row"><span>Schwierigkeit</span><strong>${tour.difficulty}</strong></div>` : ''}
      <div class="detail-row"><span>Personen</span><strong>${tour.persons}</strong></div>
      ${tour.distanceKm ? `<div class="detail-row"><span>Distanz</span><strong>${tour.distanceKm} km</strong></div>` : ''}
      ${tour.elevationUp ? `<div class="detail-row"><span>Höhenmeter</span><strong>⬆️ ${tour.elevationUp} hm</strong></div>` : ''}
      <div class="detail-row"><span>Gestartet</span><strong>${formatDate(tour.startedAt)}</strong></div>
      <div class="detail-row"><span>Geplante Rückkehr</span><strong>${formatDate(tour.eta)}</strong></div>
    </div>

    <div class="card">
      <div class="card-title">🚗 Fahrzeug</div>
      <div class="detail-row"><span>Kennzeichen</span><strong>${vehicle.plate}</strong></div>
      <div class="detail-row"><span>Fahrzeug</span><strong>${vehicle.make} ${vehicle.model}</strong></div>
      <div class="detail-row"><span>Farbe</span><strong>${vehicle.color}</strong></div>
      ${tour.parkingLocation ? `<div class="detail-row"><span>Parkplatz</span><strong>${tour.parkingLocation}</strong></div>` : ''}
    </div>

    ${tour.notes ? `
    <div class="card">
      <div class="card-title">📋 Notizen für Rettungskräfte</div>
      <p style="margin:0;font-size:15px;line-height:1.6">${tour.notes}</p>
    </div>` : ''}

    ${tour.user.emergencyContacts?.length > 0 ? `
<div class="card">
  <div class="card-title">📞 Notfallkontakte</div>
  ${tour.user.emergencyContacts.map((c: any) => `
    <div class="detail-row">
      <span>${c.isPrimary ? '⭐ ' : ''}${c.name}${c.relation ? ` · ${c.relation}` : ''}</span>
      <a href="tel:${c.phone}" style="color:#e63946;font-weight:700">${c.phone}</a>
    </div>
  `).join('')}
</div>` : ''}

${(tour.user.bloodType || tour.user.allergies || tour.user.medications || tour.user.medicalNotes) ? `
<div class="card">
  <div class="card-title">🏥 Medizinische Informationen</div>
  ${tour.user.bloodType ? `<div class="detail-row"><span>Blutgruppe</span><strong style="color:#e63946">${tour.user.bloodType}</strong></div>` : ''}
  ${tour.user.allergies ? `<div class="detail-row"><span>Allergien</span><strong>${tour.user.allergies}</strong></div>` : ''}
  ${tour.user.medications ? `<div class="detail-row"><span>Medikamente</span><strong>${tour.user.medications}</strong></div>` : ''}
  ${tour.user.medicalNotes ? `<div class="detail-row"><span>Hinweise</span><strong>${tour.user.medicalNotes}</strong></div>` : ''}
</div>` : ''}
  `
}

function baseHtml(color: string, headerBg: string, badge: string, badgeColor: string, title: string, subtitle: string, body: string) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Trailtag — Erstretter Portal</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0f4f0; }
    .header { background: ${headerBg}; color: white; padding: 24px; }
    .header-top { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .logo { font-size: 28px; }
    .app-name { font-size: 20px; font-weight: 700; opacity: 0.9; }
    .badge { display: inline-block; background: ${badgeColor}; color: white; padding: 8px 16px; border-radius: 100px; font-size: 14px; font-weight: 700; margin-bottom: 12px; }
    .header h1 { font-size: 22px; font-weight: 800; margin-bottom: 4px; }
    .header p { font-size: 14px; opacity: 0.85; }
    .content { max-width: 640px; margin: 0 auto; padding: 20px 16px 40px; }
    .card { background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .card-title { font-size: 13px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
    .detail-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-row span { color: #666; }
    .detail-row a { color: #2D6A4F; font-weight: 600; }
    .maps-link { display: block; margin-top: 12px; color: #2D6A4F; font-weight: 600; font-size: 14px; }
    .meta { font-size: 12px; color: #999; margin-top: 8px; }
    .emergency { background: #fff5f5; border: 2px solid #fc8181; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
    .emergency h2 { color: #c53030; font-size: 18px; margin-bottom: 8px; }
    .emergency p { color: #742a2a; font-size: 14px; line-height: 1.6; }
    .call-btn { display: block; background: #E53E3E; color: white; text-align: center; padding: 16px; border-radius: 12px; font-size: 18px; font-weight: 800; text-decoration: none; margin-bottom: 16px; }
    .green-box { background: #f0fff4; border: 2px solid #68d391; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
    .green-box p { color: #276749; font-size: 15px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-top">
      <span class="logo">🏔️</span>
      <span class="app-name">Trailtag</span>
    </div>
    <div class="badge">${badge}</div>
    <h1>${title}</h1>
    <p>${subtitle}</p>
  </div>
  <div class="content">
    ${body}
  </div>
<script>
    setTimeout(() => location.reload(), 30000);
  </script>
</body>
</html>`
}

function renderGreen(vehicle: any, tour?: any) {
  const body = tour ? `
    <div class="green-box">
      <p>✅ Die Person ist planmässig unterwegs und sollte um <strong>${formatDate(tour.eta)}</strong> zurück sein.</p>
    </div>
    ${mapSection(tour)}
    ${tourDetails(tour, vehicle)}
    ${elevationSection(tour)}
  ` : `
    <div class="green-box">
      <p>✅ Dieses Fahrzeug ist registriert aber aktuell keine Tour aktiv.</p>
    </div>
    <div class="card">
      <div class="card-title">🚗 Fahrzeug</div>
      <div class="detail-row"><span>Kennzeichen</span><strong>${vehicle.plate}</strong></div>
      <div class="detail-row"><span>Fahrzeug</span><strong>${vehicle.make} ${vehicle.model}</strong></div>
    </div>
  `

  return baseHtml(
    'green', '#2D6A4F',
    '✅ ALLES IN ORDNUNG', 'rgba(255,255,255,0.3)',
    'Tour läuft planmässig',
    'Die Person ist unterwegs und der Safety-Timer ist aktiv.',
    body
  )
}

function renderRed(vehicle: any, tour: any) {
  const body = `
    <div class="emergency">
      <h2>⚠️ Person überfällig!</h2>
      <p>Die Person hätte um <strong>${formatDate(tour.eta)}</strong> zurück sein sollen und hat sich nicht abgemeldet.</p>
    </div>
    <a class="call-btn" href="tel:117">🚨 Polizei anrufen — 117</a>
    <a class="call-btn" href="tel:1414" style="background:#e67e22">🚁 Rega anrufen — 1414</a>
    ${mapSection(tour)}
    ${tourDetails(tour, vehicle)}
    ${elevationSection(tour)}
  `

  return baseHtml(
    'red', '#C53030',
    '🚨 ALARM', 'rgba(255,255,255,0.3)',
    'Person überfällig!',
    'Bitte sofort Rettungsdienst kontaktieren.',
    body
  )
}

function renderNotFound() {
  return baseHtml(
    'gray', '#4A5568',
    '❓ UNBEKANNT', 'rgba(255,255,255,0.3)',
    'QR-Code nicht gefunden',
    'Dieser QR-Code ist nicht in unserem System registriert.',
    '<div class="card"><p style="color:#666;font-size:15px">Der QR-Code konnte keinem Fahrzeug zugeordnet werden.</p></div>'
  )
}

export default router