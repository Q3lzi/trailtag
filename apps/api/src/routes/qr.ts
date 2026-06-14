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
  if (!vehicle) return res.status(404).send(html404())

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

  if (!tour) return res.send(renderGreen(vehicle))
  if (tour.status === 'ALARM') return res.send(renderAlarm(vehicle, tour))
  const etaMs = tour.eta ? new Date(tour.eta).getTime() : null
  if (!etaMs || etaMs > Date.now()) return res.send(renderActive(vehicle, tour))
  return res.send(renderAlarm(vehicle, tour))
})

// ── Utils ─────────────────────────────────────────────────────────────────────

function e(s: any) {
  if (s == null) return ''
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function fmt(d: any) {
  if (!d) return '—'
  return new Date(d).toLocaleString('de-CH', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
}
function fmtT(d: any) {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString('de-CH', { hour:'2-digit', minute:'2-digit' })
}

// Swiss plate: white bg, black border, red CH strip left
function plate(text: string) {
  return `<span style="display:inline-flex;align-items:center;border:1.5px solid #333;border-radius:3px;overflow:hidden;font-family:Arial,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.15);">
  <span style="background:#D52B1E;color:#fff;font-size:9px;font-weight:900;padding:3px 5px;display:flex;flex-direction:column;align-items:center;gap:1px;line-height:1;letter-spacing:.5px;">🇨🇭<br>CH</span>
  <span style="background:#fff;padding:4px 10px;font-size:15px;font-weight:900;letter-spacing:2px;color:#111;">${e(text)}</span>
</span>`
}

// Base HTML shell
function shell(head: string, body: string, isAlarm: boolean) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Trailtag – Ersthelfer-Portal</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Inter',system-ui,sans-serif;background:#f8f9fa;color:#191c1d;min-height:100dvh;}
.container{max-width:480px;margin:0 auto;}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(186,26,26,.6);}70%{box-shadow:0 0 0 14px rgba(186,26,26,0);}}
.pulse{animation:pulse 2s infinite;}
details summary{list-style:none;cursor:pointer;}
details summary::-webkit-details-marker{display:none;}
a{color:inherit;text-decoration:none;}
</style>
${head}
</head>
<body>
<header style="background:#fff;border-bottom:1px solid #e1e3e4;position:sticky;top:0;z-index:100;box-shadow:0 1px 4px rgba(0,0,0,.06);">
  <div class="container" style="display:flex;justify-content:space-between;align-items:center;padding:0 20px;height:52px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#061907" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>
      <span style="font-size:18px;font-weight:800;color:#061907;letter-spacing:-.5px;">Trailtag</span>
    </div>
    ${isAlarm
      ? `<span class="pulse" style="display:flex;align-items:center;gap:5px;background:#ffdad6;color:#ba1a1a;padding:5px 12px;border-radius:100px;font-size:11px;font-weight:800;letter-spacing:.5px;">⚠️ NOTFALL</span>`
      : `<span style="display:flex;align-items:center;gap:5px;background:#aeeecb;color:#005227;padding:5px 12px;border-radius:100px;font-size:11px;font-weight:800;letter-spacing:.5px;">✅ AKTIV</span>`
    }
  </div>
</header>
${body}
<footer style="text-align:center;padding:20px;color:#747871;font-size:11px;border-top:1px solid #e1e3e4;background:#f8f9fa;margin-top:8px;">
  Zuletzt aktualisiert: ${new Date().toLocaleTimeString('de-CH')} · Automatische Aktualisierung alle 30s
</footer>
<script>setTimeout(()=>location.reload(),30000)</script>
</body></html>`
}

// ── GREEN: no active tour ─────────────────────────────────────────────────────
function renderGreen(vehicle: any) {
  return shell('', `
<div style="background:#2c694e;color:#fff;padding:24px 20px 28px;position:relative;overflow:hidden;">
  <div class="container">
    <p style="font-size:10px;font-weight:700;opacity:.7;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Safety Status</p>
    <h1 style="font-size:26px;font-weight:800;margin-bottom:6px;">KEIN ALARM</h1>
    <p style="font-size:14px;opacity:.85;">Kein aktiver Wanderer an diesem Fahrzeug registriert.</p>
  </div>
  <div style="position:absolute;right:-10px;bottom:-10px;opacity:.08;font-size:120px;">⛰</div>
