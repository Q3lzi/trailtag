import express, { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'

const router = express.Router()

// GET /friends — eigene Freunde + pendente Anfragen + Gruppen
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId as string
  try {
    const [accepted, pending, groups] = await Promise.all([
      (prisma as any).friend.findMany({
        where: { OR: [{ initiatorId: userId }, { receiverId: userId }], status: 'ACCEPTED' },
        include: {
          initiator: { select: { id: true, name: true, phone: true } },
          receiver: { select: { id: true, name: true, phone: true } },
          group: true,
        }
      }),
      (prisma as any).friend.findMany({
        where: { receiverId: userId, status: 'PENDING' },
        include: { initiator: { select: { id: true, name: true, phone: true } } }
      }),
      (prisma as any).friendGroup.findMany({ where: { userId } })
    ])
    // Get active tours for each friend
    const friendIds = accepted.map((f: any) => f.initiatorId === userId ? f.receiverId : f.initiatorId)
    const activeTours = friendIds.length > 0 ? await prisma.tour.findMany({
      where: { userId: { in: friendIds }, status: { in: ['ACTIVE', 'ALARM'] } },
      select: { userId: true, id: true, activity: true, eta: true, status: true, startedAt: true }
    }) : []

    const friends = accepted.map((f: any) => {
      const isMine = f.initiatorId === userId
      const other = isMine ? f.receiver : f.initiator
      const activeTour = activeTours.find((t: any) => t.userId === other.id) ?? null
      return { friendshipId: f.id, groupId: f.groupId, group: f.group, activeTour, ...other }
    })
    res.json({ friends, pending, groups })
  } catch {
    res.json({ friends: [], pending: [], groups: [] })
  }
})

// GET /friends/qr — eigener QR-Code (generiert falls noch nicht vorhanden)
router.get('/qr', requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId as string
  try {
    let user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, qrCode: true } as any
    }) as any
    // Generate qrCode for existing users who don't have one
    if (user && !user.qrCode) {
      const { randomUUID } = await import('crypto')
      user = await (prisma.user as any).update({
        where: { id: userId },
        data: { qrCode: randomUUID() },
        select: { qrCode: true, name: true }
      })
    }
    res.json(user ?? { qrCode: userId, name: null })
  } catch (err: any) {
    console.error('friends/qr error:', err.message)
    res.json({ qrCode: userId, name: null })
  }
})

// POST /friends/add — via QR Code
router.post('/add', requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId as string
  const { qrCode } = req.body
  if (!qrCode) return res.status(400).json({ error: 'qrCode erforderlich' })
  try {
    // Normalize: lowercase, strip hyphens from short codes
    const qrNorm = qrCode.toLowerCase().trim()
    // Use raw SQL with ILIKE for reliable case-insensitive search
    const results: any[] = await prisma.$queryRaw`
      SELECT id, name, phone FROM "User"
      WHERE LOWER("qrCode") LIKE LOWER(${qrNorm + '%'})
      LIMIT 1
    `
    let target = results[0] ?? null
    if (!target) return res.status(404).json({ error: 'Benutzer nicht gefunden. Prüfe den Code.' })
    if (target.id === userId) return res.status(400).json({ error: 'Du kannst dich nicht selbst hinzufügen' })
    const existing = await (prisma as any).friend.findFirst({
      where: { OR: [
        { initiatorId: userId, receiverId: target.id },
        { initiatorId: target.id, receiverId: userId }
      ]}
    })
    if (existing) return res.status(400).json({ error: 'Bereits verbunden oder Anfrage ausstehend' })
    const friend = await (prisma as any).friend.create({
      data: { initiatorId: userId, receiverId: target.id, status: 'PENDING' }
    })
    res.json({ friend, target })
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Fehler beim Hinzufügen' })
  }
})

// POST /friends/:id/accept
router.post('/:id/accept', requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId as string
  const id = req.params['id'] as string
  try {
    const f = await (prisma as any).friend.findFirst({ where: { id, receiverId: userId, status: 'PENDING' } })
    if (!f) return res.status(404).json({ error: 'Anfrage nicht gefunden' })
    const updated = await (prisma as any).friend.update({ where: { id }, data: { status: 'ACCEPTED' } })
    res.json(updated)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /friends/:id/decline
router.post('/:id/decline', requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId as string
  const id = req.params['id'] as string
  await (prisma as any).friend.deleteMany({ where: { id, receiverId: userId } })
  res.json({ ok: true })
})

// DELETE /friends/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId as string
  const id = req.params['id'] as string
  await (prisma as any).friend.deleteMany({
    where: { id, OR: [{ initiatorId: userId }, { receiverId: userId }] }
  })
  res.json({ ok: true })
})

// POST /friends/groups
router.post('/groups', requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId as string
  const { name, color } = req.body
  if (!name) return res.status(400).json({ error: 'Name erforderlich' })
  try {
    const group = await (prisma as any).friendGroup.create({
      data: { userId, name, color: color ?? '#2c694e' }
    })
    res.json(group)
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Fehler beim Erstellen' })
  }
})

// PUT /friends/:id/group
router.put('/:id/group', requireAuth, async (req: Request, res: Response) => {
  const id = req.params['id'] as string
  const { groupId } = req.body
  const updated = await (prisma as any).friend.update({ where: { id }, data: { groupId: groupId ?? null } })
  res.json(updated)
})


// PUT /friends/groups/:id
router.put('/groups/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId as string
  const id = req.params['id'] as string
  const { name, color } = req.body
  try {
    const group = await (prisma as any).friendGroup.findFirst({ where: { id, userId } })
    if (!group) return res.status(404).json({ error: 'Gruppe nicht gefunden' })
    const updated = await (prisma as any).friendGroup.update({ where: { id }, data: { name, color } })
    res.json(updated)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /friends/groups/:id
router.delete('/groups/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId as string
  const id = req.params['id'] as string
  try {
    await (prisma as any).friendGroup.deleteMany({ where: { id, userId } })
    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router