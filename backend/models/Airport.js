const mongoose = require('mongoose');

const airportSchema = new mongoose.Schema(
  {
    airport_code: {
      type: String,
      required: true,
      uppercase: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      trim: true,
    },
    timezone: {
      type: String,
      default: 'UTC',
      trim: true,
    },
  },
  { timestamps: true }
);

airportSchema.index({ name: 'text', city: 'text', airport_code: 'text' });

module.exports = mongoose.model('Airport', airportSchema);


