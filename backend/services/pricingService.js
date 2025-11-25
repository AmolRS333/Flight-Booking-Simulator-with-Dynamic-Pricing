const axios = require('axios');
const PriceCache = require('../models/PriceCache');
const calculateHoursToDeparture = require('../utils/calculateHoursToDeparture');
const { pricingServiceUrl } = require('../config/env');

const PRICING_ENDPOINT = '/get_dynamic_price';

const getDynamicPrice = async (flight, options = {}) => {
  const {
    forceRefresh = false,
    seatsLeft = flight.available_seats,
    demandIndex,
  } = options;

  const hoursToDeparture = options.hoursToDeparture ?? calculateHoursToDeparture(flight.departure_time);
  const demand = demandIndex ?? Math.random();

  if (!forceRefresh) {
    const cached = await PriceCache.findOne({ flight: flight._id });
    if (cached) {
      return {
        dynamic_price: cached.dynamic_price,
        demand_index: cached.demand_index,
        seats_left: cached.seats_left,
        hours_to_departure: cached.hours_to_departure,
        fromCache: true,
      };
    }
  }

  try {
    const response = await axios.post(`${pricingServiceUrl}${PRICING_ENDPOINT}`, {
      base_fare: flight.base_fare,
      seats_left: seatsLeft,
      total_seats: flight.total_seats,
      hours_to_departure: hoursToDeparture,
      demand_index: demand,
      flight_id: String(flight._id),
    });

    const { dynamic_price, demand_index, metadata } = response.data;

    await PriceCache.findOneAndUpdate(
      { flight: flight._id },
      {
        dynamic_price,
        demand_index,
        seats_left: seatsLeft,
        hours_to_departure: hoursToDeparture,
        calculatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    return {
      dynamic_price,
      demand_index,
      seats_left: seatsLeft,
      hours_to_departure: hoursToDeparture,
      metadata,
      fromCache: false,
    };
  } catch (error) {
    console.error('Dynamic pricing service error:', error.message);
    return {
      dynamic_price: flight.base_fare,
      demand_index: demand,
      seats_left: seatsLeft,
      hours_to_departure: hoursToDeparture,
      fromCache: false,
      fallback: true,
      metadata: {
        calculated_at: new Date().toISOString(),
        reason: 'pricing_service_unavailable',
      },
    };
  }
};

module.exports = {
  getDynamicPrice,
};

