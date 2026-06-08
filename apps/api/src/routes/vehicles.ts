import express, { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
const router = express.Router()

// POST /vehicles — Fahrzeug anlegen
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const { plate, make, model, color } = req.body
  const vehicle = await prisma.vehicle.create({
    data: { userId: req.userId as string, plate, make, model, color }
  })
  res.status(201).json(vehicle)
})

// GET /vehicles — alle eigenen Fahrzeuge
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const vehicles = await prisma.vehicle.findMany({
    where: { userId: req.userId as string }
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
  const updated = await prisma.vehicle.update({
    where: { id },
    data: { plate, make, model, color }
  })
  res.json(updated)
})

// DELETE /vehicles/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = req.params['id'] as string
  const vehicle = await prisma.vehicle.findFirst({
    where: { id, userId: req.userId as string }
  })
  if (!vehicle) return res.status(404).json({ error: 'Fahrzeug nicht gefunden' })
  await prisma.vehicle.delete({ where: { id } })
  res.json({ success: true })
})

export default router