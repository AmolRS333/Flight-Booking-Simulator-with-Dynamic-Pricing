const mongoose = require('mongoose');
const Flight = require('../models/Flight');
const Airline = require('../models/Airline');
const Airport = require('../models/Airport');
const { getDynamicPrice } = require('../services/pricingService');
const {
  createSeatHold,
  releaseSeatHold,
  releaseExpiredLocks,
} = require('../services/seatLockService');
const asyncHandler = require('../utils/asyncHandler');

const resolveAirport = async (codeOrId) => {
  if (!codeOrId) return null;

  if (mongoose.Types.ObjectId.isValid(codeOrId)) {
    return Airport.findById(codeOrId);
  }

  return Airport.findOne({
    airport_code: codeOrId.toUpperCase(),
  });
};

const searchFlights = asyncHandler(async (req, res) => {
  const {
    from,
    to,
    date,
    sort = 'price',
    order = 'asc',
    page = 1,
    limit = 10,
  } = req.query;

  const query = {};

  if (from) {
    const depAirport = await resolveAirport(from);
    if (!depAirport) {
      return res.json({ total: 0, page: Number(page), results: [] });
    }
    query.departure_airport = depAirport._id;
  }

  if (to) {
    const arrAirport = await resolveAirport(to);
    if (!arrAirport) {
      return res.json({ total: 0, page: Number(page), results: [] });
    }
    query.arrival_airport = arrAirport._id;
  }

  if (date) {
    const searchDate = new Date(date);
    if (!Number.isNaN(searchDate.getTime())) {
      const start = new Date(searchDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(searchDate);
      end.setHours(23, 59, 59, 999);
      query.departure_time = { $gte: start, $lte: end };
    }
  }

  await releaseExpiredLocks();

  const numericLimit = Math.min(Number(limit) || 10, 50);
  const numericPage = Math.max(Number(page) || 1, 1);
  const skip = (numericPage - 1) * numericLimit;

  const [total, flights] = await Promise.all([
    Flight.countDocuments(query),
    Flight.find(query)
      .populate('airline')
      .populate('departure_airport')
      .populate('arrival_airport')
      .sort({ departure_time: 1 })
      .skip(skip)
      .limit(numericLimit),
  ]);

  const flightsWithPricing = await Promise.all(
    flights.map(async (flight) => {
      const pricing = await getDynamicPrice(flight);
      return {
        flight,
        pricing,
      };
    })
  );

  flightsWithPricing.sort((a, b) => {
    if (sort === 'price') {
      return order === 'desc'
        ? b.pricing.dynamic_price - a.pricing.dynamic_price
        : a.pricing.dynamic_price - b.pricing.dynamic_price;
    }
    if (sort === 'departure_time') {
      return order === 'desc'
        ? new Date(b.flight.departure_time) - new Date(a.flight.departure_time)
        : new Date(a.flight.departure_time) - new Date(b.flight.departure_time);
    }
    return 0;
  });

  const results = flightsWithPricing.map(({ flight, pricing }) => ({
    id: flight._id,
    flight_number: flight.flight_number,
    airline: flight.airline,
    departure_airport: flight.departure_airport,
    arrival_airport: flight.arrival_airport,
    departure_time: flight.departure_time,
    arrival_time: flight.arrival_time,
    base_fare: flight.base_fare,
    currency: flight.currency,
    available_seats: flight.available_seats,
    total_seats: flight.total_seats,
    fare_class: flight.fare_class,
    status: flight.status,
    meta: flight.meta,
    pricing,
  }));

  return res.json({
    total,
    page: numericPage,
    pageSize: numericLimit,
    results,
  });
});

const getFlightById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const flight = await Flight.findById(id)
    .populate('airline')
    .populate('departure_airport')
    .populate('arrival_airport');

  if (!flight) {
    return res.status(404).json({ message: 'Flight not found' });
  }

  const pricing = await getDynamicPrice(flight, { forceRefresh: true });

  return res.json({
    id: flight._id,
    flight_number: flight.flight_number,
    airline: flight.airline,
    departure_airport: flight.departure_airport,
    arrival_airport: flight.arrival_airport,
    departure_time: flight.departure_time,
    arrival_time: flight.arrival_time,
    base_fare: flight.base_fare,
    currency: flight.currency,
    available_seats: flight.available_seats,
    total_seats: flight.total_seats,
    fare_class: flight.fare_class,
    status: flight.status,
    meta: flight.meta,
    pricing,
  });
});

const createFlight = asyncHandler(async (req, res) => {
  const {
    flight_number,
    airline_code,
    departure_airport_code,
    arrival_airport_code,
    departure_time,
    arrival_time,
    base_fare,
    total_seats,
    fare_class,
    currency = 'USD',
    meta = {},
  } = req.body;

  if (!flight_number) {
    return res.status(400).json({ message: 'flight_number is required' });
  }

  const airline = await Airline.findOne({ airline_code: airline_code.toUpperCase() });
  if (!airline) {
    return res.status(400).json({ message: 'Invalid airline code' });
  }

  const departureAirport = await Airport.findOne({
    airport_code: departure_airport_code.toUpperCase(),
  });
  const arrivalAirport = await Airport.findOne({
    airport_code: arrival_airport_code.toUpperCase(),
  });

  if (!departureAirport || !arrivalAirport) {
    return res.status(400).json({ message: 'Invalid airport code(s)' });
  }

  const flight = await Flight.create({
    flight_number: flight_number.toUpperCase(),
    airline: airline._id,
    departure_airport: departureAirport._id,
    arrival_airport: arrivalAirport._id,
    departure_time,
    arrival_time,
    base_fare,
    currency,
    total_seats,
    available_seats: total_seats,
    fare_class,
    meta,
  });

  return res.status(201).json({ message: 'Flight created', flight });
});

const holdSeats = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { seats = 1 } = req.body;
  const userId = req.user?.id || req.body.user_id;

  if (!userId) {
    return res.status(400).json({ message: 'user_id is required to hold seats' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const seatLock = await createSeatHold(
      {
        flightId: id,
        userId,
        seats,
      },
      session
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: 'Seats held successfully',
      hold_id: seatLock._id,
      expiresAt: seatLock.expiresAt,
      seats_locked: seatLock.seats_locked,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(400).json({ message: error.message });
  }
});

const releaseSeatHoldHandler = asyncHandler(async (req, res) => {
  const { holdId } = req.params;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const seatLock = await releaseSeatHold({ holdId }, session);
    await session.commitTransaction();
    session.endSession();

    if (!seatLock) {
      return res.status(404).json({ message: 'Hold not found or already released' });
    }

    return res.json({ message: 'Seat hold released' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(400).json({ message: error.message });
  }
});

module.exports = {
  searchFlights,
  getFlightById,
  createFlight,
  holdSeats,
  releaseSeatHoldHandler,
};


