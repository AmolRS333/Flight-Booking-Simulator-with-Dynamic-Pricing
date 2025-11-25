const calculateHoursToDeparture = (departureTime) => {
  const now = new Date();
  const departure = new Date(departureTime);
  const diffMs = departure.getTime() - now.getTime();
  return Math.max(Math.round(diffMs / (1000 * 60 * 60)), 0);
};

module.exports = calculateHoursToDeparture;


