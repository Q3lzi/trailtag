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
  if (tour.status === 'ALARM') return res.send(renderAlarm(vehicle, tour))
  const etaMs = tour.eta ? new Date(tour.eta).getTime() : null
  return (!etaMs || etaMs > Date.now()) ? res.send(renderActive(vehicle, tour)) : res.send(renderAlarm(vehicle, tour))
})

// ── Helpers ───────────────────────────────────────────────────────────────────
const e = (s: any) => s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
const fmt = (d: any) => d ? new Date(d).toLocaleString('de-CH',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'
const fmtT = (d: any) => d ? new Date(d).toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'}) : '—'

// Schweizer Kennzeichen
const plate = (text: string) => `<span style="display:inline-flex;align-items:stretch;border:2px solid #222;border-radius:4px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.2);font-family:Arial,sans-serif;">
  <span style="background:#D52B1E;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3px 5px;gap:2px;">
    <span style="color:#fff;font-size:11px;font-weight:900;line-height:1;letter-spacing:0;">+</span>
    <span style="background:#fff;color:#D52B1E;font-size:7px;font-weight:900;padding:1px 2px;line-height:1;border-radius:1px;">CH</span>
  </span>
  <span style="background:#fff;padding:5px 11px;font-size:16px;font-weight:900;letter-spacing:2.5px;color:#111;">${e(text)}</span>
</span>`

// Row helper for detail tables
const row = (label: string, value: string, red = false) =>
  `<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 16px;border-bottom:1px solid #f3f4f5;">
    <span style="font-size:13px;color:#747871;">${label}</span>
    <span style="font-size:14px;font-weight:700;color:${red ? '#ba1a1a' : '#061907'};text-align:right;">${value}</span>
  </div>`

// Card wrapper
const card = (label: string, content: string, accent = '') =>
  `<div style="background:#fff;border-radius:12px;border:1px solid #e1e3e4;${accent ? `border-left:5px solid ${accent};` : ''}overflow:hidden;margin-bottom:12px;">
    ${label ? `<div style="padding:12px 16px;border-bottom:1px solid #e1e3e4;"><span style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;text-transform:uppercase;">${label}</span></div>` : ''}
    ${content}
  </div>`

// Shell
function shell(statusBadge: string, hero: string, body: string) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Trailtag – Ersthelfer-Portal</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Inter',system-ui,sans-serif;background:#f8f9fa;color:#191c1d;}
.c{max-width:480px;margin:0 auto;}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(186,26,26,.5);}70%{box-shadow:0 0 0 14px rgba(186,26,26,0);}}
.pulse{animation:pulse 2s infinite;}
details summary{list-style:none;cursor:pointer;-webkit-appearance:none;}
details summary::-webkit-details-marker{display:none;}
</style>
</head>
<body>
<header style="background:#fff;border-bottom:1px solid #e1e3e4;position:sticky;top:0;z-index:100;box-shadow:0 1px 6px rgba(0,0,0,.07);">
  <div class="c" style="display:flex;justify-content:space-between;align-items:center;padding:0 20px;height:52px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#061907" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>
      <span style="font-size:18px;font-weight:800;color:#061907;letter-spacing:-.4px;">Trailtag</span>
    </div>
    ${statusBadge}
  </div>
</header>
${hero}
<div class="c" style="padding:16px 16px 40px;">
  ${body}
</div>
<footer style="text-align:center;padding:16px;color:#747871;font-size:11px;border-top:1px solid #e1e3e4;background:#f8f9fa;">
  Zuletzt aktualisiert: ${new Date().toLocaleTimeString('de-CH')} · Automatische Aktualisierung alle 30 Sekunden
</footer>
<script>setTimeout(()=>location.reload(),30000)</script>
</body></html>`
}

