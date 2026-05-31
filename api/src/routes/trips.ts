import { Router } from 'express';
import { checkJwt, getAuth0Id, jwtErrorHandler } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { asyncRoute, requireUser } from '../lib/route-helpers';
import { normalizeTripNotes, parseTripCreatePayload } from '../lib/trip-input';
import { sendError } from '../lib/http-response';

const router = Router();

// GET /api/trips
// Returns all saved trips for the user, newest first.
router.get(
  '/',
  checkJwt,
  jwtErrorHandler,
  asyncRoute(async (req, res) => {
    const user = await requireUser(getAuth0Id(req));
    const trips = await prisma.trip.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(trips);
  }),
);

// POST /api/trips
// Creates a new saved trip. Returns the created trip.
router.post(
  '/',
  checkJwt,
  jwtErrorHandler,
  asyncRoute(async (req, res) => {
    const user = await requireUser(getAuth0Id(req));
    const parsedTrip = parseTripCreatePayload(req.body);
    if (!parsedTrip.ok) {
      sendError(res, 400, parsedTrip.error);
      return;
    }

    const trip = await prisma.trip.create({
      data: {
        userId: user.id,
        ...parsedTrip.data,
      },
    });

    res.status(201).json(trip);
  }),
);

// PATCH /api/trips/:id
// Updates the notes on a saved trip — user must own it.
router.patch(
  '/:id',
  checkJwt,
  jwtErrorHandler,
  asyncRoute(async (req, res) => {
    const user = await requireUser(getAuth0Id(req));
    const { id } = req.params;

    if (!id || id.length > 100) {
      sendError(res, 400, 'Invalid trip id');
      return;
    }

    const b = req.body as Record<string, unknown>;
    const parsedNotes = normalizeTripNotes(b['notes']);
    if (parsedNotes.error || parsedNotes.value === undefined) {
      sendError(res, 400, parsedNotes.error ?? 'notes must be a string');
      return;
    }

    const result = await prisma.trip.updateMany({
      where: { id, userId: user.id },
      data: { notes: parsedNotes.value },
    });

    if (result.count === 0) {
      sendError(res, 404, 'Trip not found');
      return;
    }

    res.json({ id, notes: parsedNotes.value });
  }),
);

// DELETE /api/trips/:id
// Deletes a saved trip — user must own it.
router.delete(
  '/:id',
  checkJwt,
  jwtErrorHandler,
  asyncRoute(async (req, res) => {
    const user = await requireUser(getAuth0Id(req));
    const { id } = req.params;

    if (!id || id.length > 100) {
      sendError(res, 400, 'Invalid trip id');
      return;
    }

    // deleteMany with userId ensures a user can only delete their own trips
    const result = await prisma.trip.deleteMany({
      where: { id, userId: user.id },
    });

    if (result.count === 0) {
      sendError(res, 404, 'Trip not found');
      return;
    }

    res.status(204).send();
  }),
);

export default router;
