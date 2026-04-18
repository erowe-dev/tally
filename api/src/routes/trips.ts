import { Router } from 'express';
import { checkJwt, getAuth0Id, jwtErrorHandler } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { asyncRoute, requireUser, validateCardId } from '../lib/route-helpers';

const router = Router();

const TRIP_TYPES   = new Set(['flight', 'hotel']);
const CABIN_TYPES  = new Set(['economy', 'premium', 'business', 'first']);
const HOTEL_CATS   = new Set(['budget', 'mid', 'luxury', 'top']);
const IATA_RE      = /^[A-Z]{3}$/;

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
    const b = req.body as Record<string, unknown>;

    const tripType = b['tripType'];
    if (typeof tripType !== 'string' || !TRIP_TYPES.has(tripType)) {
      res.status(400).json({ error: "tripType must be 'flight' or 'hotel'" });
      return;
    }

    const programName = b['programName'];
    if (typeof programName !== 'string' || programName.trim().length === 0) {
      res.status(400).json({ error: 'programName is required' });
      return;
    }

    const ptsRequired = b['ptsRequired'];
    if (typeof ptsRequired !== 'number' || ptsRequired < 0 || !Number.isFinite(ptsRequired)) {
      res.status(400).json({ error: 'ptsRequired must be a non-negative number' });
      return;
    }

    // Optional fields validated loosely
    const origin      = typeof b['origin']      === 'string' ? b['origin'].toUpperCase()      : undefined;
    const destination = typeof b['destination'] === 'string' ? b['destination'].toUpperCase() : undefined;
    const cabin       = typeof b['cabin']       === 'string' && CABIN_TYPES.has(b['cabin']) ? b['cabin'] : undefined;
    const passengers  = typeof b['passengers']  === 'number' && b['passengers'] > 0 ? Math.round(b['passengers'] as number) : undefined;
    const nights      = typeof b['nights']      === 'number' && b['nights'] > 0     ? Math.round(b['nights'] as number)     : undefined;
    const hotelCat    = typeof b['hotelCat']    === 'string' && HOTEL_CATS.has(b['hotelCat']) ? b['hotelCat'] : undefined;
    const notes       = typeof b['notes']       === 'string' ? b['notes'].slice(0, 500)       : undefined;

    const trip = await prisma.trip.create({
      data: {
        userId: user.id,
        tripType,
        programName: programName.trim(),
        ptsRequired: Math.round(ptsRequired),
        origin,
        destination,
        cabin,
        passengers,
        nights,
        hotelCat,
        notes,
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
      res.status(400).json({ error: 'Invalid trip id' });
      return;
    }

    const b = req.body as Record<string, unknown>;
    if (typeof b['notes'] !== 'string') {
      res.status(400).json({ error: 'notes must be a string' });
      return;
    }
    const notes = b['notes'].trim().slice(0, 500);

    const result = await prisma.trip.updateMany({
      where: { id, userId: user.id },
      data: { notes },
    });

    if (result.count === 0) {
      res.status(404).json({ error: 'Trip not found' });
      return;
    }

    res.json({ id, notes });
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
      res.status(400).json({ error: 'Invalid trip id' });
      return;
    }

    // deleteMany with userId ensures a user can only delete their own trips
    const result = await prisma.trip.deleteMany({
      where: { id, userId: user.id },
    });

    if (result.count === 0) {
      res.status(404).json({ error: 'Trip not found' });
      return;
    }

    res.status(204).send();
  }),
);

export default router;