</div>
<div class="container" style="padding:16px 16px 32px;">
  <div style="background:#fff;border-radius:12px;border:1px solid #e1e3e4;overflow:hidden;">
    <div style="padding:12px 16px;border-bottom:1px solid #e1e3e4;"><span style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;">FAHRZEUG AM PARKPLATZ</span></div>
    <div style="padding:16px;display:flex;align-items:center;gap:16px;">
      ${plate(vehicle.plate)}
      <div>
        ${vehicle.make ? `<p style="font-size:15px;font-weight:700;color:#061907;">${e(vehicle.make)}${vehicle.model ? ' '+e(vehicle.model) : ''}</p>` : ''}
        ${vehicle.color ? `<p style="font-size:13px;color:#747871;margin-top:2px;">${e(vehicle.color)}</p>` : ''}
      </div>
    </div>
  </div>
</div>`, false)
}

// ── ACTIVE: tour running, privacy protected ────────────────────────────────────
function renderActive(vehicle: any, tour: any) {
  const user = tour.user
  return shell('', `
<div style="background:#2c694e;color:#fff;padding:24px 20px 28px;position:relative;overflow:hidden;">
  <div class="container">
    <p style="font-size:10px;font-weight:700;opacity:.7;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Safety Status</p>
    <h1 style="font-size:26px;font-weight:800;margin-bottom:6px;">TOUR AKTIV</h1>
    <p style="font-size:14px;opacity:.85;">Aktive Tour · Geplante Rückkehr: ${fmtT(tour.eta)}</p>
  </div>
  <div style="position:absolute;right:-10px;bottom:-10px;opacity:.08;font-size:120px;">⛰</div>
</div>

<div class="container" style="padding:16px;">

  <!-- Wanderer -->
  <div style="background:#fff;border-radius:12px;border:1px solid #e1e3e4;overflow:hidden;margin-bottom:12px;">
    <div style="padding:12px 16px;border-bottom:1px solid #e1e3e4;"><span style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;">WANDERER</span></div>
    <div style="padding:4px 0;">
      ${row('Name', user?.name ? e(user.name) : '—')}
      ${user?.birthYear ? row('Jahrgang', e(user.birthYear)) : ''}
    </div>
  </div>

  <!-- Tour -->
  <div style="background:#fff;border-radius:12px;border:1px solid #e1e3e4;overflow:hidden;margin-bottom:12px;">
    <div style="padding:12px 16px;border-bottom:1px solid #e1e3e4;"><span style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;">TOUR</span></div>
    <div style="padding:4px 0;">
      ${row('Gestartet', fmt(tour.startedAt))}
      ${row('Geplante Rückkehr', fmtT(tour.eta))}
      ${tour.activity ? row('Aktivität', e(tour.activity)) : ''}
      ${tour.difficulty ? row('Schwierigkeit', e(tour.difficulty)) : ''}
      ${tour.persons > 1 ? row('Personen', tour.persons + ' Personen') : ''}
    </div>
  </div>

  <!-- Fahrzeug -->
  <div style="background:#fff;border-radius:12px;border:1px solid #e1e3e4;overflow:hidden;margin-bottom:12px;">
    <div style="padding:12px 16px;border-bottom:1px solid #e1e3e4;"><span style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;">FAHRZEUG AM PARKPLATZ</span></div>
    <div style="padding:16px;display:flex;align-items:center;gap:16px;">
      ${plate(vehicle.plate)}
      <div>
        ${vehicle.make ? `<p style="font-size:15px;font-weight:700;color:#061907;">${e(vehicle.make)}${vehicle.model ? ' '+e(vehicle.model) : ''}</p>` : ''}
        ${vehicle.color ? `<p style="font-size:13px;color:#747871;margin-top:2px;">${e(vehicle.color)}</p>` : ''}
      </div>
    </div>
  </div>

