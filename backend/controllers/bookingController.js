const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Flight = require('../models/Flight');
const { getDynamicPrice } = require('../services/pricingService');
const {
  consumeSeatHold,
  releaseExpiredLocks,
} = require('../services/seatLockService');
const generatePNR = require('../utils/pnrGenerator');
const asyncHandler = require('../utils/asyncHandler');

const createBooking = asyncHandler(async (req, res) => {
  const {
    flight_id,
    passengers = [],
    user_id,
    hold_id,
    payment_reference = 'SIMULATED',
  } = req.body;

  if (!flight_id || !user_id || !Array.isArray(passengers) || passengers.length === 0) {
    return res.status(400).json({ message: 'Missing required booking data' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await releaseExpiredLocks(session);

    const flight = await Flight.findById(flight_id)
      .populate('airline')
      .populate('departure_airport')
      .populate('arrival_airport')
      .session(session);

    if (!flight) {
      throw new Error('Flight not found');
    }

    const seatsNeeded = passengers.length;
    if (!hold_id) {
      if (flight.available_seats < seatsNeeded) {
        throw new Error('Insufficient seats available');
      }
      flight.available_seats -= seatsNeeded;
      await flight.save({ session });
    } else {
      await consumeSeatHold({ holdId: hold_id }, session);
    }

    const pricing = await getDynamicPrice(flight, {
      forceRefresh: true,
      seatsLeft: flight.available_seats,
    });

    const perSeatPrice = pricing.dynamic_price;
    const totalFare = perSeatPrice * seatsNeeded;

    const booking = await Booking.create(
      [
        {
          pnr: generatePNR(),
          flight: flight._id,
          user_id,
          passengers,
          total_fare: totalFare,
          currency: flight.currency,
          booking_time: new Date(),
          status: 'CONFIRMED',
          price_snapshot: {
            base_fare: flight.base_fare,
            dynamic_price: perSeatPrice,
            demand_index: pricing.demand_index,
            seats_left: pricing.seats_left,
            hours_to_departure: pricing.hours_to_departure,
          },
          payment_reference,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: 'Booking confirmed',
      booking: booking[0],
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(400).json({ message: error.message });
  }
});

const getBookingByPnr = asyncHandler(async (req, res) => {
  const { pnr } = req.params;
  const booking = await Booking.findOne({ pnr: pnr.toUpperCase() })
    .populate({
      path: 'flight',
      populate: ['airline', 'departure_airport', 'arrival_airport'],
    })
    .exec();

  if (!booking) {
    return res.status(404).json({ message: 'Booking not found' });
  }

  return res.json({ booking });
});

const cancelBooking = asyncHandler(async (req, res) => {
  const { pnr } = req.params;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await Booking.findOne({ pnr: pnr.toUpperCase() }).session(session);

    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.status === 'CANCELLED') {
      throw new Error('Booking already cancelled');
    }

    const flight = await Flight.findById(booking.flight).session(session);

    booking.status = 'CANCELLED';
    await booking.save({ session });

    flight.available_seats += booking.passengers.length;
    await flight.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.json({ message: 'Booking cancelled' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(400).json({ message: error.message });
  }
});

const listBookingsForUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const bookings = await Booking.find({ user_id: userId })
    .populate({
      path: 'flight',
      populate: ['airline', 'departure_airport', 'arrival_airport'],
    })
    .sort({ createdAt: -1 });

  return res.json({ results: bookings });
});

module.exports = {
  createBooking,
  getBookingByPnr,
  cancelBooking,
  listBookingsForUser,
};


