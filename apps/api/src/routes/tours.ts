import { sendExpoPush, sendPushToFriends } from '../lib/push'
import { broadcastToFriends, broadcastToTourGroup } from '../lib/realtime'
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
    companions,
    distanceKm,
    elevationUp,
    bufferMinutes,
    parkingLocation,
    parkingLat,
    parkingLng,
    notes,
    overnightStops,
    waypoints,
    startLat,
    startLng,
    vehicleId,
    emergencyContactIds,
  } = req.body

  if (!activity) return res.status(400).json({ error: 'Aktivität fehlt' })

    // Alte aktive/alarm Touren abschliessen
await prisma.tour.updateMany({
  where: {
    userId: req.userId as string,
    status: { in: ['ACTIVE', 'ALARM'] }
  },
  data: { status: 'COMPLETED', checkedOutAt: new Date() }
})

  const tour = await prisma.tour.create({
    data: {
      userId: req.userId as string,
      activity,
      routeName: routeName || null,
      difficulty: difficulty || null,
      persons: persons ? Number(persons) : 1,
      companions: companions ?? null,
      distanceKm: distanceKm ? Number(distanceKm) : null,
      elevationUp: elevationUp ? Number(elevationUp) : null,
      bufferMinutes: bufferMinutes ? Number(bufferMinutes) : 15,
      parkingLocation: parkingLocation || null,
      parkingLat: parkingLat != null ? Number(parkingLat) : null,
      parkingLng: parkingLng != null ? Number(parkingLng) : null,
      notes: notes || null,
      overnightStops: overnightStops ?? null,
      waypoints: waypoints ?? null,
      startLat: startLat ? Number(startLat) : null,
      startLng: startLng ? Number(startLng) : null,
      lastLat: startLat ? Number(startLat) : null,
      lastLng: startLng ? Number(startLng) : null,
      vehicleId: vehicleId || null,
      emergencyContactIds: Array.isArray(emergencyContactIds) ? emergencyContactIds.slice(0, 3) : null,
      status: 'PLANNED',
    }
  })

  res.status(201).json(tour)
})

// Tour bearbeiten (nur solange sie noch nicht gestartet wurde)
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string
  const existing = await prisma.tour.findFirst({ where: { id, userId: req.userId as string } })
  if (!existing) return res.status(404).json({ error: 'Tour nicht gefunden' })
  if (existing.status !== 'PLANNED') {
    return res.status(400).json({ error: 'Nur geplante Touren können bearbeitet werden' })
  }

  const {
    activity, routeName, difficulty, persons, companions, distanceKm, elevationUp,
    bufferMinutes, parkingLocation, parkingLat, parkingLng, notes, overnightStops,
    startLat, startLng, vehicleId, waypoints, emergencyContactIds,
  } = req.body

  const updated = await prisma.tour.update({
    where: { id },
    data: {
      ...(activity !== undefined && { activity }),
      ...(routeName !== undefined && { routeName: routeName || null }),
      ...(difficulty !== undefined && { difficulty: difficulty || null }),
      ...(persons !== undefined && { persons: Number(persons) }),
      ...(companions !== undefined && { companions: companions ?? null }),
      ...(distanceKm !== undefined && { distanceKm: distanceKm ? Number(distanceKm) : null }),
      ...(elevationUp !== undefined && { elevationUp: elevationUp ? Number(elevationUp) : null }),
      ...(bufferMinutes !== undefined && { bufferMinutes: Number(bufferMinutes) }),
      ...(parkingLocation !== undefined && { parkingLocation: parkingLocation || null }),
      ...(parkingLat !== undefined && { parkingLat: parkingLat != null ? Number(parkingLat) : null }),
      ...(parkingLng !== undefined && { parkingLng: parkingLng != null ? Number(parkingLng) : null }),
      ...(notes !== undefined && { notes: notes || null }),
      ...(overnightStops !== undefined && { overnightStops: overnightStops ?? null }),
      ...(waypoints !== undefined && { waypoints: waypoints ?? null }),
      ...(startLat !== undefined && { startLat: startLat != null ? Number(startLat) : null, lastLat: startLat != null ? Number(startLat) : null }),
      ...(startLng !== undefined && { startLng: startLng != null ? Number(startLng) : null, lastLng: startLng != null ? Number(startLng) : null }),
      ...(vehicleId !== undefined && { vehicleId: vehicleId || null }),
      ...(emergencyContactIds !== undefined && { emergencyContactIds: Array.isArray(emergencyContactIds) ? emergencyContactIds.slice(0, 3) : null }),
    }
  })

  res.json(updated)
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

  // Complete any other active/alarm tours for this user before starting new one
  await prisma.tour.updateMany({
    where: {
      userId: req.userId as string,
      status: { in: ['ACTIVE', 'ALARM'] },
      id: { not: id }
    },
    data: { status: 'COMPLETED', checkedOutAt: new Date() }
  })

  const started = await prisma.tour.update({
    where: { id },
    data: {
      status: 'ACTIVE',
      startedAt: new Date(),
      eta: eta ? new Date(eta) : null,
    }
  })

  // Push notifications
  try {
    const u = await (prisma.user as any).findUnique({ where: { id: req.userId as string }, select: { name: true, expoPushToken: true } })
    if (u?.expoPushToken) await sendExpoPush(u.expoPushToken, '🏔 Tour gestartet', 'Safety-Timer läuft. Komm sicher zurück!')
    await sendPushToFriends(prisma, req.userId as string, '🏔 Tour gestartet', `${u?.name ?? 'Dein Freund'} ist auf Wanderung`, { tourId: started.id }, 'start')
    const startEvent = { type: 'tour_status_change' as const, friendId: req.userId as string, tourId: started.id, status: 'ACTIVE', activity: started.activity ?? undefined, eta: started.eta?.toISOString() ?? null }
    broadcastToFriends(req.userId as string, startEvent)
    if (started.groupId) broadcastToTourGroup(started.groupId, req.userId as string, startEvent)
  } catch {}
  res.json({ message: 'Tour gestartet — Timer läuft', tour: started })
})


