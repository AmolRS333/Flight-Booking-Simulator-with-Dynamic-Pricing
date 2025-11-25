const mongoose = require('mongoose');
const { seatHoldTTLMinutes } = require('../config/env');

const seatLockSchema = new mongoose.Schema(
  {
    flight: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Flight',
      required: true,
    },
    user_id: {
      type: String,
      required: true,
    },
    seats_locked: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ['HELD', 'RELEASED'],
      default: 'HELD',
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () =>
        new Date(Date.now() + seatHoldTTLMinutes * 60 * 1000),
    },
  },
  { timestamps: true }
);

seatLockSchema.index(
  { flight: 1, user_id: 1, status: 1 },
  { partialFilterExpression: { status: 'HELD' } }
);

module.exports = mongoose.model('SeatLock', seatLockSchema);

