import express, { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { parseGpx } from '../lib/gpxParser';

const router = express.Router();

router.post('/parse', requireAuth, async (req: Request, res: Response) => {
  const { gpxContent } = req.body;

  if (!gpxContent) return res.status(400).json({ error: 'GPX-Inhalt fehlt' });

  try {
    const data = parseGpx(gpxContent);
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/attach/:tourId', requireAuth, async (req: Request, res: Response) => {
  const tourId = req.params.tourId as string;
  const { gpxContent } = req.body;

  if (!gpxContent) return res.status(400).json({ error: 'GPX-Inhalt fehlt' });

  const tour = await prisma.tour.findFirst({
    where: { id: tourId, userId: req.userId as string }
  });

  if (!tour) return res.status(404).json({ error: 'Tour nicht gefunden' });

  try {
    const data = parseGpx(gpxContent);

    const updated = await prisma.tour.update({
      where: { id: tourId },
      data: {
        gpxTrack: data as any,
        distanceKm: data.distanceKm,
        elevationUp: data.elevationUp,
        startLat: data.startLat,
        startLng: data.startLng,
      }
    });

    res.json({ message: 'GPX gespeichert', tour: updated, summary: data });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /gpx/attach-group/:groupId — same as /attach/:tourId but for a
// TourGroup, used when an organizer uploads a route during shared-hike
// creation, before any participant (including themselves) has a Tour yet.
router.post('/attach-group/:groupId', requireAuth, async (req: Request, res: Response) => {
  const groupId = req.params.groupId as string;
  const { gpxContent } = req.body;

  if (!gpxContent) return res.status(400).json({ error: 'GPX-Inhalt fehlt' });

  const group = await prisma.tourGroup.findFirst({
    where: { id: groupId, organizerId: req.userId as string }
  });

  if (!group) return res.status(404).json({ error: 'Gruppe nicht gefunden' });

  try {
    const data = parseGpx(gpxContent);

    const updated = await prisma.tourGroup.update({
      where: { id: groupId },
      data: {
        gpxTrack: data as any,
        distanceKm: data.distanceKm,
        elevationUp: data.elevationUp,
        startLat: data.startLat,
        startLng: data.startLng,
        waypoints: data.waypoints as any,
      }
    });

    res.json({ message: 'GPX gespeichert', group: updated, summary: data });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;