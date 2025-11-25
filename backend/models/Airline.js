const mongoose = require('mongoose');

const airlineSchema = new mongoose.Schema(
  {
    airline_code: {
      type: String,
      required: true,
      uppercase: true,
      unique: true,
      trim: true,
    },
    airline_name: {
      type: String,
      required: true,
      trim: true,
    },
    logo_url: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Airline', airlineSchema);


