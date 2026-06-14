import express, { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = express.Router()

// Debug endpoint
router.get('/debug/:token', async (req: Request, res: Response) => {
  const token = req.params['token'] as string
  const vehicle = await prisma.vehicle.findUnique({ where: { qrToken: token }, select: { id: true, plate: true, userId: true, qrToken: true } })
  if (!vehicle) return res.json({ error: 'Vehicle not found', token })
  const tours = await prisma.tour.findMany({ where: { userId: vehicle.userId }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, status: true, startedAt: true, eta: true, vehicleId: true, alarmStage: true } })
  return res.json({ vehicle, tours })
})

// Main portal
router.get('/:token', async (req: Request, res: Response) => {
  const token = req.params['token'] as string

  const vehicle = await prisma.vehicle.findUnique({
    where: { qrToken: token },
    select: { id: true, plate: true, make: true, model: true, color: true, qrToken: true, userId: true }
  })
  if (!vehicle) return res.status(404).send(renderPage('notfound', null, null))

  const tourInclude = {
    locations: { orderBy: { timestamp: 'asc' as const }, take: 200 },
    user: { include: { emergencyContacts: { orderBy: { isPrimary: 'desc' as const } } } }
  }

  // Find most recent ACTIVE or ALARM tour — prefer vehicleId match
  let tour: any = await prisma.tour.findFirst({
    where: { vehicleId: vehicle.id, status: { in: ['ACTIVE', 'ALARM'] } },
    orderBy: { startedAt: 'desc' },
    include: tourInclude
  })
  if (!tour) {
    tour = await prisma.tour.findFirst({
      where: { userId: vehicle.userId, status: { in: ['ACTIVE', 'ALARM'] } },
      orderBy: { startedAt: 'desc' },
      include: tourInclude
    })
  }

  // No active tour -> green
  if (!tour) return res.send(renderPage('green', vehicle, null))

  // ALARM status set by alarm engine -> always show alarm
  if (tour.status === 'ALARM') return res.send(renderPage('alarm', vehicle, tour))

  // ACTIVE tour: check ETA
  const etaMs = tour.eta ? new Date(tour.eta).getTime() : null
  const nowMs = Date.now()

  // No ETA or ETA in future -> active (green)
  if (!etaMs || etaMs > nowMs) return res.send(renderPage('active', vehicle, tour))

  // ETA passed -> ALARM
  // (The alarm engine will also set status=ALARM, but portal should show it immediately)
  return res.send(renderPage('alarm', vehicle, tour))
})

// ── Helpers ─────────────────────────────────────────────

