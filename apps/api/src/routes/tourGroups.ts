import express, { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { broadcastToFriends } from '../lib/realtime'

const router = express.Router()

// POST /tour-groups — organizer creates a shared hike, with the full route
// living on the group itself (so it's visible to invitees before any of
// them has created their own Tour), plus a chosen start mode and a
// suggested return time participants can accept or adjust.
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const {
    routeName, activity, inviteeIds, startMode, suggestedEta, suggestedStartAt,
    startLat, startLng, gpxTrack, waypoints, overnightStops,
    parkingLocation, parkingLat, parkingLng, distanceKm, elevationUp,
    difficulty, notes,
  } = req.body as {
    routeName?: string; activity?: string; inviteeIds?: string[];
    startMode?: 'EACH_OWN' | 'ORGANIZER_STARTS_ALL'; suggestedEta?: string; suggestedStartAt?: string;
    startLat?: number; startLng?: number; gpxTrack?: any; waypoints?: any; overnightStops?: any;
    parkingLocation?: string; parkingLat?: number; parkingLng?: number; distanceKm?: number; elevationUp?: number;
    difficulty?: string; notes?: string;
  }

  const group = await prisma.tourGroup.create({
    data: {
      organizerId: req.userId as string,
      routeName: routeName || null,
      activity: (activity as any) || null,
      startMode: startMode === 'ORGANIZER_STARTS_ALL' ? 'ORGANIZER_STARTS_ALL' : 'EACH_OWN',
      suggestedEta: suggestedEta ? new Date(suggestedEta) : null,
      suggestedStartAt: suggestedStartAt ? new Date(suggestedStartAt) : null,
      startLat: startLat ?? null,
      startLng: startLng ?? null,
      gpxTrack: gpxTrack ?? null,
      waypoints: waypoints ?? null,
      overnightStops: overnightStops ?? null,
      parkingLocation: parkingLocation || null,
      difficulty: difficulty || null,
      notes: notes || null,
      parkingLat: parkingLat ?? null,
      parkingLng: parkingLng ?? null,
      distanceKm: distanceKm ?? null,
      elevationUp: elevationUp ?? null,
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

// PUT /tour-groups/:id — organizer-only, lets difficulty/notes (and other
// route metadata) be added or corrected after creation, since planning a
// shared hike isn't always finished in one sitting.
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string
  const group = await prisma.tourGroup.findFirst({ where: { id, organizerId: req.userId as string } })
  if (!group) return res.status(404).json({ error: 'Gruppe nicht gefunden oder keine Berechtigung' })

  const { routeName, difficulty, notes, parkingLocation, suggestedEta, suggestedStartAt } = req.body as {
    routeName?: string; difficulty?: string; notes?: string; parkingLocation?: string;
    suggestedEta?: string; suggestedStartAt?: string;
  }

  const updated = await prisma.tourGroup.update({
    where: { id },
    data: {
      ...(routeName !== undefined && { routeName: routeName || null }),
      ...(difficulty !== undefined && { difficulty: difficulty || null }),
      ...(notes !== undefined && { notes: notes || null }),
      ...(parkingLocation !== undefined && { parkingLocation: parkingLocation || null }),
      ...(suggestedEta !== undefined && { suggestedEta: suggestedEta ? new Date(suggestedEta) : null }),
      ...(suggestedStartAt !== undefined && { suggestedStartAt: suggestedStartAt ? new Date(suggestedStartAt) : null }),
    }
  })
  res.json(updated)
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
// POST /tour-groups/:id/join — creates the caller's own Tour, pre-filled
// from the group's shared route, with only the genuinely individual fields
// (return time, vehicle, optional own start point) coming from the request.
// This replaces the old "attach an existing tour" flow — there's no
// separate wizard step where someone re-enters a route that already exists
// on the group.
router.post('/:id/join', requireAuth, async (req: Request, res: Response) => {
  const groupId = req.params.id as string
  const { eta, vehicleId, startLat, startLng } = req.body as {
    eta?: string; vehicleId?: string | null; startLat?: number; startLng?: number;
  }

  const group = await prisma.tourGroup.findUnique({ where: { id: groupId } })
  if (!group) return res.status(404).json({ error: 'Gruppe nicht gefunden' })

  const existing = await prisma.tour.findFirst({ where: { groupId, userId: req.userId as string } })
  if (existing) return res.status(400).json({ error: 'Du bist dieser Tour bereits beigetreten' })

  const tour = await prisma.tour.create({
    data: {
      userId: req.userId as string,
      groupId,
      activity: group.activity ?? 'ANDERE',
      routeName: group.routeName,
      distanceKm: group.distanceKm,
      elevationUp: group.elevationUp,
      parkingLocation: group.parkingLocation,
      parkingLat: group.parkingLat,
      parkingLng: group.parkingLng,
      waypoints: group.waypoints as any,
      overnightStops: group.overnightStops as any,
      gpxTrack: group.gpxTrack as any,
      startLat: startLat ?? group.startLat,
      startLng: startLng ?? group.startLng,
      lastLat: startLat ?? group.startLat,
      lastLng: startLng ?? group.startLng,
      vehicleId: vehicleId ?? null,
      eta: eta ? new Date(eta) : group.suggestedEta,
    }
  })

  // Mark any pending invite for this user as accepted.
  await prisma.tourGroupInvite.updateMany({
    where: { groupId, inviteeId: req.userId as string, status: 'PENDING' },
    data: { status: 'ACCEPTED' }
  })

  res.status(201).json(tour)
})

// POST /tour-groups/:id/start — begins the safety timer. Behaviour depends
// on the group's startMode: EACH_OWN lets any participant start only their
// own tour; ORGANIZER_STARTS_ALL restricts this to the organizer, who
// starts every joined participant's tour in one action.
router.post('/:id/start', requireAuth, async (req: Request, res: Response) => {
  const groupId = req.params.id as string
  const { eta } = req.body as { eta?: string }
  const group = await prisma.tourGroup.findUnique({ where: { id: groupId }, include: { tours: true } })
  if (!group) return res.status(404).json({ error: 'Gruppe nicht gefunden' })

  if (group.startMode === 'ORGANIZER_STARTS_ALL') {
    if (group.organizerId !== req.userId) {
      return res.status(403).json({ error: 'Nur der Organisator kann diese Tour für alle starten' })
    }
    const plannedTours = group.tours.filter((t) => t.status === 'PLANNED')
    await prisma.tour.updateMany({
      where: { id: { in: plannedTours.map((t) => t.id) } },
      data: { status: 'ACTIVE', startedAt: new Date() }
    })
    await prisma.tourGroup.update({ where: { id: groupId }, data: { startedAt: new Date() } })
    res.json({ started: plannedTours.length })
  } else {
    const myTour = group.tours.find((t) => t.userId === req.userId)
    if (!myTour) return res.status(404).json({ error: 'Du bist dieser Tour noch nicht beigetreten' })
    if (myTour.status !== 'PLANNED') return res.status(400).json({ error: 'Tour bereits gestartet' })
    // Allow adjusting the personal ETA right at the moment of starting —
    // plans shift between "I joined" and "I'm actually at the trailhead",
    // and this is the natural point to lock in the real return time.
    const updated = await prisma.tour.update({
      where: { id: myTour.id },
      data: { status: 'ACTIVE', startedAt: new Date(), ...(eta && { eta: new Date(eta) }) }
    })
    res.json({ started: 1, tour: updated })
  }
})

// GET /tour-groups/:id/messages — prep-phase coordination board
router.get('/:id/messages', requireAuth, async (req: Request, res: Response) => {
  const groupId = req.params.id as string
  const messages = await prisma.tourGroupMessage.findMany({
    where: { groupId },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' }
  })
  res.json(messages)
})

// POST /tour-groups/:id/messages
router.post('/:id/messages', requireAuth, async (req: Request, res: Response) => {
  const groupId = req.params.id as string
  const { text } = req.body as { text: string }
  if (!text || !text.trim()) return res.status(400).json({ error: 'Nachricht darf nicht leer sein' })

  const message = await prisma.tourGroupMessage.create({
    data: { groupId, authorId: req.userId as string, text: text.trim().slice(0, 1000) },
    include: { author: { select: { id: true, name: true } } }
  })
  res.status(201).json(message)
})

// GET /tour-groups/:id/checklist
router.get('/:id/checklist', requireAuth, async (req: Request, res: Response) => {
  const groupId = req.params.id as string
  const items = await prisma.tourGroupChecklistItem.findMany({
    where: { groupId },
    include: { addedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' }
  })
  res.json(items)
})

// POST /tour-groups/:id/checklist — any participant or invitee can add an
// item, since "did we remember the first-aid kit" is everyone's concern,
// not just the organizer's.
router.post('/:id/checklist', requireAuth, async (req: Request, res: Response) => {
  const groupId = req.params.id as string
  const { text } = req.body as { text: string }
  if (!text || !text.trim()) return res.status(400).json({ error: 'Text darf nicht leer sein' })

  const item = await prisma.tourGroupChecklistItem.create({
    data: { groupId, addedById: req.userId as string, text: text.trim().slice(0, 200) },
    include: { addedBy: { select: { id: true, name: true } } }
  })
  res.status(201).json(item)
})

// PUT /tour-groups/:id/checklist/:itemId — toggle done state
router.put('/:id/checklist/:itemId', requireAuth, async (req: Request, res: Response) => {
  const { itemId } = req.params
  const { done } = req.body as { done: boolean }
  const item = await prisma.tourGroupChecklistItem.update({
    where: { id: itemId as string },
    data: { done: !!done },
    include: { addedBy: { select: { id: true, name: true } } }
  })
  res.json(item)
})

// DELETE /tour-groups/:id/checklist/:itemId
router.delete('/:id/checklist/:itemId', requireAuth, async (req: Request, res: Response) => {
  const { itemId } = req.params
  await prisma.tourGroupChecklistItem.delete({ where: { id: itemId as string } })
  res.json({ success: true })
})

// POST /tour-groups/:id/waypoints — any participant can propose a waypoint
// on the shared route (e.g. "let's meet at this junction", "water source
// here") — visible to everyone immediately, not just organizer-controlled.
// Waypoint types carry meaning a bare pin on a map doesn't — a rescuer or
// fellow participant needs to know whether a marked point is a meeting
// spot, a water source, a known hazard, or just a scenic stop.
const WAYPOINT_TYPES = ['meeting', 'water', 'viewpoint', 'hazard', 'rest', 'other'] as const

router.post('/:id/waypoints', requireAuth, async (req: Request, res: Response) => {
  const groupId = req.params.id as string
  const { name, lat, lng, type, notes } = req.body as { name?: string; lat: number; lng: number; type?: string; notes?: string }
  if (lat == null || lng == null) return res.status(400).json({ error: 'lat/lng erforderlich' })

  const group = await prisma.tourGroup.findUnique({ where: { id: groupId } })
  if (!group) return res.status(404).json({ error: 'Gruppe nicht gefunden' })

  const author = await prisma.user.findUnique({ where: { id: req.userId as string }, select: { name: true } })
  const existing = Array.isArray(group.waypoints) ? group.waypoints as any[] : []
  const next = [...existing, {
    id: `wp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name || `Punkt von ${author?.name ?? 'Teilnehmer'}`,
    type: WAYPOINT_TYPES.includes(type as any) ? type : 'other',
    notes: notes || null,
    lat, lng,
    addedBy: req.userId,
    addedByName: author?.name ?? null,
  }]

  const updated = await prisma.tourGroup.update({
    where: { id: groupId },
    data: { waypoints: next as any }
  })
  res.json(updated)
})

// DELETE /tour-groups/:id/waypoints/:waypointId — anyone can remove a
// waypoint they added; the organizer can remove any (e.g. a duplicate or
// no-longer-relevant suggestion).
router.delete('/:id/waypoints/:waypointId', requireAuth, async (req: Request, res: Response) => {
  const groupId = req.params.id as string
  const waypointId = req.params.waypointId as string
  const group = await prisma.tourGroup.findUnique({ where: { id: groupId } })
  if (!group) return res.status(404).json({ error: 'Gruppe nicht gefunden' })

  const existing = Array.isArray(group.waypoints) ? group.waypoints as any[] : []
  const target = existing.find((w: any) => w.id === waypointId)
  if (!target) return res.status(404).json({ error: 'Wegpunkt nicht gefunden' })
  if (target.addedBy !== req.userId && group.organizerId !== req.userId) {
    return res.status(403).json({ error: 'Keine Berechtigung' })
  }

  const next = existing.filter((w: any) => w.id !== waypointId)
  const updated = await prisma.tourGroup.update({ where: { id: groupId }, data: { waypoints: next as any } })
  res.json(updated)
})

// Overnight stops and rest stops use the same shared-list pattern as
// waypoints — kept as a separate array on the group since they have
// different fields (a planned night number, an explicit "rest" duration)
// and are conceptually distinct from route waypoints in the UI.
router.post('/:id/overnight-stops', requireAuth, async (req: Request, res: Response) => {
  const groupId = req.params.id as string
  const { name, lat, lng, night, stopType, notes } = req.body as {
    name?: string; lat: number; lng: number; night?: number; stopType?: string; notes?: string;
  }
  if (lat == null || lng == null) return res.status(400).json({ error: 'lat/lng erforderlich' })

  const group = await prisma.tourGroup.findUnique({ where: { id: groupId } })
  if (!group) return res.status(404).json({ error: 'Gruppe nicht gefunden' })

  const author = await prisma.user.findUnique({ where: { id: req.userId as string }, select: { name: true } })
  const existing = Array.isArray(group.overnightStops) ? group.overnightStops as any[] : []
  const next = [...existing, {
    id: `os_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name || 'Übernachtung',
    night: night ?? existing.length + 1,
    type: stopType || 'huette',
    notes: notes || null,
    lat, lng,
    addedBy: req.userId,
    addedByName: author?.name ?? null,
  }]

  const updated = await prisma.tourGroup.update({ where: { id: groupId }, data: { overnightStops: next as any } })
  res.json(updated)
})

router.delete('/:id/overnight-stops/:stopId', requireAuth, async (req: Request, res: Response) => {
  const groupId = req.params.id as string
  const stopId = req.params.stopId as string
  const group = await prisma.tourGroup.findUnique({ where: { id: groupId } })
  if (!group) return res.status(404).json({ error: 'Gruppe nicht gefunden' })

  const existing = Array.isArray(group.overnightStops) ? group.overnightStops as any[] : []
  const target = existing.find((s: any) => s.id === stopId)
  if (!target) return res.status(404).json({ error: 'Übernachtung nicht gefunden' })
  if (target.addedBy !== req.userId && group.organizerId !== req.userId) {
    return res.status(403).json({ error: 'Keine Berechtigung' })
  }

  const next = existing.filter((s: any) => s.id !== stopId)
  const updated = await prisma.tourGroup.update({ where: { id: groupId }, data: { overnightStops: next as any } })
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