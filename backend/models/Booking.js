const mongoose = require('mongoose');

const passengerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    age: { type: Number, required: true, min: 0 },
    gender: { type: String, enum: ['M', 'F', 'O'], required: true },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    pnr: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    flight: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Flight',
      required: true,
    },
    user_id: {
      type: String,
      required: true,
      trim: true,
    },
    passengers: {
      type: [passengerSchema],
      validate: {
        validator: (arr) => arr.length > 0,
        message: 'At least one passenger is required',
      },
    },
    total_fare: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    booking_time: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['CONFIRMED', 'CANCELLED'],
      default: 'CONFIRMED',
    },
    receipt_url: {
      type: String,
      default: '',
    },
    price_snapshot: {
      base_fare: Number,
      dynamic_price: Number,
      demand_index: Number,
      seats_left: Number,
      hours_to_departure: Number,
    },
    payment_reference: {
      type: String,
      default: 'SIMULATED',
    },
  },
  { timestamps: true }
);

bookingSchema.index({ pnr: 1 });
bookingSchema.index({ user_id: 1, createdAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);