function fmt(d: any) {
  if (!d) return '—'
  return new Date(d).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtTime(d: any) {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
}

function renderPage(state: string, vehicle: any, tour: any): string {
  if (state === 'notfound') return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;text-align:center"><h2>❌ QR-Code nicht gefunden</h2><p>Dieser QR-Code ist nicht registriert.</p></body></html>`

  const isAlarm = state === 'alarm'
  const isActive = state === 'active'

  const statusColor = isAlarm ? '#ba1a1a' : isActive ? '#2c694e' : '#2c694e'
  const statusBg = isAlarm ? '#ffdad6' : isActive ? '#aeeecb' : '#aeeecb'
  const statusText = isAlarm ? '🚨 ALARM — Überfällig' : isActive ? '✅ Tour aktiv' : '✅ Kein Alarm'

  const user = tour?.user
  const contacts = user?.emergencyContacts ?? []
  const locations = tour?.locations ?? []
  const lastLoc = locations[locations.length - 1]

  const etaMs = tour?.eta ? new Date(tour.eta).getTime() : null
  const nowMs = Date.now()
  const minsOverdue = etaMs ? Math.floor((nowMs - etaMs) / 60000) : null

  const locationBlock = (isAlarm && lastLoc) ? `
    <div class="card">
      <h3>📍 Letzter bekannter Standort</h3>
      <p><strong>${lastLoc.lat.toFixed(5)}, ${lastLoc.lng.toFixed(5)}</strong></p>
      <p style="color:#747871">Aufgezeichnet: ${fmt(lastLoc.timestamp)}</p>
      <a href="https://maps.google.com/?q=${lastLoc.lat},${lastLoc.lng}" target="_blank" class="btn">In Google Maps öffnen</a>
    </div>` : ''

  const contactsBlock = contacts.length > 0 ? `
    <div class="card">
      <h3>📞 Notfallkontakte</h3>
      ${contacts.map((c: any) => `
        <div class="contact-row">
          <div>
            <strong>${c.name}</strong>${c.isPrimary ? ' ⭐' : ''}
            ${c.relation ? `<br><span style="color:#747871">${c.relation}</span>` : ''}
          </div>
          <a href="tel:${c.phone}" class="btn-call">${c.phone}</a>
        </div>`).join('')}
    </div>` : ''

  const medBlock = (isAlarm && user) ? `
    <div class="card">
      <h3>🏥 Medizinische Informationen</h3>
      ${user.bloodType ? `<p><strong>Blutgruppe:</strong> ${user.bloodType}</p>` : ''}
      ${user.allergies ? `<p><strong>Allergien:</strong> ${user.allergies}</p>` : ''}
      ${user.medications ? `<p><strong>Medikamente:</strong> ${user.medications}</p>` : ''}
      ${user.medicalNotes ? `<p><strong>Hinweise:</strong> ${user.medicalNotes}</p>` : ''}
      ${!user.bloodType && !user.allergies && !user.medications && !user.medicalNotes ? '<p style="color:#747871">Keine medizinischen Daten hinterlegt</p>' : ''}
    </div>` : ''

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trailtag Ersthelfer-Portal</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8f9fa; color: #191c1d; }
    .header { background: #061907; color: white; padding: 20px; text-align: center; }
    .header h1 { font-size: 22px; font-weight: 800; }
    .header p { font-size: 13px; opacity: 0.7; margin-top: 4px; }
    .status-banner { background: ${statusBg}; color: ${statusColor}; padding: 16px 20px; text-align: center; font-weight: 800; font-size: 17px; border-bottom: 2px solid ${statusColor}; }
    .container { max-width: 600px; margin: 0 auto; padding: 16px; }
    .card { background: white; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e1e3e4; }
    .card h3 { font-size: 14px; font-weight: 700; color: #747871; letter-spacing: 0.5px; margin-bottom: 12px; }
    .card p { font-size: 14px; line-height: 1.5; margin-bottom: 6px; }
    .vehicle-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f3f4f5; }
    .vehicle-row:last-child { border-bottom: none; }
    .label { font-size: 11px; color: #747871; font-weight: 600; }
    .value { font-size: 14px; font-weight: 700; }
    .plate { background: #fff9c4; border: 2px solid #f59e0b; border-radius: 4px; padding: 4px 12px; font-size: 16px; font-weight: 900; letter-spacing: 2px; }
    .contact-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f3f4f5; }
    .contact-row:last-child { border-bottom: none; }
    .btn-call { background: #2c694e; color: white; padding: 8px 14px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 13px; }
    .btn { display: inline-block; background: #061907; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 700; margin-top: 8px; }
    .emergency-btns { display: flex; gap: 10px; margin-top: 4px; }
    .btn-police { background: #1d4ed8; color: white; flex: 1; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: 800; font-size: 16px; }
    .btn-rega { background: #ba1a1a; color: white; flex: 1; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: 800; font-size: 16px; }
    .overdue-info { background: #fff3cd; border: 1px solid #f59e0b; border-radius: 6px; padding: 12px; margin-bottom: 12px; font-size: 13px; }
    .refresh { text-align: center; color: #747871; font-size: 11px; margin-top: 16px; padding-bottom: 32px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🏔 Trailtag</h1>
    <p>Ersthelfer-Portal</p>
  </div>

  <div class="status-banner">${statusText}</div>

  <div class="container">

    ${isAlarm && minsOverdue !== null ? `
    <div class="overdue-info">
      ⏱ Geplante Rückkehr war vor <strong>${minsOverdue} Minuten</strong> (${fmtTime(tour?.eta)})
    </div>` : ''}

    ${isAlarm ? `
    <div class="card">
      <h3>NOTRUF</h3>
      <div class="emergency-btns">
        <a href="tel:117" class="btn-police">🚔 Polizei 117</a>
        <a href="tel:1414" class="btn-rega">🚁 REGA 1414</a>
      </div>
    </div>` : ''}

    <div class="card">
      <h3>FAHRZEUG</h3>
      <div class="vehicle-row">
        <span class="label">KENNZEICHEN</span>
        <span class="plate">${vehicle?.plate ?? '—'}</span>
      </div>
      ${vehicle?.make ? `<div class="vehicle-row"><span class="label">FAHRZEUG</span><span class="value">${vehicle.make} ${vehicle.model ?? ''}</span></div>` : ''}
      ${vehicle?.color ? `<div class="vehicle-row"><span class="label">FARBE</span><span class="value">${vehicle.color}</span></div>` : ''}
    </div>

    ${tour ? `
    <div class="card">
      <h3>TOUR</h3>
      <div class="vehicle-row"><span class="label">GESTARTET</span><span class="value">${fmt(tour.startedAt)}</span></div>
      <div class="vehicle-row"><span class="label">GEPLANTE RÜCKKEHR</span><span class="value">${fmtTime(tour.eta)}</span></div>
      ${tour.activity ? `<div class="vehicle-row"><span class="label">AKTIVITÄT</span><span class="value">${tour.activity}</span></div>` : ''}
      ${tour.difficulty ? `<div class="vehicle-row"><span class="label">SCHWIERIGKEIT</span><span class="value">${tour.difficulty}</span></div>` : ''}
      ${tour.notes ? `<div class="vehicle-row" style="flex-direction:column;align-items:flex-start;gap:4px"><span class="label">NOTIZEN</span><span style="font-size:14px">${tour.notes}</span></div>` : ''}
    </div>` : ''}

    ${locationBlock}
    ${contactsBlock}
    ${medBlock}

    ${isActive && user ? `
    <div class="card">
      <h3>WANDERER</h3>
      ${user.name ? `<div class="vehicle-row"><span class="label">NAME</span><span class="value">${user.name}</span></div>` : ''}
      ${user.phone ? `<div class="vehicle-row"><span class="label">TELEFON</span><a href="tel:${user.phone}" style="font-weight:700">${user.phone}</a></div>` : ''}
      ${user.birthYear ? `<div class="vehicle-row"><span class="label">JAHRGANG</span><span class="value">${user.birthYear}</span></div>` : ''}
    </div>
    ${contactsBlock}` : ''}

  </div>

  <div class="refresh">
    Zuletzt aktualisiert: ${new Date().toLocaleTimeString('de-CH')} · Seite alle 30s automatisch aktualisiert
  </div>

  <script>setTimeout(() => location.reload(), 30000)</script>
</body>
</html>`
}

export default router