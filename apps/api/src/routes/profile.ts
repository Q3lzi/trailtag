import express, { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'

const router = express.Router()

// GET /profile
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId as string },
    select: {
      id: true, email: true, name: true, phone: true, birthYear: true,
      bloodType: true, allergies: true, medications: true, medicalNotes: true,
      privacyShowName: true, privacyShowPhone: true, privacyShowMedical: true,
      privacyShowContacts: true, privacyShowGps: true, privacyShowNotes: true,
      pushNotifyFriendsStart: true, pushNotifyFriendsEnd: true, pushNotifyFriendsAlarm: true,
      emergencyContacts: { orderBy: { isPrimary: 'desc' } }
    }
  })
  if (!user) return res.status(404).json({ error: 'User nicht gefunden' })
  res.json(user)
})

// PUT /profile
router.put('/', requireAuth, async (req: Request, res: Response) => {
  const { name, phone, birthYear, bloodType, allergies, medications, medicalNotes } = req.body
  const user = await prisma.user.update({
    where: { id: req.userId as string },
    data: {
      name, phone, birthYear: birthYear ? Number(birthYear) : null,
      bloodType, allergies, medications, medicalNotes,
      ...(req.body.privacyShowName !== undefined && { privacyShowName: req.body.privacyShowName }),
      ...(req.body.privacyShowPhone !== undefined && { privacyShowPhone: req.body.privacyShowPhone }),
      ...(req.body.privacyShowMedical !== undefined && { privacyShowMedical: req.body.privacyShowMedical }),
      ...(req.body.privacyShowContacts !== undefined && { privacyShowContacts: req.body.privacyShowContacts }),
      ...(req.body.privacyShowGps !== undefined && { privacyShowGps: req.body.privacyShowGps }),
      ...(req.body.privacyShowNotes !== undefined && { privacyShowNotes: req.body.privacyShowNotes }),
      ...(req.body.pushNotifyFriendsStart !== undefined && { pushNotifyFriendsStart: Boolean(req.body.pushNotifyFriendsStart) }),
      ...(req.body.pushNotifyFriendsEnd !== undefined && { pushNotifyFriendsEnd: Boolean(req.body.pushNotifyFriendsEnd) }),
      ...(req.body.pushNotifyFriendsAlarm !== undefined && { pushNotifyFriendsAlarm: Boolean(req.body.pushNotifyFriendsAlarm) }),
    }
  })
  res.json(user)
})

// POST /profile/emergency-contacts
router.post('/emergency-contacts', requireAuth, async (req: Request, res: Response) => {
  const { name, phone, relation, isPrimary } = req.body
  if (!name || !phone) return res.status(400).json({ error: 'Name und Telefon erforderlich' })
  const contact = await prisma.emergencyContact.create({
    data: { userId: req.userId as string, name, phone, relation: relation || null, isPrimary: isPrimary ?? false }
  })
  res.json(contact)
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

// POST /profile/push-token
router.post('/push-token', requireAuth, async (req: Request, res: Response) => {
  const { token } = req.body
  if (!token) return res.status(400).json({ error: 'Token required' })
  await (prisma.user as any).update({
    where: { id: req.userId as string },
    data: { expoPushToken: token }
  })
  res.json({ ok: true })
})

export default router