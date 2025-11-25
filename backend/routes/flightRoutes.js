const express = require('express');
const {
  searchFlights,
  getFlightById,
  createFlight,
  holdSeats,
  releaseSeatHoldHandler,
} = require('../controllers/flightController');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/search', searchFlights);
router.get('/:id', getFlightById);
router.post('/add', authenticate, requireAdmin, createFlight);
router.post('/:id/hold', authenticate, holdSeats);
router.delete('/holds/:holdId', authenticate, releaseSeatHoldHandler);

module.exports = router;


