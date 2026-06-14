import express, { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = express.Router()

router.get('/debug/:token', async (req: Request, res: Response) => {
  const token = req.params['token'] as string
  const vehicle = await prisma.vehicle.findUnique({ where: { qrToken: token }, select: { id: true, plate: true, userId: true, qrToken: true } })
  if (!vehicle) return res.json({ error: 'Vehicle not found', token })
  const tours = await prisma.tour.findMany({ where: { userId: vehicle.userId }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, status: true, startedAt: true, eta: true, vehicleId: true, alarmStage: true } })
  return res.json({ vehicle, tours })
})

router.get('/:token', async (req: Request, res: Response) => {
  const token = req.params['token'] as string
  const vehicle = await prisma.vehicle.findUnique({
    where: { qrToken: token },
    select: { id: true, plate: true, make: true, model: true, color: true, qrToken: true, userId: true }
  })
  if (!vehicle) return res.status(404).send(renderNotFound())

  const tourInclude = {
    locations: { orderBy: { timestamp: 'desc' as const }, take: 500 },
    user: { include: { emergencyContacts: { orderBy: { isPrimary: 'desc' as const } } } }
  }

  let tour: any = await prisma.tour.findFirst({
    where: { vehicleId: vehicle.id, status: { in: ['ACTIVE', 'ALARM'] } },
    orderBy: { startedAt: 'desc' }, include: tourInclude
  })
  if (!tour) {
    tour = await prisma.tour.findFirst({
      where: { userId: vehicle.userId, status: { in: ['ACTIVE', 'ALARM'] } },
      orderBy: { startedAt: 'desc' }, include: tourInclude
    })
  }

  if (!tour) return res.send(renderPage('green', vehicle, null))
  if (tour.status === 'ALARM') return res.send(renderPage('alarm', vehicle, tour))
  const etaMs = tour.eta ? new Date(tour.eta).getTime() : null
  if (!etaMs || etaMs > Date.now()) return res.send(renderPage('active', vehicle, tour))
  return res.send(renderPage('alarm', vehicle, tour))
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: any) {
  if (!d) return '—'
  return new Date(d).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtTime(d: any) {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
}
function esc(s: any) {
  if (!s) return ''
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// Echtes Schweizer Kennzeichen: weiss, schwarzer Rand, CH links weiss auf rot
function plate(text: string) {
  return `<div style="display:inline-flex;align-items:stretch;border:2px solid #333;border-radius:4px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.2);">
    <div style="background:#D52B1E;width:28px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3px 2px;gap:1px;">
      <span style="color:#fff;font-size:8px;font-weight:900;line-height:1;">CH</span>
      <div style="background:#fff;border-radius:1px;padding:1px 2px;"><span style="font-size:9px;font-weight:900;color:#D52B1E;line-height:1;">+</span></div>
    </div>
    <div style="background:#fff;padding:5px 12px;display:flex;align-items:center;">
      <span style="font-size:17px;font-weight:900;letter-spacing:2.5px;color:#111;font-family:'Arial Narrow','Arial',sans-serif;">${esc(text)}</span>
    </div>
  </div>`
}

function renderNotFound() {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Trailtag</title></head>
<body style="font-family:sans-serif;padding:40px;text-align:center;background:#f8f9fa">
<h2 style="color:#ba1a1a">❌ QR-Code nicht gefunden</h2>
<p style="margin-top:12px;color:#747871">Dieser QR-Code ist nicht registriert.</p>
</body></html>`
}

function renderPage(state: 'green' | 'active' | 'alarm', vehicle: any, tour: any) {
  const isAlarm = state === 'alarm'
  const isActive = state === 'active'

  const user = tour?.user ?? null
  const contacts: any[] = user?.emergencyContacts ?? []
  const locations: any[] = tour?.locations ?? [] // newest first
  const lastLoc = locations[0] ?? null

  const etaMs = tour?.eta ? new Date(tour.eta).getTime() : null
  const nowMs = Date.now()
  const minsOverdue = (isAlarm && etaMs) ? Math.floor((nowMs - etaMs) / 60000) : null

  const statusBg = isAlarm ? '#ba1a1a' : '#2c694e'
  const statusLabel = isAlarm ? 'ALARM — ÜBERFÄLLIG' : isActive ? 'TOUR AKTIV' : 'KEIN ALARM'
  const statusSub = isAlarm
    ? (minsOverdue !== null ? `Wanderer ${minsOverdue} Minuten überfällig. Letztes GPS-Update: ${fmt(lastLoc?.timestamp)}.` : 'Tour ist überfällig.')
    : isActive ? `Aktive Tour · Geplante Rückkehr: ${fmtTime(tour?.eta)}`
    : 'Kein aktiver Wanderer an diesem Fahrzeug.'

  // ── ALARM: Notruf-Buttons ──────────────────────────────────────────────────
  const emergencyBtns = isAlarm ? `
  <section style="padding:12px 16px 4px;">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      <a href="tel:117" style="display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff;border:2.5px solid #ba1a1a;color:#ba1a1a;padding:18px 12px;border-radius:12px;text-decoration:none;font-weight:800;font-size:16px;gap:6px;">
        🚔<span style="font-size:14px;">Polizei 117</span>
      </a>
      <a href="tel:1414" style="display:flex;flex-direction:column;align-items:center;justify-content:center;background:#ba1a1a;color:#fff;padding:18px 12px;border-radius:12px;text-decoration:none;font-weight:800;font-size:16px;gap:6px;box-shadow:0 0 0 0 rgba(186,26,26,0.5);animation:pulse 2s infinite;">
        🚁<span style="font-size:14px;">REGA 1414</span>
      </a>
    </div>
  </section>` : ''

  // ── ALARM: Überfällig-Banner ───────────────────────────────────────────────
  const overdueBanner = isAlarm && minsOverdue !== null ? `
  <div style="background:#fff3cd;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin:12px 16px 0;font-size:13px;">
    ⏱ Geplante Rückkehr war vor <strong>${minsOverdue} Minuten</strong> (${fmtTime(tour?.eta)})
  </div>` : ''

  // ── ALARM+AKTIV: Notfallkontakte ──────────────────────────────────────────
  const contactsSection = contacts.length > 0 ? `
  <section style="padding:12px 16px 0;">
    <div style="background:#fff;border-radius:10px;border:1px solid #e1e3e4;overflow:hidden;">
      <div style="padding:12px 16px;border-bottom:1px solid #e1e3e4;display:flex;align-items:center;gap:8px;">
        <span>📞</span>
        <span style="font-size:15px;font-weight:700;color:#061907;">Notfallkontakte</span>
      </div>
      <div>
        ${contacts.map((c: any) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #f3f4f5;">
          <div>
            <p style="font-size:15px;font-weight:700;color:#061907;">${esc(c.name)}${c.isPrimary ? '&nbsp;<span style="font-size:10px;background:#aeeecb;color:#005227;padding:2px 7px;border-radius:100px;font-weight:700;vertical-align:middle;">Primär</span>' : ''}</p>
            ${c.relation ? `<p style="font-size:13px;color:#747871;margin-top:2px;">${esc(c.relation)}</p>` : ''}
          </div>
          <a href="tel:${esc(c.phone)}" style="min-width:44px;height:44px;background:${c.isPrimary ? '#aeeecb' : '#f3f4f5'};border-radius:50%;display:flex;align-items:center;justify-content:center;text-decoration:none;font-size:20px;flex-shrink:0;">📞</a>
        </div>`).join('')}
      </div>
    </div>
  </section>` : ''

  // ── ALARM: GPS Standort + Karte ───────────────────────────────────────────
  // Immer zeigen wenn ALARM, auch ohne GPS-Punkte (dann Hinweis)
  const locationSection = isAlarm ? `
  <section style="padding:12px 16px 0;">
    <div style="background:#fff;border-radius:10px;border:1px solid #e1e3e4;overflow:hidden;">
      <div style="padding:12px 16px;border-bottom:1px solid #e1e3e4;display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span>📍</span>
          <span style="font-size:15px;font-weight:700;">Letzter bekannter Standort</span>
        </div>
        ${lastLoc ? `<span style="font-size:11px;color:#747871;font-family:monospace;">${lastLoc.lat.toFixed(5)}° N, ${lastLoc.lng.toFixed(5)}° E</span>` : ''}
      </div>
      ${lastLoc ? `
      <!-- Karte via OpenStreetMap Static -->
      <div style="position:relative;">
        <a href="https://maps.google.com/?q=${lastLoc.lat},${lastLoc.lng}" target="_blank">
          <img src="https://staticmap.openstreetmap.de/staticmap.php?center=${lastLoc.lat},${lastLoc.lng}&zoom=14&size=600x240&markers=${lastLoc.lat},${lastLoc.lng},red"
            style="width:100%;display:block;height:220px;object-fit:cover;"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
            alt="Karte"/>
          <div style="display:none;height:180px;background:#f3f4f5;align-items:center;justify-content:center;flex-direction:column;gap:8px;">
            <span style="font-size:32px;">🗺️</span>
            <span style="font-size:13px;color:#747871;">Karte in Google Maps öffnen</span>
          </div>
        </a>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:28px;height:28px;background:#ba1a1a;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);pointer-events:none;"></div>
      </div>
      <div style="padding:14px 16px;">
        <p style="font-size:13px;color:#434841;margin-bottom:12px;"><strong>Aufgezeichnet:</strong> ${fmt(lastLoc.timestamp)}</p>
        <a href="https://maps.google.com/?q=${lastLoc.lat},${lastLoc.lng}" target="_blank"
           style="display:inline-block;background:#061907;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin-bottom:${locations.length > 1 ? '12px' : '0'};">
          In Google Maps öffnen ↗
        </a>
        ${locations.length > 1 ? `
        <details>
          <summary style="font-size:13px;font-weight:700;color:#2c694e;cursor:pointer;list-style:none;margin-top:0;">
            ▼ Alle ${locations.length} GPS-Punkte anzeigen
          </summary>
          <div style="margin-top:10px;max-height:240px;overflow-y:auto;border:1px solid #e1e3e4;border-radius:8px;">
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
              <thead><tr style="background:#f3f4f5;position:sticky;top:0;">
                <th style="padding:8px 10px;text-align:left;font-weight:700;color:#747871;">#</th>
                <th style="padding:8px 10px;text-align:left;font-weight:700;color:#747871;">ZEIT</th>
                <th style="padding:8px 10px;text-align:left;font-weight:700;color:#747871;">KOORDINATEN</th>
                <th style="padding:8px 10px;text-align:right;font-weight:700;color:#747871;">HÖHE</th>
              </tr></thead>
              <tbody>
                ${locations.map((l: any, i: number) => `
                <tr style="border-top:1px solid #f3f4f5;${i===0?'background:#fff8f0;':''}">
                  <td style="padding:7px 10px;color:#c3c8bf;font-size:11px;">${locations.length - i}</td>
                  <td style="padding:7px 10px;color:#434841;">${fmtTime(l.timestamp)}</td>
                  <td style="padding:7px 10px;font-family:monospace;color:#061907;">${l.lat.toFixed(5)}, ${l.lng.toFixed(5)}</td>
                  <td style="padding:7px 10px;text-align:right;color:#747871;">${l.ele != null ? Math.round(l.ele) + ' m' : '—'}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </details>` : ''}
      </div>` : `
      <div style="padding:20px 16px;text-align:center;color:#747871;">
        <p style="font-size:14px;">⚠️ Noch keine GPS-Daten verfügbar</p>
        <p style="font-size:12px;margin-top:4px;">Tracking-Punkte werden alle 3–10 Minuten übermittelt</p>
      </div>`}
    </div>
  </section>` : ''

  // ── ALARM: Medizinische Daten ─────────────────────────────────────────────
  const medSection = isAlarm && user ? `
  <section style="padding:12px 16px 0;">
    <div style="background:#fff;border-radius:10px;border:1px solid #e1e3e4;border-left:5px solid #ba1a1a;overflow:hidden;">
      <div style="padding:12px 16px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #e1e3e4;">
        <span>🏥</span>
        <span style="font-size:15px;font-weight:800;color:#ba1a1a;text-transform:uppercase;letter-spacing:0.5px;">Medizinische Daten</span>
      </div>
      <div style="padding:14px 16px;">
        ${user.bloodType ? `
        <div style="background:#f8f9fa;padding:10px 14px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <span style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;">BLUTGRUPPE</span>
          <span style="font-size:22px;font-weight:900;color:#ba1a1a;">${esc(user.bloodType)}</span>
        </div>` : ''}
        ${user.allergies ? `
        <div style="margin-bottom:12px;">
          <p style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;margin-bottom:6px;">ALLERGIEN</p>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${user.allergies.split(',').map((a: string) => `<span style="background:#ffdad6;color:#93000a;padding:4px 12px;border-radius:100px;font-size:12px;font-weight:700;">${esc(a.trim())}</span>`).join('')}
          </div>
        </div>` : ''}
        ${user.medications ? `
        <div style="${user.medicalNotes ? 'margin-bottom:12px;' : ''}">
          <p style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;margin-bottom:4px;">MEDIKAMENTE</p>
          <p style="font-size:14px;line-height:1.5;color:#191c1d;">${esc(user.medications)}</p>
        </div>` : ''}
        ${user.medicalNotes ? `
        <div>
          <p style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;margin-bottom:4px;">WEITERE HINWEISE</p>
          <p style="font-size:14px;line-height:1.5;color:#191c1d;">${esc(user.medicalNotes)}</p>
        </div>` : ''}
        ${!user.bloodType && !user.allergies && !user.medications && !user.medicalNotes ? `
        <p style="font-size:13px;color:#747871;">Keine medizinischen Daten hinterlegt.</p>` : ''}
      </div>
    </div>
  </section>` : ''

  // ── ALARM+AKTIV: Person ───────────────────────────────────────────────────
  const personSection = (isAlarm || isActive) && user ? `
  <section style="padding:12px 16px 0;">
    <div style="background:#fff;border-radius:10px;border:1px solid #e1e3e4;overflow:hidden;">
      <div style="padding:12px 16px;border-bottom:1px solid #e1e3e4;">
        <span style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;">${isAlarm ? 'VERMISSTE PERSON' : 'WANDERER'}</span>
      </div>
      <div style="padding:4px 0;">
        ${user.name ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid #f3f4f5;"><span style="color:#747871;font-size:13px;">Name</span><span style="font-size:14px;font-weight:700;">${esc(user.name)}</span></div>` : ''}
        ${user.birthYear ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid #f3f4f5;"><span style="color:#747871;font-size:13px;">Jahrgang</span><span style="font-size:14px;font-weight:700;">${esc(user.birthYear)}</span></div>` : ''}
        ${user.phone ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;"><span style="color:#747871;font-size:13px;">Telefon</span><a href="tel:${esc(user.phone)}" style="font-size:14px;font-weight:700;color:#2c694e;">${esc(user.phone)}</a></div>` : ''}
      </div>
    </div>
  </section>` : ''

  // ── Fahrzeug ──────────────────────────────────────────────────────────────
  const vehicleSection = `
  <section style="padding:12px 16px 0;">
    <div style="background:#fff;border-radius:10px;border:1px solid #e1e3e4;overflow:hidden;">
      <div style="padding:12px 16px;border-bottom:1px solid #e1e3e4;">
        <span style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;">FAHRZEUG AM PARKPLATZ</span>
      </div>
      <div style="padding:14px 16px;display:flex;align-items:center;gap:16px;">
        ${plate(vehicle.plate)}
        <div>
          ${vehicle.make ? `<p style="font-size:15px;font-weight:700;color:#061907;">${esc(vehicle.make)}${vehicle.model ? ' ' + esc(vehicle.model) : ''}</p>` : ''}
          ${vehicle.color ? `<p style="font-size:13px;color:#747871;margin-top:2px;">${esc(vehicle.color)}</p>` : ''}
        </div>
      </div>
    </div>
  </section>`

  // ── Tour-Info ─────────────────────────────────────────────────────────────
  const tourSection = tour ? `
  <section style="padding:12px 16px 0;">
    <div style="background:#fff;border-radius:10px;border:1px solid #e1e3e4;overflow:hidden;">
      <div style="padding:12px 16px;border-bottom:1px solid #e1e3e4;">
        <span style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;">TOUR</span>
      </div>
      <div style="padding:4px 0;">
        <div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #f3f4f5;"><span style="color:#747871;font-size:13px;">Gestartet</span><span style="font-size:13px;font-weight:700;">${fmt(tour.startedAt)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #f3f4f5;"><span style="color:#747871;font-size:13px;">Geplante Rückkehr</span><span style="font-size:13px;font-weight:700;${isAlarm ? 'color:#ba1a1a;' : ''}">${fmtTime(tour.eta)}</span></div>
        ${tour.activity ? `<div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #f3f4f5;"><span style="color:#747871;font-size:13px;">Aktivität</span><span style="font-size:13px;font-weight:700;">${esc(tour.activity)}</span></div>` : ''}
        ${tour.difficulty ? `<div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #f3f4f5;"><span style="color:#747871;font-size:13px;">Schwierigkeit</span><span style="font-size:13px;font-weight:700;">${esc(tour.difficulty)}</span></div>` : ''}
        ${tour.persons > 1 ? `<div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #f3f4f5;"><span style="color:#747871;font-size:13px;">Personen</span><span style="font-size:13px;font-weight:700;">${tour.persons} Personen</span></div>` : ''}
        ${tour.notes ? `<div style="padding:10px 16px;"><span style="color:#747871;font-size:13px;display:block;margin-bottom:4px;">Notizen für Rettungskräfte</span><span style="font-size:13px;color:#191c1d;line-height:1.6;display:block;">${esc(tour.notes)}</span></div>` : ''}
      </div>
    </div>
  </section>` : ''

  // ── Reihenfolge: ALARM vs AKTIV ───────────────────────────────────────────
  // ALARM: Notruf → Überfällig → GPS+Karte → Person → Medizin → Notfallkontakte → Fahrzeug → Tour
  // AKTIV: Notfallkontakte → Fahrzeug → Tour → Person (minimal)
  const bodyContent = isAlarm
    ? `${emergencyBtns}${overdueBanner}${locationSection}${personSection}${medSection}${contactsSection}${vehicleSection}${tourSection}`
    : isActive
    ? `${contactsSection}${vehicleSection}${tourSection}${personSection}`
    : `${vehicleSection}`

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>Trailtag – Ersthelfer-Portal</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;color:#191c1d;}
    @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(186,26,26,0.5);}70%{box-shadow:0 0 0 12px rgba(186,26,26,0);}}
    details>summary{list-style:none;-webkit-appearance:none;}
    details>summary::-webkit-details-marker{display:none;}
    a:active{opacity:0.75;}
  </style>
</head>
<body>

<header style="background:#fff;position:sticky;top:0;z-index:50;border-bottom:1px solid #e1e3e4;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
  <div style="display:flex;justify-content:space-between;align-items:center;padding:0 16px;height:52px;max-width:600px;margin:0 auto;">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:18px;">🏔</span>
      <span style="font-size:17px;font-weight:800;color:#061907;">Trailtag</span>
    </div>
    ${isAlarm
      ? `<div style="display:flex;align-items:center;gap:5px;background:#ffdad6;color:#ba1a1a;padding:5px 12px;border-radius:100px;animation:pulse 2s infinite;"><span style="font-size:13px;">⚠️</span><span style="font-size:11px;font-weight:800;letter-spacing:0.5px;">NOTFALL</span></div>`
      : isActive
      ? `<div style="display:flex;align-items:center;gap:5px;background:#aeeecb;color:#005227;padding:5px 12px;border-radius:100px;"><span style="font-size:13px;">✅</span><span style="font-size:11px;font-weight:800;letter-spacing:0.5px;">AKTIV</span></div>`
      : `<div style="display:flex;align-items:center;gap:5px;background:#aeeecb;color:#005227;padding:5px 12px;border-radius:100px;"><span style="font-size:13px;">✅</span><span style="font-size:11px;font-weight:800;letter-spacing:0.5px;">OK</span></div>`}
  </div>
</header>

<div style="background:${statusBg};color:#fff;padding:20px 16px 24px;position:relative;overflow:hidden;">
  <div style="max-width:600px;margin:0 auto;position:relative;z-index:1;">
    <p style="font-size:10px;font-weight:700;opacity:0.75;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Safety Status</p>
    <h1 style="font-size:26px;font-weight:800;letter-spacing:-0.5px;margin-bottom:8px;">${statusLabel}</h1>
    <p style="font-size:14px;opacity:0.9;line-height:1.4;">${statusSub}</p>
  </div>
  <div style="position:absolute;right:-16px;bottom:-16px;opacity:0.1;font-size:110px;line-height:1;">${isAlarm ? '🚨' : '⛰'}</div>
</div>

<div style="max-width:600px;margin:0 auto;padding-bottom:40px;">
  ${bodyContent}
</div>

<footer style="text-align:center;padding:16px;color:#747871;font-size:11px;border-top:1px solid #e1e3e4;background:#f8f9fa;max-width:600px;margin:0 auto;">
  Zuletzt aktualisiert: ${new Date().toLocaleTimeString('de-CH')} · Automatische Aktualisierung alle 30 Sekunden
</footer>

<script>setTimeout(()=>location.reload(),30000)</script>
</body>
</html>`
}

export default router