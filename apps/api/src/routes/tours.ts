import express, { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'

const router = express.Router()

// Tour erstellen
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const {
    activity,
    routeName,
    difficulty,
    persons,
    distanceKm,
    elevationUp,
    bufferMinutes,
    parkingLocation,
    notes,
    startLat,
    startLng,
    vehicleId,
  } = req.body

  if (!activity) return res.status(400).json({ error: 'Aktivität fehlt' })

  const tour = await prisma.tour.create({
    data: {
      userId: req.userId as string,
      activity,
      routeName: routeName || null,
      difficulty: difficulty || null,
      persons: persons ? Number(persons) : 1,
      distanceKm: distanceKm ? Number(distanceKm) : null,
      elevationUp: elevationUp ? Number(elevationUp) : null,
      bufferMinutes: bufferMinutes ? Number(bufferMinutes) : 15,
      parkingLocation: parkingLocation || null,
      notes: notes || null,
      startLat: startLat ? Number(startLat) : null,
      startLng: startLng ? Number(startLng) : null,
      lastLat: startLat ? Number(startLat) : null,
      lastLng: startLng ? Number(startLng) : null,
      vehicleId: vehicleId || null,
      status: 'PLANNED',
    }
  })

  res.status(201).json(tour)
})

// Tour starten
router.post('/:id/start', requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string
  const { eta } = req.body

  const tour = await prisma.tour.findFirst({
    where: { id, userId: req.userId as string }
  })

  if (!tour) return res.status(404).json({ error: 'Tour nicht gefunden' })
  if (tour.status !== 'PLANNED') return res.status(400).json({ error: 'Tour bereits gestartet' })

  const started = await prisma.tour.update({
    where: { id },
    data: {
      status: 'ACTIVE',
      startedAt: new Date(),
      eta: eta ? new Date(eta) : null,
    }
  })

  res.json({ message: 'Tour gestartet — Timer läuft', tour: started })
})


// GET /tours/:id — einzelne Tour mit Locations
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = req.params['id'] as string
  const tour = await prisma.tour.findFirst({
    where: { id, userId: req.userId as string },
    include: {
      locations: { orderBy: { timestamp: 'asc' }, take: 100 },
      vehicle: true,
    }
  })
  if (!tour) return res.status(404).json({ error: 'Tour nicht gefunden' })
  res.json(tour)
})


// GPS Standort updaten
router.post('/:id/location', requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string
  const { lat, lng, ele } = req.body
  if (!lat || !lng) return res.status(400).json({ error: 'lat und lng fehlen' })
  const tour = await prisma.tour.findFirst({
    where: { id, userId: req.userId as string }
  })
  if (!tour) return res.status(404).json({ error: 'Tour nicht gefunden' })
  if (tour.status !== 'ACTIVE') return res.status(400).json({ error: 'Tour nicht aktiv' })

  // Letzten Standort + Verlauf gleichzeitig speichern
  const [updated] = await prisma.$transaction([
    prisma.tour.update({
      where: { id },
      data: {
        lastLat: Number(lat),
        lastLng: Number(lng),
        locationUpdatedAt: new Date(),
      }
    }),
    prisma.tourLocation.create({
      data: {
        tourId: id,
        lat: Number(lat),
        lng: Number(lng),
        ele: ele ? Number(ele) : null,
      }
    })
  ])

  res.json({ message: 'Standort aktualisiert', tour: updated })
})

// Tour abschliessen
router.post('/:id/checkout', requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string

  const tour = await prisma.tour.findFirst({
    where: { id, userId: req.userId as string }
  })

  if (!tour) return res.status(404).json({ error: 'Tour nicht gefunden' })
  if (tour.status === 'COMPLETED') return res.status(400).json({ error: 'Tour bereits abgeschlossen' })

  const completed = await prisma.tour.update({
    where: { id },
    data: { status: 'COMPLETED', checkedOutAt: new Date(), alarmStage: 0 }
  })

  res.json({ message: '✅ Sicher zurück!', tour: completed })
})

// Alle Touren laden
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const tours = await prisma.tour.findMany({
    where: { userId: req.userId as string },
    orderBy: { createdAt: 'desc' }
  })
  res.json(tours)
})

export default router