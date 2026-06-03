import express, { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'

const router = express.Router()

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const { activity, distanceKm, elevationUp, eta } = req.body
  if (!activity) return res.status(400).json({ error: 'Aktivität fehlt' })
  const tour = await prisma.tour.create({
    data: {
      userId: req.userId as string,
      activity,
      distanceKm: distanceKm ? Number(distanceKm) : null,
      elevationUp: elevationUp ? Number(elevationUp) : null,
      eta: eta ? new Date(eta) : null,
      status: 'PLANNED'
    }
  })
  res.status(201).json(tour)
})

router.post('/:id/start', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params
  const tour = await prisma.tour.findFirst({
    where: { id: id as string, userId: req.userId as string }
  })
  if (!tour) return res.status(404).json({ error: 'Tour nicht gefunden' })
  if (tour.status !== 'PLANNED') return res.status(400).json({ error: 'Tour bereits gestartet' })
  const started = await prisma.tour.update({
    where: { id: id as string },
    data: { status: 'ACTIVE', startedAt: new Date() }
  })
  res.json({ message: 'Tour gestartet — Timer läuft', tour: started })
})

router.post('/:id/checkout', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params
  const tour = await prisma.tour.findFirst({
    where: { id: id as string, userId: req.userId as string }
  })
  if (!tour) return res.status(404).json({ error: 'Tour nicht gefunden' })
  if (tour.status === 'COMPLETED') return res.status(400).json({ error: 'Tour bereits abgeschlossen' })
  const completed = await prisma.tour.update({
    where: { id: id as string },
    data: { status: 'COMPLETED', checkedOutAt: new Date(), alarmStage: 0 }
  })
  res.json({ message: '✅ Sicher zurück!', tour: completed })
})

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const tours = await prisma.tour.findMany({
    where: { userId: req.userId as string },
    orderBy: { createdAt: 'desc' }
  })
  res.json(tours)
})

export default router