</div>`, false)
}

// ── ALARM: full emergency view ────────────────────────────────────────────────
function renderAlarm(vehicle: any, tour: any) {
  const user = tour.user
  const contacts: any[] = user?.emergencyContacts ?? []
  const locs: any[] = tour?.locations ?? []
  const lastLoc = locs[0] ?? null
  const etaMs = tour?.eta ? new Date(tour.eta).getTime() : null
  const minsOver = etaMs ? Math.floor((Date.now() - etaMs) / 60000) : null

  return shell(`<style>.row{display:flex;justify-content:space-between;align-items:center;padding:11px 16px;border-bottom:1px solid #f3f4f5;font-size:14px;}.row:last-child{border-bottom:none;}.row .k{color:#747871;}.row .v{font-weight:700;color:#061907;text-align:right;}</style>`, `

<!-- STATUS HERO -->
<section style="background:#ba1a1a;color:#fff;padding:24px 20px 28px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.2);">
  <div class="container">
    <p style="font-size:10px;font-weight:700;opacity:.75;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Safety Status</p>
    <h1 style="font-size:28px;font-weight:800;letter-spacing:-.5px;margin-bottom:8px;">ALARM — ÜBERFÄLLIG</h1>
    <p style="font-size:14px;opacity:.9;line-height:1.5;">
      ${minsOver !== null ? `Wanderer ${minsOver} Minuten überfällig.` : 'Tour ist überfällig.'}<br>
      ${lastLoc ? `Letztes GPS-Update: ${fmt(lastLoc.timestamp)}.` : 'Noch kein GPS-Signal.'}
    </p>
  </div>
  <div style="position:absolute;right:-12px;bottom:-12px;opacity:.1;font-size:130px;line-height:1;">🚨</div>
</section>

<div class="container" style="padding:16px;">

  <!-- ÜBERÄLLIG BANNER -->
  ${minsOver !== null ? `
  <div style="background:#fff3cd;border:1px solid #f59e0b;border-radius:10px;padding:12px 16px;margin-bottom:12px;font-size:13px;display:flex;align-items:center;gap:8px;">
    <span style="font-size:16px;">⏱</span>
    <span>Geplante Rückkehr war vor <strong>${minsOver} Minuten</strong> (${fmtT(tour.eta)})</span>
  </div>` : ''}

  <!-- NOTRUF BUTTONS -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
    <a href="tel:117" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:#fff;border:2px solid #ba1a1a;color:#ba1a1a;padding:18px 12px;border-radius:14px;font-weight:800;font-size:15px;transition:opacity .15s;" ontouchstart="this.style.opacity='.7'" ontouchend="this.style.opacity='1'">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="#ba1a1a"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM9 11.5c0 1.38-.56 2.63-1.46 3.54L9 16.5H6v-3l1.46 1.46A3.48 3.48 0 0 0 8.5 11.5H9zm6 5H12v-1.5h1.5V13H12v-1.5h3V16.5z"/></svg>
      Polizei 117
    </a>
    <a href="tel:1414" class="pulse" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:#ba1a1a;color:#fff;padding:18px 12px;border-radius:14px;font-weight:800;font-size:15px;transition:opacity .15s;" ontouchstart="this.style.opacity='.7'" ontouchend="this.style.opacity='1'">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2a1.5 1.5 0 0 0-1.5 1.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>
      REGA 1414
    </a>
  </div>

  <!-- PERSON CARD: span full width like mockup -->
  <div style="background:#fff;border-radius:12px;border:1px solid #e1e3e4;overflow:hidden;margin-bottom:12px;">
    <div style="padding:14px 16px;display:flex;align-items:center;gap:14px;">
      <div style="width:64px;height:64px;border-radius:10px;background:#f3f4f5;border:1px solid #e1e3e4;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:28px;">🧗</div>
      <div>
        <p style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Vermisste Person</p>
        <h2 style="font-size:22px;font-weight:800;color:#061907;margin-bottom:2px;">${user?.name ? e(user.name) : '—'}</h2>
        <p style="font-size:14px;color:#434841;">
          ${user?.birthYear ? `Jg. ${e(user.birthYear)}` : ''}
          ${user?.phone ? `&nbsp;·&nbsp;<a href="tel:${e(user.phone)}" style="color:#2c694e;font-weight:700;">${e(user.phone)}</a>` : ''}
        </p>
      </div>
    </div>
  </div>

  <!-- 2-COL BENTO: Fahrzeug + Tour -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
    <div style="background:#fff;border-radius:12px;border:1px solid #e1e3e4;padding:14px;">
      <p style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Fahrzeug</p>
      ${vehicle.make ? `<p style="font-size:15px;font-weight:700;color:#061907;margin-bottom:8px;">${e(vehicle.make)} ${e(vehicle.model ?? '')}</p>` : ''}
      ${plate(vehicle.plate)}
      ${vehicle.color ? `<p style="font-size:12px;color:#747871;margin-top:6px;">${e(vehicle.color)}</p>` : ''}
    </div>
    <div style="background:#fff;border-radius:12px;border:1px solid #e1e3e4;padding:14px;">
      <p style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Tour</p>
      ${tour.activity ? `<p style="font-size:14px;font-weight:700;color:#061907;margin-bottom:6px;">${e(tour.activity)}</p>` : ''}
      <p style="font-size:13px;color:#434841;margin-bottom:3px;">Start: <strong>${fmtT(tour.startedAt)}</strong></p>
      <p style="font-size:13px;color:#ba1a1a;font-weight:700;">ETA: ${fmtT(tour.eta)}</p>
      ${tour.difficulty ? `<p style="font-size:12px;color:#747871;margin-top:4px;">T: ${e(tour.difficulty)}</p>` : ''}
      ${tour.persons > 1 ? `<p style="font-size:12px;color:#747871;margin-top:4px;">${tour.persons} Personen</p>` : ''}
    </div>
  </div>

  <!-- LETZTER STANDORT -->
  <div style="background:#fff;border-radius:12px;border:1px solid #e1e3e4;overflow:hidden;margin-bottom:12px;">
    <div style="padding:12px 16px;border-bottom:1px solid #e1e3e4;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:15px;font-weight:700;display:flex;align-items:center;gap:6px;"><span>📍</span> Letzter bekannter Standort</span>
      ${lastLoc ? `<span style="font-size:11px;color:#747871;font-family:monospace;">${lastLoc.lat.toFixed(5)}°&nbsp;N,&nbsp;${lastLoc.lng.toFixed(5)}°&nbsp;E</span>` : ''}
    </div>
    ${lastLoc ? `
    <a href="https://maps.google.com/?q=${lastLoc.lat},${lastLoc.lng}" target="_blank" style="display:block;">
      <div style="height:200px;background:#e8eef0;position:relative;overflow:hidden;">
        <img src="https://staticmap.openstreetmap.de/staticmap.php?center=${lastLoc.lat},${lastLoc.lng}&zoom=14&size=600x240&markers=${lastLoc.lat},${lastLoc.lng},red"
          style="width:100%;height:100%;object-fit:cover;display:block;"
          onerror="this.parentElement.innerHTML='<div style=\\'height:200px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:#747871;\\'><span style=\\'font-size:32px;\\'>🗺️</span><span style=\\'font-size:13px;\\'>Karte in Google Maps öffnen ↗</span></div>'"
          alt="Karte"/>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:24px;height:24px;background:#ba1a1a;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);pointer-events:none;"></div>
      </div>
    </a>
    <div style="padding:12px 16px;background:#f8f9fa;border-top:1px solid #e1e3e4;">
      <p style="font-size:12px;color:#747871;margin-bottom:10px;">Aufgezeichnet: <strong style="color:#191c1d;">${fmt(lastLoc.timestamp)}</strong></p>
      <a href="https://maps.google.com/?q=${lastLoc.lat},${lastLoc.lng}" target="_blank"
         style="display:inline-flex;align-items:center;gap:6px;background:#061907;color:#fff;padding:10px 16px;border-radius:8px;font-weight:700;font-size:13px;margin-bottom:${locs.length > 1 ? '12px' : '0'};">
        In Google Maps öffnen ↗
      </a>
      ${locs.length > 1 ? `
      <details>
        <summary style="font-size:13px;font-weight:700;color:#2c694e;display:inline-flex;align-items:center;gap:4px;">
          ▼ Alle ${locs.length} GPS-Punkte anzeigen
        </summary>
        <div style="margin-top:10px;max-height:220px;overflow-y:auto;border:1px solid #e1e3e4;border-radius:8px;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead><tr style="background:#f3f4f5;">
              <th style="padding:7px 10px;text-align:left;color:#747871;font-weight:700;">#</th>
              <th style="padding:7px 10px;text-align:left;color:#747871;font-weight:700;">Zeit</th>
              <th style="padding:7px 10px;text-align:left;color:#747871;font-weight:700;">Koordinaten</th>
              <th style="padding:7px 10px;text-align:right;color:#747871;font-weight:700;">Höhe</th>
            </tr></thead>
            <tbody>
              ${locs.map((l: any, i: number) => `
              <tr style="border-top:1px solid #f3f4f5;${i===0?'background:#fff8f0;':''}">
                <td style="padding:6px 10px;color:#c3c8bf;">${locs.length-i}</td>
                <td style="padding:6px 10px;">${fmtT(l.timestamp)}</td>
                <td style="padding:6px 10px;font-family:monospace;font-size:11px;">${l.lat.toFixed(5)}, ${l.lng.toFixed(5)}</td>
                <td style="padding:6px 10px;text-align:right;color:#747871;">${l.ele != null ? Math.round(l.ele)+'m' : '—'}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </details>` : ''}
    </div>` : `
    <div style="padding:20px;text-align:center;color:#747871;">
      <p style="font-size:14px;">Noch keine GPS-Daten verfügbar</p>
      <p style="font-size:12px;margin-top:4px;">Punkte werden alle 3–10 Minuten übermittelt</p>
    </div>`}
  </div>

  <!-- MEDIZIN -->
  <div style="background:#fff;border-radius:12px;border:1px solid #e1e3e4;border-left:5px solid #ba1a1a;overflow:hidden;margin-bottom:12px;">
    <div style="padding:14px 16px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #e1e3e4;">
      <span style="font-size:18px;">🏥</span>
      <span style="font-size:14px;font-weight:800;color:#ba1a1a;letter-spacing:.5px;text-transform:uppercase;">Medizinische Daten</span>
    </div>
    <div style="padding:14px 16px;">
      ${user?.bloodType ? `
      <div style="background:#f8f9fa;border-radius:8px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;">BLUTGRUPPE</span>
        <span style="font-size:24px;font-weight:900;color:#ba1a1a;">${e(user.bloodType)}</span>
      </div>` : ''}
      ${user?.allergies ? `
      <div style="margin-bottom:12px;">
        <p style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;margin-bottom:6px;">ALLERGIEN</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${user.allergies.split(',').map((a: string) => `<span style="background:#ffdad6;color:#93000a;padding:4px 12px;border-radius:100px;font-size:12px;font-weight:700;">${e(a.trim())}</span>`).join('')}
        </div>
      </div>` : ''}
      ${user?.medications ? `
      <div style="${user.medicalNotes ? 'margin-bottom:12px;' : ''}">
        <p style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;margin-bottom:4px;">MEDIKAMENTE</p>
        <p style="font-size:14px;line-height:1.5;color:#191c1d;">${e(user.medications)}</p>
      </div>` : ''}
      ${user?.medicalNotes ? `
      <div>
        <p style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;margin-bottom:4px;">WEITERE HINWEISE</p>
        <p style="font-size:14px;line-height:1.5;color:#191c1d;">${e(user.medicalNotes)}</p>
      </div>` : ''}
      ${!user?.bloodType && !user?.allergies && !user?.medications && !user?.medicalNotes
        ? `<p style="font-size:13px;color:#747871;">Keine medizinischen Daten hinterlegt.</p>` : ''}
    </div>
  </div>

  <!-- NOTFALLKONTAKTE -->
  ${contacts.length > 0 ? `
  <div style="background:#fff;border-radius:12px;border:1px solid #e1e3e4;overflow:hidden;margin-bottom:12px;">
    <div style="padding:12px 16px;border-bottom:1px solid #e1e3e4;display:flex;align-items:center;gap:8px;">
      <span>📞</span>
      <span style="font-size:15px;font-weight:700;color:#061907;">Notfallkontakte</span>
    </div>
    ${contacts.map((c: any, i: number) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #f3f4f5;${i>0?'opacity:.85;':''}">
      <div>
        <p style="font-size:16px;font-weight:700;color:#061907;">${e(c.name)}${c.isPrimary ? '&nbsp;<span style="font-size:10px;background:#aeeecb;color:#005227;padding:2px 8px;border-radius:100px;font-weight:700;vertical-align:middle;">Primär</span>' : ''}</p>
        ${c.relation ? `<p style="font-size:13px;color:#747871;margin-top:2px;">${e(c.relation)}</p>` : ''}
      </div>
      <a href="tel:${e(c.phone)}" style="width:48px;height:48px;border-radius:50%;background:${c.isPrimary ? '#aeeecb' : '#f3f4f5'};display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;" ontouchstart="this.style.transform='scale(.9)'" ontouchend="this.style.transform='scale(1)'">📞</a>
    </div>`).join('')}
  </div>` : ''}

  ${tour.notes ? `
  <div style="background:#fff;border-radius:12px;border:1px solid #e1e3e4;padding:14px 16px;margin-bottom:12px;">
    <p style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;margin-bottom:6px;">NOTIZEN FÜR RETTUNGSKRÄFTE</p>
    <p style="font-size:14px;line-height:1.6;color:#191c1d;">${e(tour.notes)}</p>
  </div>` : ''}

</div>`, true)
}

function row(label: string, value: string) {
  return `<div class="row"><span class="k">${label}</span><span class="v">${value}</span></div>`
}

function html404() {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Trailtag</title></head>
<body style="font-family:sans-serif;padding:40px;text-align:center;background:#f8f9fa;">
<h2 style="color:#ba1a1a;margin-bottom:12px;">❌ QR-Code nicht gefunden</h2>
<p style="color:#747871;">Dieser QR-Code ist nicht registriert.</p>
</body></html>`
}

export default router