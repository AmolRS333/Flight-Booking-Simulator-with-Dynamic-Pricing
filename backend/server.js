const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
const { port, nodeEnv } = require('./config/env');
const flightRoutes = require('./routes/flightRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const airportRoutes = require('./routes/airportRoutes');
const authRoutes = require('./routes/authRoutes');
const { releaseExpiredLocks } = require('./services/seatLockService');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan(nodeEnv === 'production' ? 'combined' : 'dev'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'flight-booking-backend', timestamp: new Date() });
});

app.use('/api/flights', flightRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/airports', airportRoutes);
app.use('/api/auth', authRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use(errorHandler);

const startServer = async () => {
  try {
    await connectDB();
    setInterval(() => {
      releaseExpiredLocks().catch((error) => {
        console.warn('Seat lock cleanup error:', error.message);
      });
    }, 60 * 1000);

    app.listen(port, () => {
      console.log(`Backend server listening on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;

