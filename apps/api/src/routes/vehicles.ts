import express, { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
const router = express.Router()

// POST /vehicles — Fahrzeug anlegen. Nur das Kennzeichen ist Pflicht —
// viele Nutzer kennen Marke/Modell/Farbe nicht auswendig, und das im
// Formular zu erzwingen bremst nur unnötig.
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const { plate, make, model, color } = req.body
  if (!plate || !String(plate).trim()) return res.status(400).json({ error: 'Kennzeichen ist erforderlich' })
  const vehicle = await prisma.vehicle.create({
    data: {
      userId: req.userId as string,
      plate: String(plate).trim().toUpperCase(),
      make: make || null,
      model: model || null,
      color: color || null,
    }
  })
  res.status(201).json(vehicle)
})

// GET /vehicles — alle eigenen Fahrzeuge
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const vehicles = await prisma.vehicle.findMany({
    where: { userId: req.userId as string },
    orderBy: { id: 'asc' }
  })
  res.json(vehicles)
})

// PUT /vehicles/:id
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const { plate, make, model, color } = req.body
  const id = req.params['id'] as string
  const vehicle = await prisma.vehicle.findFirst({
    where: { id, userId: req.userId as string }
  })
  if (!vehicle) return res.status(404).json({ error: 'Fahrzeug nicht gefunden' })
  if (plate !== undefined && !String(plate).trim()) return res.status(400).json({ error: 'Kennzeichen ist erforderlich' })
  const updated = await prisma.vehicle.update({
    where: { id },
    data: {
      ...(plate !== undefined && { plate: String(plate).trim().toUpperCase() }),
      ...(make !== undefined && { make: make || null }),
      ...(model !== undefined && { model: model || null }),
      ...(color !== undefined && { color: color || null }),
    }
  })
  res.json(updated)
})

// DELETE /vehicles/:id — blocked if the vehicle is tied to an active tour,
// since deleting it would break the rescue-portal QR code mid-tour.
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = req.params['id'] as string
  const vehicle = await prisma.vehicle.findFirst({
    where: { id, userId: req.userId as string }
  })
  if (!vehicle) return res.status(404).json({ error: 'Fahrzeug nicht gefunden' })

  const activeTour = await prisma.tour.findFirst({
    where: { vehicleId: id, status: { in: ['ACTIVE', 'ALARM'] } }
  })
  if (activeTour) {
    return res.status(400).json({ error: 'Dieses Fahrzeug ist einer aktiven Tour zugeordnet und kann nicht gelöscht werden.' })
  }

  await prisma.vehicle.delete({ where: { id } })
  res.json({ success: true })
})

export default router