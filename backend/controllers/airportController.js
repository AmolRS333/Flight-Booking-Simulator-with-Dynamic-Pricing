const Airport = require('../models/Airport');
const asyncHandler = require('../utils/asyncHandler');

const suggestAirports = asyncHandler(async (req, res) => {
  const { query = '', limit = 10 } = req.query;

  if (!query) {
    const airports = await Airport.find().limit(Number(limit) || 10);
    return res.json({ results: airports });
  }

  const regex = new RegExp(query, 'i');
  const airports = await Airport.find({
    $or: [{ airport_code: regex }, { city: regex }, { name: regex }],
  })
    .limit(Number(limit) || 10)
    .sort({ city: 1 });

  return res.json({ results: airports });
});

module.exports = {
  suggestAirports,
};


