import express, { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
const router = express.Router()

// GET /profile
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId as string },
    include: { emergencyContacts: { orderBy: { isPrimary: 'desc' } } }
  })
  if (!user) return res.status(404).json({ error: 'User nicht gefunden' })
  const { passwordHash, ...safeUser } = user
  res.json(safeUser)
})

// PUT /profile
router.put('/', requireAuth, async (req: Request, res: Response) => {
  const { name, phone, birthYear, bloodType, allergies, medications, medicalNotes } = req.body
  const user = await prisma.user.update({
    where: { id: req.userId as string },
    data: {
      name: name || undefined,
      phone: phone || undefined,
      birthYear: birthYear ? Number(birthYear) : undefined,
      bloodType: bloodType || undefined,
      allergies: allergies || undefined,
      medications: medications || undefined,
      medicalNotes: medicalNotes || undefined,
    }
  })
  const { passwordHash, ...safeUser } = user
  res.json(safeUser)
})

// POST /profile/emergency-contacts
router.post('/emergency-contacts', requireAuth, async (req: Request, res: Response) => {
  const { name, phone, relation, isPrimary } = req.body
  if (!name || !phone) return res.status(400).json({ error: 'Name und Telefon sind Pflichtfelder' })
  if (isPrimary) {
    await prisma.emergencyContact.updateMany({
      where: { userId: req.userId as string },
      data: { isPrimary: false }
    })
  }
  const contact = await prisma.emergencyContact.create({
    data: { userId: req.userId as string, name, phone, relation: relation || null, isPrimary: isPrimary ?? false }
  })
  res.status(201).json(contact)
})

// PUT /profile/emergency-contacts/:id
router.put('/emergency-contacts/:id', requireAuth, async (req: Request, res: Response) => {
  const id = req.params['id'] as string
  const { name, phone, relation } = req.body
  const contact = await prisma.emergencyContact.findFirst({
    where: { id, userId: req.userId as string }
  })
  if (!contact) return res.status(404).json({ error: 'Kontakt nicht gefunden' })
  const updated = await prisma.emergencyContact.update({
    where: { id },
    data: { name, phone, relation: relation || null }
  })
  res.json(updated)
})

// DELETE /profile/emergency-contacts/:id
router.delete('/emergency-contacts/:id', requireAuth, async (req: Request, res: Response) => {
  const id = req.params['id'] as string
  const contact = await prisma.emergencyContact.findFirst({
    where: { id, userId: req.userId as string }
  })
  if (!contact) return res.status(404).json({ error: 'Kontakt nicht gefunden' })
  await prisma.emergencyContact.delete({ where: { id } })
  res.json({ message: 'Kontakt gelöscht' })
})


// POST /profile/push-token — save Expo push token
router.post('/push-token', requireAuth, async (req: Request, res: Response) => {
  const { token } = req.body
  if (!token) return res.status(400).json({ error: 'Token required' })
  await prisma.user.update({
    where: { id: req.userId as string },
    data: { expoPushToken: token }
  })
  res.json({ ok: true })
})

export default router