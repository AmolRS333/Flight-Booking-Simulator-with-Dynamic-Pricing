const mongoose = require('mongoose');
const { pricingCacheTTLSeconds } = require('../config/env');

const priceCacheSchema = new mongoose.Schema(
  {
    flight: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Flight',
      required: true,
    },
    dynamic_price: {
      type: Number,
      required: true,
    },
    demand_index: {
      type: Number,
      required: true,
    },
    seats_left: {
      type: Number,
      required: true,
    },
    hours_to_departure: {
      type: Number,
      required: true,
    },
    calculatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

priceCacheSchema.index({ flight: 1 }, { unique: true });
priceCacheSchema.index(
  { calculatedAt: 1 },
  {
    expireAfterSeconds: pricingCacheTTLSeconds,
  }
);

module.exports = mongoose.model('PriceCache', priceCacheSchema);


