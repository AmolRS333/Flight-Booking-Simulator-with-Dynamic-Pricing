const mongoose = require('mongoose');
const SeatLock = require('../models/SeatLock');
const Flight = require('../models/Flight');
const { seatHoldTTLMinutes } = require('../config/env');

const releaseExpiredLocks = async (session) => {
  const now = new Date();
  const baseQuery = SeatLock.find({
    status: 'HELD',
    expiresAt: { $lte: now },
  });
  const expiredLocks = session ? await baseQuery.session(session) : await baseQuery;

  if (!expiredLocks.length) {
    return;
  }

  const updates = expiredLocks.map(async (lock) => {
    const updateQuery = Flight.findByIdAndUpdate(
      lock.flight,
      { $inc: { available_seats: lock.seats_locked } },
      { session }
    );
    if (session) {
      await updateQuery.session(session);
    } else {
      await updateQuery;
    }
    lock.status = 'RELEASED';
    await lock.save({ session });
  });

  await Promise.all(updates);
};

const createSeatHold = async ({ flightId, userId, seats }, session) => {
  await releaseExpiredLocks(session);

  const flightQuery = Flight.findById(flightId);
  const flight = session ? await flightQuery.session(session) : await flightQuery;
  if (!flight) {
    throw new Error('Flight not found');
  }

  if (flight.available_seats < seats) {
    throw new Error('Not enough seats available');
  }

  flight.available_seats -= seats;
  await flight.save({ session });

  const seatLock = await SeatLock.create(
    [
      {
        flight: flight._id,
        user_id: userId,
        seats_locked: seats,
        expiresAt: new Date(Date.now() + seatHoldTTLMinutes * 60 * 1000),
      },
    ],
    { session }
  );

  return seatLock[0];
};

const releaseSeatHold = async ({ holdId }, session) => {
  const seatLockQuery = SeatLock.findById(holdId);
  const seatLock = session ? await seatLockQuery.session(session) : await seatLockQuery;
  if (!seatLock || seatLock.status !== 'HELD') {
    return null;
  }

  const releaseQuery = Flight.findByIdAndUpdate(
    seatLock.flight,
    { $inc: { available_seats: seatLock.seats_locked } },
    { session }
  );
  if (session) {
    await releaseQuery.session(session);
  } else {
    await releaseQuery;
  }

  seatLock.status = 'RELEASED';
  await seatLock.save({ session });

  return seatLock;
};

const consumeSeatHold = async ({ holdId }, session) => {
  const seatLockQuery = SeatLock.findById(holdId);
  const seatLock = session ? await seatLockQuery.session(session) : await seatLockQuery;
  if (!seatLock || seatLock.status !== 'HELD') {
    throw new Error('Invalid or expired seat hold');
  }

  if (seatLock.expiresAt <= new Date()) {
    await releaseSeatHold({ holdId }, session);
    throw new Error('Seat hold expired');
  }

  seatLock.status = 'RELEASED';
  await seatLock.save({ session });

  return seatLock;
};

module.exports = {
  releaseExpiredLocks,
  createSeatHold,
  releaseSeatHold,
  consumeSeatHold,
};

