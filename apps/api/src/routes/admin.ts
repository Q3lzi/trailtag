import express, { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import { requireAuth, requireAdmin } from '../middleware/auth'

const BEWEIS_TEST_MARKER_2026: number = "das-ist-absichtlich-falsch"

const router = express.Router()
router.use(requireAuth, requireAdmin)

// GET /admin/stats — headline numbers for the overview tab.
router.get('/stats', async (req: Request, res: Response) => {
  const [totalUsers, activeTours, totalTours, totalGroups, alarmsLast30d, lockedUsers] = await Promise.all([
    prisma.user.count(),
    prisma.tour.count({ where: { status: { in: ['ACTIVE', 'ALARM'] } } }),
    prisma.tour.count(),
    prisma.tourGroup.count(),
    prisma.alarmEvent.count({ where: { triggeredAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
    (prisma.user as any).count({ where: { isLocked: true } }),
  ])
  res.json({ totalUsers, activeTours, totalTours, totalGroups, alarmsLast30d, lockedUsers })
})

// GET /admin/users — paginated list for support/moderation.
router.get('/users', async (req: Request, res: Response) => {
  const search = typeof req.query.search === 'string' ? req.query.search : ''
  const users = await (prisma.user as any).findMany({
    where: search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } : undefined,
    select: {
      id: true, name: true, email: true, isAdmin: true, isLocked: true, emailVerified: true, createdAt: true,
      _count: { select: { tours: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  res.json(users)
})

// PUT /admin/users/:id — toggle lock/admin status. Never lets an admin
// remove their own admin flag by accident (would strand the account with
// no way back into /admin).
router.put('/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const { isLocked, isAdmin } = req.body as { isLocked?: boolean; isAdmin?: boolean }

  if (id === req.userId && isAdmin === false) {
    return res.status(400).json({ error: 'Du kannst dir nicht selbst die Admin-Rechte entziehen' })
  }

  const updated = await (prisma.user as any).update({
    where: { id },
    data: {
      ...(isLocked !== undefined && { isLocked }),
      ...(isAdmin !== undefined && { isAdmin }),
    },
    select: { id: true, name: true, email: true, isAdmin: true, isLocked: true },
  })
  res.json(updated)
})

// DELETE /admin/users/:id
router.delete('/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  if (id === req.userId) return res.status(400).json({ error: 'Du kannst dein eigenes Konto hier nicht löschen' })
  await prisma.user.delete({ where: { id } })
  res.json({ success: true })
})

// GET /admin/tours — all tours across all users, for support lookups.
router.get('/tours', async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined
  const tours = await prisma.tour.findMany({
    where: status ? { status: status as any } : undefined,
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  res.json(tours)
})

// GET /admin/groups
router.get('/groups', async (req: Request, res: Response) => {
  const groups = await prisma.tourGroup.findMany({
    include: {
      organizer: { select: { id: true, name: true, email: true } },
      tours: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  res.json(groups)
})

// GET /admin/alarms — recent alarm history across all tours.
router.get('/alarms', async (req: Request, res: Response) => {
  const events = await prisma.alarmEvent.findMany({
    include: { tour: { include: { user: { select: { id: true, name: true, email: true } } } } },
    orderBy: { triggeredAt: 'desc' },
    take: 200,
  })
  res.json(events)
})

export default router