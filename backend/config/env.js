const dotenv = require('dotenv');

dotenv.config();

const getEnvVar = (key, fallback) => {
  const value = process.env[key];
  if (value === undefined || value === '') {
    return fallback;
  }
  return value;
};

module.exports = {
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  port: parseInt(getEnvVar('PORT', '5000'), 10),
  mongoUri: getEnvVar('MONGO_URI', 'mongodb://127.0.0.1:27017/flight_booking_simulator'),
  jwtSecret: getEnvVar('JWT_SECRET', 'supersecretkey'),
  pricingServiceUrl: getEnvVar('PRICING_SERVICE_URL', 'http://127.0.0.1:8000'),
  seatHoldTTLMinutes: parseInt(getEnvVar('SEAT_HOLD_TTL_MINUTES', '2'), 10),
  pricingCacheTTLSeconds: parseInt(getEnvVar('PRICING_CACHE_TTL_SECONDS', '60'), 10),
};


