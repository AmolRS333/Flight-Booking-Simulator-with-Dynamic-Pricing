const express = require('express');
const { mockLogin } = require('../controllers/authController');

const router = express.Router();

router.post('/mock-login', mockLogin);

module.exports = router;


