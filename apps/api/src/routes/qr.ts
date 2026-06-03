import express, { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = express.Router()

router.get('/:token', async (req: Request, res: Response) => {
  const token = req.params['token'] as string

  const vehicle = await prisma.vehicle.findUnique({
    where: { qrToken: token },
    include: {
      tours: {
        where: { status: { in: ['ACTIVE', 'ALARM'] } },
        orderBy: { startedAt: 'desc' },
        take: 1,
        include: { user: true }
      }
    }
  })

  if (!vehicle) {
    return res.status(404).send(renderPage('gray', 'Unbekannter QR-Code', ''))
  }

  const activeTour = vehicle.tours[0]

  if (!activeTour || activeTour.status === 'ACTIVE') {
    return res.send(renderPage('green', 'Tour läuft planmässig ✓',
      `Fahrzeug: ${vehicle.make} ${vehicle.model} (${vehicle.plate})`))
  }

  const details = `
Person: ${activeTour.user.name}
Aktivität: ${activeTour.activity}
Geplante Rückkehr: ${activeTour.eta?.toLocaleString('de-CH')}
Distanz: ${activeTour.distanceKm} km
Fahrzeug: ${vehicle.make} ${vehicle.model} (${vehicle.plate}) ${vehicle.color}
  `
  res.send(renderPage('red', '⚠️ PERSON ÜBERFÄLLIG — BITTE RETTUNGSDIENST ALARMIEREN', details))
})

function renderPage(color: string, title: string, details: string) {
  const bg = color === 'red' ? '#E53E3E' : color === 'green' ? '#38A169' : '#718096'
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Trailtag</title></head>
<body style="margin:0;font-family:sans-serif;background:${bg};color:white;padding:24px">
<h1 style="font-size:24px">🏔️ Trailtag</h1>
<h2 style="font-size:18px">${title}</h2>
<pre style="white-space:pre-wrap;font-size:14px">${details}</pre>
</body></html>`
}

export default router