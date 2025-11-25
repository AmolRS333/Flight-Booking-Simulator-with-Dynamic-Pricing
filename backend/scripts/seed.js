/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const connectDB = require('../config/db');
const Airline = require('../models/Airline');
const Airport = require('../models/Airport');
const Flight = require('../models/Flight');

const loadJson = (fileName) => {
  const filePath = path.join(__dirname, '..', 'data', fileName);
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
};

const seed = async () => {
  try {
    await connectDB();

    const airlines = loadJson('airlines.json');
    const airports = loadJson('airports.json');
    const flights = loadJson('flights.json');

    await Airline.deleteMany();
    await Airport.deleteMany();
    await Flight.deleteMany();

    const airlineDocs = await Airline.insertMany(airlines);
    const airportDocs = await Airport.insertMany(airports);

    const airlineMap = airlineDocs.reduce((acc, doc) => {
      acc[doc.airline_code] = doc._id;
      return acc;
    }, {});

    const airportMap = airportDocs.reduce((acc, doc) => {
      acc[doc.airport_code] = doc._id;
      return acc;
    }, {});

    const flightDocs = flights.map((flight) => ({
      ...flight,
      flight_number: flight.flight_number.toUpperCase(),
      airline: airlineMap[flight.airline_code],
      departure_airport: airportMap[flight.departure_airport_code],
      arrival_airport: airportMap[flight.arrival_airport_code],
      available_seats: flight.total_seats,
    }));

    await Flight.insertMany(flightDocs);

    console.log('Seed data inserted successfully');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seed();