// Tour löschen
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = req.params['id'] as string
  const tour = await prisma.tour.findFirst({ where: { id, userId: req.userId as string } })
  if (!tour) return res.status(404).json({ error: 'Tour nicht gefunden' })
  await prisma.tourLocation.deleteMany({ where: { tourId: id } })
  await prisma.alarmEvent.deleteMany({ where: { tourId: id } })
  await prisma.tour.delete({ where: { id } })
  res.json({ message: 'Tour gelöscht' })
})

// GET /tours/:id — einzelne Tour mit Locations
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = req.params['id'] as string
  const tour = await prisma.tour.findFirst({
    where: { id, userId: req.userId as string },
    include: {
      locations: { orderBy: { timestamp: 'asc' }, take: 500 },
      vehicle: true,
    }
  })
  if (!tour) return res.status(404).json({ error: 'Tour nicht gefunden' })
  res.json(tour)
})


// GPS Standort updaten
router.post('/:id/location', requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string
  const { lat, lng, ele, accuracy } = req.body
  if (!lat || !lng) return res.status(400).json({ error: 'lat und lng fehlen' })
  const tour = await prisma.tour.findFirst({
    where: { id, userId: req.userId as string }
  })
  if (!tour) return res.status(404).json({ error: 'Tour nicht gefunden' })
  if (tour.status !== 'ACTIVE' && tour.status !== 'ALARM') return res.status(400).json({ error: 'Tour nicht aktiv' })

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
        accuracy: accuracy ? Number(accuracy) : null,
      }
    })
  ])

  // Realtime: notify friends — and, if this tour is part of a shared
  // hike, the other group participants too (independent of friendship).
  const locationEvent = {
    type: 'location_update' as const,
    friendId: req.userId as string,
    tourId: id,
    lat: Number(lat),
    lng: Number(lng),
    timestamp: new Date().toISOString(),
  }
  broadcastToFriends(req.userId as string, locationEvent)
  if (tour.groupId) broadcastToTourGroup(tour.groupId, req.userId as string, locationEvent)

  res.json({ message: 'Standort aktualisiert', tour: updated })
})


//Tour planen
router.post('/:id/plan', requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string
  const { eta } = req.body
  const tour = await prisma.tour.findFirst({ where: { id, userId: req.userId as string } })
  if (!tour) return res.status(404).json({ error: 'Tour nicht gefunden' })
  const updated = await prisma.tour.update({
    where: { id },
    data: { eta: eta ? new Date(eta) : null }
  })
  res.json({ message: 'Tour geplant', tour: updated })
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

  // Push notifications
  try {
    const u = await (prisma.user as any).findUnique({ where: { id: req.userId as string }, select: { name: true, expoPushToken: true } })
    if (u?.expoPushToken) await sendExpoPush(u.expoPushToken, '✅ Sicher zurück', 'Du hast erfolgreich ausgecheckt.')
    await sendPushToFriends(prisma, req.userId as string, '✅ Sicher zurück', `${u?.name ?? 'Dein Freund'} ist sicher zurückgekehrt`, undefined, 'end')
    const completeEvent = { type: 'tour_status_change' as const, friendId: req.userId as string, tourId: completed.id, status: 'COMPLETED' }
    broadcastToFriends(req.userId as string, completeEvent)
    if (completed.groupId) broadcastToTourGroup(completed.groupId, req.userId as string, completeEvent)
  } catch {}
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