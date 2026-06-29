import express, { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { broadcastToFriends } from '../lib/realtime'

const router = express.Router()

// POST /tour-groups — organizer creates a shared hike and invites friends.
// The organizer does NOT automatically get a Tour in the group here; they
// create/attach their own Tour the same way as any participant, via
// POST /tour-groups/:id/join — keeping exactly one path for "how a Tour
// becomes part of a group" rather than a special case for the organizer.
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const { routeName, activity, inviteeIds } = req.body as { routeName?: string; activity?: string; inviteeIds?: string[] }

  const group = await prisma.tourGroup.create({
    data: {
      organizerId: req.userId as string,
      routeName: routeName || null,
      activity: (activity as any) || null,
    }
  })

  if (Array.isArray(inviteeIds) && inviteeIds.length > 0) {
    // Only invite people who are actually friends — prevents inviting
    // arbitrary user ids guessed/scraped from elsewhere.
    const friendships = await prisma.friend.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { initiatorId: req.userId as string, receiverId: { in: inviteeIds } },
          { receiverId: req.userId as string, initiatorId: { in: inviteeIds } },
        ]
      }
    })
    const validFriendIds = new Set(
      friendships.map((f) => (f.initiatorId === req.userId ? f.receiverId : f.initiatorId))
    )
    const toInvite = inviteeIds.filter((id) => validFriendIds.has(id))

    await prisma.tourGroupInvite.createMany({
      data: toInvite.map((inviteeId) => ({ groupId: group.id, inviteeId })),
      skipDuplicates: true,
    })

    for (const inviteeId of toInvite) {
      await broadcastToFriends(inviteeId, {
        type: 'tour_group_invite',
        groupId: group.id,
        fromUserId: req.userId as string,
      }).catch(() => {})
    }
  }

  res.status(201).json(group)
})

// GET /tour-groups/:id — group details including all participant tours'
// live-relevant fields (position, status) — but only for accepted
// participants, never the full tour of someone who hasn't joined.
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string
  const group = await prisma.tourGroup.findUnique({
    where: { id },
    include: {
      organizer: { select: { id: true, name: true } },
      tours: {
        include: { user: { select: { id: true, name: true } } }
      },
      invites: {
        include: { invitee: { select: { id: true, name: true } } }
      },
    }
  })
  if (!group) return res.status(404).json({ error: 'Gruppe nicht gefunden' })

  // Access check: must be organizer, have an accepted invite, or already
  // have a Tour attached to this group.
  const isOrganizer = group.organizerId === req.userId
  const isParticipant = group.tours.some((t) => t.userId === req.userId)
  const isInvited = group.invites.some((i) => i.inviteeId === req.userId)
  if (!isOrganizer && !isParticipant && !isInvited) {
    return res.status(403).json({ error: 'Kein Zugriff auf diese Gruppe' })
  }

  res.json(group)
})

// GET /tour-groups — groups the user organizes, participates in, or is invited to
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId as string
  const groups = await prisma.tourGroup.findMany({
    where: {
      OR: [
        { organizerId: userId },
        { tours: { some: { userId } } },
        { invites: { some: { inviteeId: userId } } },
      ]
    },
    include: {
      organizer: { select: { id: true, name: true } },
      tours: { include: { user: { select: { id: true, name: true } } } },
      invites: { include: { invitee: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: 'desc' }
  })
  res.json(groups)
})

// POST /tour-groups/:id/join — attach the caller's own existing (PLANNED)
// Tour to this group. The Tour keeps its own ETA/contacts; only routeName
// gets aligned with the group's so participants share the same context.
router.post('/:id/join', requireAuth, async (req: Request, res: Response) => {
  const groupId = req.params.id as string
  const { tourId } = req.body as { tourId: string }
  if (!tourId) return res.status(400).json({ error: 'tourId ist erforderlich' })

  const group = await prisma.tourGroup.findUnique({ where: { id: groupId } })
  if (!group) return res.status(404).json({ error: 'Gruppe nicht gefunden' })

  const tour = await prisma.tour.findFirst({ where: { id: tourId, userId: req.userId as string } })
  if (!tour) return res.status(404).json({ error: 'Tour nicht gefunden' })
  if (tour.status !== 'PLANNED') {
    return res.status(400).json({ error: 'Nur geplante Touren können einer Gruppe beitreten' })
  }

  const updated = await prisma.tour.update({
    where: { id: tourId },
    data: {
      groupId,
      routeName: tour.routeName || group.routeName,
      activity: (group.activity as any) || tour.activity,
    }
  })

  // Mark any pending invite for this user as accepted.
  await prisma.tourGroupInvite.updateMany({
    where: { groupId, inviteeId: req.userId as string, status: 'PENDING' },
    data: { status: 'ACCEPTED' }
  })

  res.json(updated)
})

// POST /tour-groups/:id/invites/:inviteId/decline
router.post('/:id/invites/:inviteId/decline', requireAuth, async (req: Request, res: Response) => {
  const { inviteId } = req.params
  const invite = await prisma.tourGroupInvite.findFirst({
    where: { id: inviteId as string, inviteeId: req.userId as string }
  })
  if (!invite) return res.status(404).json({ error: 'Einladung nicht gefunden' })
  await prisma.tourGroupInvite.update({ where: { id: invite.id }, data: { status: 'DECLINED' } })
  res.json({ success: true })
})

// POST /tour-groups/:id/invite — organizer invites more friends after creation
router.post('/:id/invite', requireAuth, async (req: Request, res: Response) => {
  const groupId = req.params.id as string
  const { inviteeIds } = req.body as { inviteeIds: string[] }
  const group = await prisma.tourGroup.findFirst({ where: { id: groupId, organizerId: req.userId as string } })
  if (!group) return res.status(404).json({ error: 'Gruppe nicht gefunden oder keine Berechtigung' })

  const friendships = await prisma.friend.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [
        { initiatorId: req.userId as string, receiverId: { in: inviteeIds } },
        { receiverId: req.userId as string, initiatorId: { in: inviteeIds } },
      ]
    }
  })
  const validFriendIds = new Set(
    friendships.map((f) => (f.initiatorId === req.userId ? f.receiverId : f.initiatorId))
  )
  const toInvite = inviteeIds.filter((id) => validFriendIds.has(id))

  await prisma.tourGroupInvite.createMany({
    data: toInvite.map((inviteeId) => ({ groupId, inviteeId })),
    skipDuplicates: true,
  })

  res.json({ success: true, invited: toInvite.length })
})

export default router