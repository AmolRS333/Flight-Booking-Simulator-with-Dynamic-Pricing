const mongoose = require('mongoose');

const flightSchema = new mongoose.Schema(
  {
    flight_number: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    airline: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Airline',
      required: true,
    },
    departure_airport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Airport',
      required: true,
    },
    arrival_airport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Airport',
      required: true,
    },
    departure_time: {
      type: Date,
      required: true,
    },
    arrival_time: {
      type: Date,
      required: true,
    },
    base_fare: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    total_seats: {
      type: Number,
      required: true,
      min: 1,
    },
    available_seats: {
      type: Number,
      required: true,
      min: 0,
    },
    fare_class: {
      type: String,
      enum: ['ECONOMY', 'PREMIUM', 'BUSINESS', 'FIRST'],
      default: 'ECONOMY',
    },
    status: {
      type: String,
      enum: ['SCHEDULED', 'DELAYED', 'CANCELLED'],
      default: 'SCHEDULED',
    },
    meta: {
      aircraft_type: String,
      gate: String,
      duration_minutes: Number,
    },
  },
  { timestamps: true }
);

flightSchema.index(
  { departure_airport: 1, arrival_airport: 1, departure_time: 1 },
  { name: 'search_index' }
);

module.exports = mongoose.model('Flight', flightSchema);


