import express, { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'

const router = express.Router()

// GET /friends — eigene Freunde + pendente Anfragen
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId as string
  const [accepted, pending, groups] = await Promise.all([
    prisma.friend.findMany({
      where: { OR: [{ initiatorId: userId }, { receiverId: userId }], status: 'ACCEPTED' },
      include: {
        initiator: { select: { id: true, name: true, phone: true, qrCode: true } },
        receiver:  { select: { id: true, name: true, phone: true, qrCode: true } },
        group: true,
      }
    }),
    prisma.friend.findMany({
      where: { receiverId: userId, status: 'PENDING' },
      include: { initiator: { select: { id: true, name: true, phone: true } } }
    }),
    prisma.friendGroup.findMany({ where: { userId } })
  ])

  // Normalize: always return the "other" person
  const friends = accepted.map((f: any) => {
    const isMine = f.initiatorId === userId
    const other = isMine ? f.receiver : f.initiator
    return { friendshipId: f.id, groupId: f.groupId, group: f.group, ...other }
  })

  res.json({ friends, pending, groups })
})

// POST /friends/add — via QR Code (qrCode = UUID im Profil)
router.post('/add', requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId as string
  const { qrCode } = req.body
  if (!qrCode) return res.status(400).json({ error: 'qrCode erforderlich' })

  // Find user by qrCode
  const target = await (prisma.user as any).findUnique({
    where: { qrCode },
    select: { id: true, name: true, phone: true }
  })
  if (!target) return res.status(404).json({ error: 'Benutzer nicht gefunden' })
  if (target.id === userId) return res.status(400).json({ error: 'Du kannst dich nicht selbst hinzufügen' })

  // Check existing
  const existing = await prisma.friend.findFirst({
    where: { OR: [
      { initiatorId: userId, receiverId: target.id },
      { initiatorId: target.id, receiverId: userId }
    ]}
  })
  if (existing) return res.status(400).json({ error: 'Bereits verbunden oder Anfrage ausstehend' })

  const friend = await prisma.friend.create({
    data: { initiatorId: userId, receiverId: target.id, status: 'PENDING' }
  })
  res.json({ friend, target })
})

// POST /friends/:id/accept
router.post('/:id/accept', requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId as string
  const id = req.params['id'] as string
  const f = await prisma.friend.findFirst({ where: { id, receiverId: userId, status: 'PENDING' } })
  if (!f) return res.status(404).json({ error: 'Anfrage nicht gefunden' })
  const updated = await prisma.friend.update({ where: { id }, data: { status: 'ACCEPTED' } })
  res.json(updated)
})

// POST /friends/:id/decline
router.post('/:id/decline', requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId as string
  const id = req.params['id'] as string
  await prisma.friend.deleteMany({ where: { id, receiverId: userId } })
  res.json({ ok: true })
})

// DELETE /friends/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId as string
  const id = req.params['id'] as string
  await prisma.friend.deleteMany({
    where: { id, OR: [{ initiatorId: userId }, { receiverId: userId }] }
  })
  res.json({ ok: true })
})

// POST /friends/groups — Gruppe erstellen
router.post('/groups', requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId as string
  const { name, color } = req.body
  const group = await prisma.friendGroup.create({ data: { userId, name, color: color ?? '#2c694e' } })
  res.json(group)
})

// PUT /friends/:id/group — Freund einer Gruppe zuweisen
router.put('/:id/group', requireAuth, async (req: Request, res: Response) => {
  const id = req.params['id'] as string
  const { groupId } = req.body
  const updated = await prisma.friend.update({ where: { id }, data: { groupId: groupId ?? null } })
  res.json(updated)
})

// GET /friends/qr — eigener QR-Code
router.get('/qr', requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId as string
  const user = await (prisma.user as any).findUnique({
    where: { id: userId },
    select: { qrCode: true, name: true }
  })
  res.json(user)
})

export default router