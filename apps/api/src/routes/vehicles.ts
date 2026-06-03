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
  res.status(201).json({
    ...vehicle,
    qrUrl: `http://localhost:3000/r/${vehicle.qrToken}`
  })
})
// GET /vehicles — alle eigenen Fahrzeuge
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const vehicles = await prisma.vehicle.findMany({
    where: { userId: req.userId as string }
  })
  res.json(vehicles)
})
export default router