const express = require('express');
const {
  createBooking,
  getBookingByPnr,
  cancelBooking,
  listBookingsForUser,
} = require('../controllers/bookingController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/user/:userId', authenticate, listBookingsForUser);
router.post('/', authenticate, createBooking);
router.get('/:pnr', authenticate, getBookingByPnr);
router.delete('/:pnr', authenticate, cancelBooking);

module.exports = router;

