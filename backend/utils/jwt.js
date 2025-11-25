const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');

const signToken = (payload, options = {}) =>
  jwt.sign(payload, jwtSecret, { expiresIn: '6h', ...options });

module.exports = {
  signToken,
};


