const mongoose = require('mongoose');
const { mongoUri, nodeEnv } = require('./env');

let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    return mongoose.connection;
  }

  mongoose.set('strictQuery', true);

  try {
    const connection = await mongoose.connect(mongoUri, {
      autoIndex: nodeEnv !== 'production',
    });

    isConnected = true;
    return connection;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    throw error;
  }
};

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  if (nodeEnv !== 'test') {
    console.warn('MongoDB disconnected. Attempts to reconnect will continue.');
  }
});

module.exports = connectDB;


