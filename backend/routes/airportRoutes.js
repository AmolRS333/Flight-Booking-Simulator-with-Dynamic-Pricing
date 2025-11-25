const express = require('express');
const { suggestAirports } = require('../controllers/airportController');

const router = express.Router();

router.get('/suggest', suggestAirports);

module.exports = router;