// ── GREEN ─────────────────────────────────────────────────────────────────────
function renderGreen(vehicle: any) {
  const badge = `<span style="background:#aeeecb;color:#005227;padding:5px 12px;border-radius:100px;font-size:11px;font-weight:800;letter-spacing:.5px;">✅ KEIN ALARM</span>`
  const hero = `<div style="background:#2c694e;color:#fff;padding:24px 20px 28px;position:relative;overflow:hidden;">
    <div class="c"><p style="font-size:10px;font-weight:700;opacity:.7;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Safety Status</p>
    <h1 style="font-size:26px;font-weight:800;margin-bottom:6px;">KEIN ALARM</h1>
    <p style="font-size:14px;opacity:.85;">Kein aktiver Wanderer an diesem Fahrzeug.</p></div>
    <div style="position:absolute;right:-10px;bottom:-10px;opacity:.08;font-size:110px;">⛰</div></div>`
  return shell(badge, hero, card('Fahrzeug am Parkplatz',
    `<div style="padding:16px;display:flex;align-items:center;gap:16px;">${plate(vehicle.plate)}<div>
      ${vehicle.make ? `<p style="font-size:15px;font-weight:700;color:#061907;">${e(vehicle.make)}${vehicle.model ? ' '+e(vehicle.model) : ''}</p>` : ''}
      ${vehicle.color ? `<p style="font-size:13px;color:#747871;margin-top:3px;">${e(vehicle.color)}</p>` : ''}
    </div></div>`))
}

// ── ACTIVE ────────────────────────────────────────────────────────────────────
function renderActive(vehicle: any, tour: any) {
  const user = tour.user
  const badge = `<span style="background:#aeeecb;color:#005227;padding:5px 12px;border-radius:100px;font-size:11px;font-weight:800;letter-spacing:.5px;">✅ AKTIV</span>`
  const hero = `<div style="background:#2c694e;color:#fff;padding:24px 20px 28px;position:relative;overflow:hidden;">
    <div class="c"><p style="font-size:10px;font-weight:700;opacity:.7;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Safety Status</p>
    <h1 style="font-size:26px;font-weight:800;margin-bottom:6px;">TOUR AKTIV</h1>
    <p style="font-size:14px;opacity:.85;">Aktive Tour · Geplante Rückkehr: ${fmtT(tour.eta)}</p></div>
    <div style="position:absolute;right:-10px;bottom:-10px;opacity:.08;font-size:110px;">⛰</div></div>`

  // Wanderer card
  const wanderer = card('Wanderer', `<div style="padding:16px;display:flex;align-items:center;gap:14px;">
    <div style="width:52px;height:52px;border-radius:12px;background:#e8f5ee;border:1px solid #aeeecb;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;">🧗</div>
    <div>
      <h2 style="font-size:20px;font-weight:800;color:#061907;">${e(user?.name) || '—'}</h2>
      ${user?.birthYear ? `<p style="font-size:13px;color:#747871;margin-top:2px;">Jahrgang ${e(user.birthYear)}</p>` : ''}
    </div>
  </div>`)

  // Tour card
  const tourCard = card('Tour', `<div style="padding:4px 0;">
    ${row('Gestartet', fmt(tour.startedAt))}
    ${row('Geplante Rückkehr', fmtT(tour.eta))}
    ${tour.activity ? row('Aktivität', e(tour.activity)) : ''}
    ${tour.difficulty ? row('Schwierigkeit', e(tour.difficulty)) : ''}
    ${tour.persons > 1 ? row('Personen', tour.persons + ' Personen') : ''}
    ${tour.notes ? `<div style="padding:10px 16px;"><p style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;margin-bottom:4px;">NOTIZEN</p><p style="font-size:13px;color:#191c1d;line-height:1.5;">${e(tour.notes)}</p></div>` : ''}
  </div>`)

  // Fahrzeug card
  const vehCard = card('Fahrzeug am Parkplatz', `<div style="padding:16px;display:flex;align-items:center;gap:16px;">
    ${plate(vehicle.plate)}
    <div>
      ${vehicle.make ? `<p style="font-size:15px;font-weight:700;color:#061907;">${e(vehicle.make)}${vehicle.model ? ' '+e(vehicle.model) : ''}</p>` : ''}
      ${vehicle.color ? `<p style="font-size:13px;color:#747871;margin-top:3px;">${e(vehicle.color)}</p>` : ''}
    </div>
  </div>`)

  return shell(badge, hero, wanderer + tourCard + vehCard)
}

// ── ALARM ─────────────────────────────────────────────────────────────────────
function renderAlarm(vehicle: any, tour: any) {
  const user = tour.user
  const contacts: any[] = user?.emergencyContacts ?? []
  const locs: any[] = tour?.locations ?? []
  const lastLoc = locs[0] ?? null
  const etaMs = tour?.eta ? new Date(tour.eta).getTime() : null
  const minsOver = etaMs ? Math.floor((Date.now() - etaMs) / 60000) : null

  const badge = `<span class="pulse" style="background:#ffdad6;color:#ba1a1a;padding:5px 12px;border-radius:100px;font-size:11px;font-weight:800;letter-spacing:.5px;">⚠️ NOTFALL</span>`
  const hero = `<div style="background:#ba1a1a;color:#fff;padding:24px 20px 28px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.2);">
    <div class="c">
      <p style="font-size:10px;font-weight:700;opacity:.7;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Safety Status</p>
      <h1 style="font-size:28px;font-weight:800;letter-spacing:-.5px;margin-bottom:8px;">ALARM — ÜBERFÄLLIG</h1>
      <p style="font-size:14px;opacity:.9;line-height:1.5;">
        ${minsOver !== null ? `Wanderer ${minsOver} Minuten überfällig.` : 'Tour ist überfällig.'}<br>
        ${lastLoc ? `Letztes GPS-Update: ${fmt(lastLoc.timestamp)}.` : 'Noch kein GPS-Signal.'}
      </p>
    </div>
    <div style="position:absolute;right:-12px;bottom:-12px;opacity:.1;font-size:130px;line-height:1;">🚨</div>
  </div>`

  // Überfällig banner
  const overdue = minsOver !== null ? `<div style="background:#fff3cd;border:1px solid #f59e0b;border-radius:12px;padding:13px 16px;margin-bottom:12px;display:flex;align-items:center;gap:10px;">
    <span style="font-size:18px;">⏱</span>
    <span style="font-size:13px;">Geplante Rückkehr war vor <strong>${minsOver} Minuten</strong> (${fmtT(tour.eta)})</span>
  </div>` : ''

  // Emergency call buttons
  const callBtns = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
    <a href="tel:117" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:#fff;border:2.5px solid #ba1a1a;color:#ba1a1a;padding:20px 12px;border-radius:14px;font-weight:800;font-size:15px;text-decoration:none;" ontouchstart="this.style.opacity='.7'" ontouchend="this.style.opacity='1'">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ba1a1a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.86a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      Polizei 117
    </a>
    <a href="tel:1414" class="pulse" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:#ba1a1a;color:#fff;padding:20px 12px;border-radius:14px;font-weight:800;font-size:15px;text-decoration:none;" ontouchstart="this.style.opacity='.7'" ontouchend="this.style.opacity='1'">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
      REGA 1414
    </a>
  </div>`

  // Person card
  const personCard = `<div style="background:#fff;border-radius:12px;border:1px solid #e1e3e4;overflow:hidden;margin-bottom:12px;">
    <div style="padding:16px;display:flex;align-items:center;gap:14px;">
      <div style="width:64px;height:64px;border-radius:12px;background:#f3f4f5;border:1px solid #e1e3e4;display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;">🧗</div>
      <div style="flex:1;">
        <p style="font-size:10px;font-weight:700;color:#747871;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Vermisste Person</p>
        <h2 style="font-size:22px;font-weight:800;color:#061907;margin-bottom:3px;">${user?.name ? e(user.name) : '—'}</h2>
        <p style="font-size:13px;color:#434841;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          ${user?.birthYear ? `<span>Jg. ${e(user.birthYear)}</span>` : ''}
          ${user?.phone ? `<span>·</span><a href="tel:${e(user.phone)}" style="color:#2c694e;font-weight:700;">${e(user.phone)}</a>` : ''}
        </p>
      </div>
    </div>
  </div>`

  // Bento: Fahrzeug + Tour
  const bento = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
    <div style="background:#fff;border-radius:12px;border:1px solid #e1e3e4;padding:14px;">
      <p style="font-size:10px;font-weight:700;color:#747871;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Fahrzeug</p>
      ${vehicle.make ? `<p style="font-size:14px;font-weight:700;color:#061907;margin-bottom:8px;">${e(vehicle.make)}${vehicle.model ? ' '+e(vehicle.model) : ''}</p>` : ''}
      ${plate(vehicle.plate)}
      ${vehicle.color ? `<p style="font-size:12px;color:#747871;margin-top:6px;">${e(vehicle.color)}</p>` : ''}
    </div>
    <div style="background:#fff;border-radius:12px;border:1px solid #e1e3e4;padding:14px;">
      <p style="font-size:10px;font-weight:700;color:#747871;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Tour</p>
      ${tour.activity ? `<p style="font-size:14px;font-weight:700;color:#061907;margin-bottom:6px;">${e(tour.activity)}</p>` : ''}
      <p style="font-size:12px;color:#434841;margin-bottom:3px;">Gestartet: <strong>${fmtT(tour.startedAt)}</strong></p>
      <p style="font-size:12px;font-weight:700;color:#ba1a1a;margin-bottom:3px;">Rückkehr: ${fmtT(tour.eta)}</p>
      ${tour.difficulty ? `<p style="font-size:12px;color:#747871;margin-top:4px;">Schwierigkeit: ${e(tour.difficulty)}</p>` : ''}
      ${tour.persons > 1 ? `<p style="font-size:12px;color:#747871;margin-top:3px;">${tour.persons} Personen</p>` : ''}
    </div>
  </div>`

  // GPS + Map
  const gpsCard = `<div style="background:#fff;border-radius:12px;border:1px solid #e1e3e4;overflow:hidden;margin-bottom:12px;">
    <div style="padding:12px 16px;border-bottom:1px solid #e1e3e4;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:15px;font-weight:700;display:flex;align-items:center;gap:6px;">📍 Letzter bekannter Standort</span>
      ${lastLoc ? `<span style="font-size:11px;color:#747871;font-family:monospace;">${lastLoc.lat.toFixed(5)}°&thinsp;N,&thinsp;${lastLoc.lng.toFixed(5)}°&thinsp;E</span>` : ''}
    </div>
    ${lastLoc ? `
    <!-- OpenStreetMap via tiles.maps.ch or fallback -->
    <div style="position:relative;height:220px;background:#e8eef0;overflow:hidden;">
      <iframe
        src="https://www.openstreetmap.org/export/embed.html?bbox=${lastLoc.lng-.015},${lastLoc.lat-.01},${lastLoc.lng+.015},${lastLoc.lat+.01}&layer=mapnik&marker=${lastLoc.lat},${lastLoc.lng}"
        style="width:100%;height:100%;border:0;display:block;"
        loading="lazy"
        title="Karte"
      ></iframe>
    </div>
    <div style="padding:12px 16px;background:#f8f9fa;border-top:1px solid #e1e3e4;">
      <p style="font-size:12px;color:#747871;margin-bottom:10px;">Aufgezeichnet: <strong style="color:#191c1d;">${fmt(lastLoc.timestamp)}</strong></p>
      <a href="https://maps.google.com/?q=${lastLoc.lat},${lastLoc.lng}" target="_blank"
         style="display:inline-flex;align-items:center;gap:6px;background:#061907;color:#fff;padding:10px 16px;border-radius:8px;font-weight:700;font-size:13px;text-decoration:none;">
        In Google Maps öffnen ↗
      </a>
      ${locs.length > 1 ? `
      <details style="margin-top:12px;">
        <summary style="font-size:13px;font-weight:700;color:#2c694e;display:inline-flex;align-items:center;gap:4px;">
          ▼ Alle ${locs.length} GPS-Punkte anzeigen
        </summary>
        <div style="margin-top:10px;max-height:240px;overflow-y:auto;border:1px solid #e1e3e4;border-radius:8px;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead><tr style="background:#f3f4f5;position:sticky;top:0;">
              <th style="padding:7px 8px;text-align:left;color:#747871;font-weight:700;">#</th>
              <th style="padding:7px 8px;text-align:left;color:#747871;font-weight:700;">Zeit</th>
              <th style="padding:7px 8px;text-align:left;color:#747871;font-weight:700;">Koordinaten</th>
              <th style="padding:7px 8px;text-align:right;color:#747871;font-weight:700;">Höhe</th>
            </tr></thead>
            <tbody>
              ${locs.map((l: any, i: number) => `
              <tr style="border-top:1px solid #f3f4f5;${i===0 ? 'background:#fff8f0;' : ''}">
                <td style="padding:6px 8px;color:#c3c8bf;">${locs.length-i}</td>
                <td style="padding:6px 8px;color:#434841;">${fmtT(l.timestamp)}</td>
                <td style="padding:6px 8px;"><a href="https://maps.google.com/?q=${l.lat},${l.lng}" target="_blank" style="font-family:monospace;font-size:11px;color:#2c694e;text-decoration:none;">${l.lat.toFixed(5)}, ${l.lng.toFixed(5)} ↗</a></td>
                <td style="padding:6px 8px;text-align:right;color:#747871;">${l.ele != null ? Math.round(l.ele)+' m' : '—'}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </details>` : ''}
    </div>` : `<div style="padding:24px;text-align:center;color:#747871;">
      <p style="font-size:14px;margin-bottom:4px;">Noch keine GPS-Daten verfügbar</p>
      <p style="font-size:12px;">Punkte werden alle 3–10 Minuten übermittelt</p>
    </div>`}
  </div>`

  // Medizin
  const medCard = `<div style="background:#fff;border-radius:12px;border:1px solid #e1e3e4;border-left:5px solid #ba1a1a;overflow:hidden;margin-bottom:12px;">
    <div style="padding:14px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #e1e3e4;">
      <div style="width:32px;height:32px;background:#ffdad6;border-radius:8px;display:flex;align-items:center;justify-content:center;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#ba1a1a"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 14H8v-4H4v-4h4V5h4v4h4v4h-4v4z"/></svg>
      </div>
      <span style="font-size:14px;font-weight:800;color:#ba1a1a;letter-spacing:.3px;text-transform:uppercase;">Medizinische Daten</span>
    </div>
    <div style="padding:14px 16px;">
      ${user?.bloodType ? `
      <div style="background:#fff8f8;border:1px solid #ffdad6;border-radius:10px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <span style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1.5px;text-transform:uppercase;">Blutgruppe</span>
        <span style="font-size:28px;font-weight:900;color:#ba1a1a;letter-spacing:-1px;">${e(user.bloodType)}</span>
      </div>` : ''}
      ${user?.allergies ? `
      <div style="margin-bottom:14px;">
        <p style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;text-transform:uppercase;margin-bottom:7px;">Allergien</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${user.allergies.split(',').map((a: string) => `<span style="background:#ffdad6;color:#93000a;padding:5px 12px;border-radius:100px;font-size:12px;font-weight:700;">${e(a.trim())}</span>`).join('')}
        </div>
      </div>` : ''}
      ${user?.medications ? `
      <div style="${user.medicalNotes ? 'margin-bottom:14px;' : ''}">
        <p style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;">Medikamente</p>
        <p style="font-size:14px;line-height:1.6;color:#191c1d;">${e(user.medications)}</p>
      </div>` : ''}
      ${user?.medicalNotes ? `
      <div>
        <p style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;">Weitere Hinweise</p>
        <p style="font-size:14px;line-height:1.6;color:#191c1d;">${e(user.medicalNotes)}</p>
      </div>` : ''}
      ${!user?.bloodType && !user?.allergies && !user?.medications && !user?.medicalNotes
        ? `<p style="font-size:13px;color:#747871;font-style:italic;">Keine medizinischen Daten hinterlegt.</p>` : ''}
    </div>
  </div>`

  // Notfallkontakte
  const contactsCard = contacts.length > 0 ? `<div style="background:#fff;border-radius:12px;border:1px solid #e1e3e4;overflow:hidden;margin-bottom:12px;">
    <div style="padding:14px 16px;border-bottom:1px solid #e1e3e4;display:flex;align-items:center;gap:10px;">
      <div style="width:32px;height:32px;background:#aeeecb;border-radius:8px;display:flex;align-items:center;justify-content:center;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#005227" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.86a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      </div>
      <span style="font-size:15px;font-weight:700;color:#061907;">Notfallkontakte</span>
    </div>
    ${contacts.map((c: any, i: number) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;${i < contacts.length-1 ? 'border-bottom:1px solid #f3f4f5;' : ''}${i > 0 ? 'opacity:.85;' : ''}">
      <div>
        <p style="font-size:16px;font-weight:700;color:#061907;display:flex;align-items:center;gap:6px;">
          ${e(c.name)}
          ${c.isPrimary ? '<span style="font-size:10px;background:#aeeecb;color:#005227;padding:2px 8px;border-radius:100px;font-weight:700;">Primär</span>' : ''}
        </p>
        ${c.relation ? `<p style="font-size:13px;color:#747871;margin-top:2px;">${e(c.relation)}</p>` : ''}
        <p style="font-size:13px;color:#2c694e;margin-top:2px;font-weight:600;">${e(c.phone)}</p>
      </div>
      <a href="tel:${e(c.phone)}" style="width:50px;height:50px;border-radius:50%;background:${c.isPrimary ? '#aeeecb' : '#f3f4f5'};display:flex;align-items:center;justify-content:center;flex-shrink:0;text-decoration:none;transition:transform .15s;" ontouchstart="this.style.transform='scale(.9)'" ontouchend="this.style.transform='scale(1)'">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${c.isPrimary ? '#005227' : '#434841'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.86a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      </a>
    </div>`).join('')}
  </div>` : ''

  // Equipment / Notizen
  const notesCard = tour.notes ? `<div style="background:#fff;border-radius:12px;border:1px solid #e1e3e4;overflow:hidden;margin-bottom:12px;">
    <div style="padding:12px 16px;border-bottom:1px solid #e1e3e4;"><span style="font-size:11px;font-weight:700;color:#747871;letter-spacing:1px;text-transform:uppercase;">Ausrüstung &amp; Notizen</span></div>
    <div style="padding:14px 16px;"><p style="font-size:14px;line-height:1.6;color:#191c1d;">${e(tour.notes)}</p></div>
  </div>` : ''

  return shell(badge, hero, overdue + callBtns + personCard + bento + gpsCard + medCard + contactsCard + notesCard)
}

function html404() {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Trailtag</title></head>
<body style="font-family:sans-serif;padding:40px;text-align:center;background:#f8f9fa;">
<h2 style="color:#ba1a1a;margin-bottom:12px;">❌ QR-Code nicht gefunden</h2>
<p style="color:#747871;">Dieser QR-Code ist nicht registriert.</p>
</body></html>`
}

export default router